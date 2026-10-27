import { prisma } from '../../infrastructure/db/client.ts';
import { generateSecureToken, hashToken } from '../../infrastructure/security/token-service.ts';
import { hashPassword, comparePassword } from '../../infrastructure/security/password-service.ts';
import type { IEmailDispatcher } from '../../infrastructure/email/email-dispatcher.ts';
import { defaultEmailDispatcher } from '../../infrastructure/email/email-dispatcher.ts';
import { checkRateLimit } from '../../infrastructure/security/rate-limiter.ts';

export class AuthService {
  private emailDispatcher: IEmailDispatcher;

  constructor(emailDispatcher: IEmailDispatcher = defaultEmailDispatcher) {
    this.emailDispatcher = emailDispatcher;
  }

  /**
   * Admin generates a single-use invitation.
   * Staging: User is set to 'INVITED', initial Membership is created, MemberStreak is initialized.
   */
  async createInvitation(
    adminId: string,
    email: string,
    fullName: string,
    phone: string | undefined,
    planName: string,
    startDate: string,
    expiryDate: string
  ): Promise<{ rawInviteToken: string; inviteUrl: string }> {
    const normalizedEmail = email.trim().toLowerCase();

    // Check if an active user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existingUser && existingUser.status === 'ACTIVE') {
      throw new Error(`A member with email ${normalizedEmail} is already active.`);
    }

    const rawInviteToken = generateSecureToken(32);
    const tokenHash = hashToken(rawInviteToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await prisma.$transaction(async (tx) => {
      // 1. Upsert staged User with status = 'INVITED'
      const user = await tx.user.upsert({
        where: { email: normalizedEmail },
        update: {
          fullName,
          phone: phone || null,
          role: 'MEMBER',
          status: 'INVITED',
        },
        create: {
          email: normalizedEmail,
          fullName,
          phone: phone || null,
          role: 'MEMBER',
          status: 'INVITED',
        },
      });

      // 2. Ensure initial Membership row exists
      await tx.membership.create({
        data: {
          userId: user.id,
          planName,
          startDate,
          expiryDate,
          status: 'ACTIVE',
        },
      });

      // 3. Ensure MemberStreak row exists before locking (Condition 3)
      await tx.memberStreak.upsert({
        where: { userId: user.id },
        update: {},
        create: {
          userId: user.id,
          currentStreak: 0,
          longestStreak: 0,
        },
      });

      // 4. Invalidate any existing pending invitations for this email
      await tx.invitation.updateMany({
        where: { email: normalizedEmail, status: 'PENDING' },
        data: { status: 'REVOKED' },
      });

      // 5. Insert new Invitation
      await tx.invitation.create({
        data: {
          email: normalizedEmail,
          tokenHash,
          status: 'PENDING',
          invitedById: adminId,
          expiresAt,
        },
      });
    });

    const inviteUrl = `https://app.boxinn.in/activate?token=${rawInviteToken}`;
    return { rawInviteToken, inviteUrl };
  }

  /**
   * Member claims the invitation, confirms email, and sets their password.
   * STRICT: Sets user status to 'PENDING_VERIFICATION'. Does NOT create a session or grant access yet.
   */
  async claimInvitation(
    rawInviteToken: string,
    confirmedEmail: string,
    password: string,
    ipAddress: string = '127.0.0.1'
  ): Promise<{ message: string; email: string }> {
    // Rate limit claims: max 5 per 15 mins per IP
    const rateCheck = await checkRateLimit(`ip:${ipAddress}:claim_invitation`, 5, 15 * 60 * 1000);
    if (!rateCheck.allowed) {
      throw new Error(`Too many attempts. Please retry after ${rateCheck.retryAfterSeconds} seconds.`);
    }

    const normalizedEmail = confirmedEmail.trim().toLowerCase();
    const tokenHash = hashToken(rawInviteToken);
    const rawVerifyToken = generateSecureToken(32);
    const verifyTokenHash = hashToken(rawVerifyToken);
    const verifyExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    let recipientName = 'Member';

    await prisma.$transaction(async (tx) => {
      // 1. Atomically consume invitation using conditional update to prevent race conditions
      const updated = await tx.invitation.updateMany({
        where: {
          tokenHash,
          status: 'PENDING',
          expiresAt: { gt: new Date() },
          email: normalizedEmail,
        },
        data: {
          status: 'CLAIMED',
          acceptedAt: new Date(),
        },
      });

      if (updated.count === 0) {
        throw new Error('Invitation is invalid, expired, or has already been claimed.');
      }

      // 2. Hash password and update user to PENDING_VERIFICATION
      const passwordHash = await hashPassword(password);
      const user = await tx.user.update({
        where: { email: normalizedEmail },
        data: {
          passwordHash,
          status: 'PENDING_VERIFICATION', // Strictly PENDING!
        },
      });

      recipientName = user.fullName;

      // 3. Issue separate EmailVerificationToken
      await tx.emailVerificationToken.create({
        data: {
          userId: user.id,
          tokenHash: verifyTokenHash,
          expiresAt: verifyExpiresAt,
        },
      });
    });

    // 4. Dispatch verification email
    await this.emailDispatcher.sendVerificationEmail(normalizedEmail, rawVerifyToken, recipientName);

    return {
      message: 'Invitation claimed. A verification email has been sent. Please verify your email to activate your account.',
      email: normalizedEmail,
    };
  }

  /**
   * Member clicks verification link.
   * Atomically consumes the verification token, transitions user to 'ACTIVE', sets emailVerifiedAt,
   * and creates an authenticated database-backed session.
   */
  async verifyEmail(
    rawVerifyToken: string,
    ipAddress: string = '127.0.0.1',
    userAgent?: string
  ): Promise<{ sessionToken: string; user: { id: string; email: string; fullName: string; role: string } }> {
    const rateCheck = await checkRateLimit(`ip:${ipAddress}:verify_email`, 10, 15 * 60 * 1000);
    if (!rateCheck.allowed) {
      throw new Error(`Too many verification attempts. Please retry after ${rateCheck.retryAfterSeconds} seconds.`);
    }

    const tokenHash = hashToken(rawVerifyToken);
    const sessionToken = generateSecureToken(32);
    const sessionTokenHash = hashToken(sessionToken);
    const sessionExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    let activeUser: { id: string; email: string; fullName: string; role: string };

    await prisma.$transaction(async (tx) => {
      // 1. Atomically consume verification token using conditional update to prevent race conditions
      const updateResult = await tx.emailVerificationToken.updateMany({
        where: {
          tokenHash,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { usedAt: new Date() },
      });

      if (updateResult.count === 0) {
        throw new Error('Email verification link is invalid or has expired.');
      }

      const token = await tx.emailVerificationToken.findUniqueOrThrow({
        where: { tokenHash },
      });

      // 2. Activate user
      const user = await tx.user.update({
        where: { id: token.userId },
        data: {
          status: 'ACTIVE',
          emailVerifiedAt: new Date(),
        },
      });

      activeUser = {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      };

      // 3. Create database-backed session
      await tx.session.create({
        data: {
          userId: user.id,
          sessionTokenHash,
          ipAddress,
          userAgent,
          expiresAt: sessionExpiresAt,
        },
      });
    });

    return { sessionToken, user: activeUser! };
  }

  /**
   * Resend email verification link.
   * Invalidates previous unused tokens for the user without creating duplicate records.
   */
  async resendVerificationEmail(email: string, ipAddress: string = '127.0.0.1'): Promise<{ message: string }> {
    const rateCheck = await checkRateLimit(`email:${email.trim().toLowerCase()}:resend_verify`, 3, 60 * 60 * 1000);
    if (!rateCheck.allowed) {
      throw new Error(`Too many resend requests. Please retry in ${rateCheck.retryAfterSeconds} seconds.`);
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || user.status !== 'PENDING_VERIFICATION') {
      // Safe response to prevent enumeration
      return { message: 'If an unverified account exists for this email, a new verification link has been sent.' };
    }

    const rawVerifyToken = generateSecureToken(32);
    const tokenHash = hashToken(rawVerifyToken);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.$transaction(async (tx) => {
      // Invalidate existing unused tokens for this user
      await tx.emailVerificationToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { expiresAt: new Date() },
      });

      // Insert new token
      await tx.emailVerificationToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
        },
      });
    });

    await this.emailDispatcher.sendVerificationEmail(normalizedEmail, rawVerifyToken, user.fullName);
    return { message: 'If an unverified account exists for this email, a new verification link has been sent.' };
  }

  /**
   * User login with database-backed session creation.
   * Enforces account status checks and rate limiting.
   */
  async login(
    email: string,
    password: string,
    ipAddress: string = '127.0.0.1',
    userAgent?: string
  ): Promise<{ sessionToken: string; user: { id: string; email: string; fullName: string; role: string } }> {
    const normalizedEmail = email.trim().toLowerCase();

    // Rate limiting: 5 failed attempts per 15 minutes per email/IP
    const rateCheck = await checkRateLimit(`login:${normalizedEmail}:${ipAddress}`, 5, 15 * 60 * 1000);
    if (!rateCheck.allowed) {
      throw new Error(`Too many login attempts. Please retry after ${rateCheck.retryAfterSeconds} seconds.`);
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || !user.passwordHash) {
      throw new Error('Invalid email or password.');
    }

    if (user.status === 'SUSPENDED') {
      throw new Error('Account has been suspended by administration. Please contact gym staff.');
    }

    if (user.status === 'PENDING_VERIFICATION') {
      throw new Error('Email address is pending verification. Please check your inbox and verify your email to activate your account.');
    }

    if (user.status === 'INVITED') {
      throw new Error('Invitation has not yet been claimed. Please use your activation link.');
    }

    const isValid = await comparePassword(password, user.passwordHash);
    if (!isValid) {
      throw new Error('Invalid email or password.');
    }

    const sessionToken = generateSecureToken(32);
    const sessionTokenHash = hashToken(sessionToken);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await prisma.session.create({
      data: {
        userId: user.id,
        sessionTokenHash,
        ipAddress,
        userAgent,
        expiresAt,
      },
    });

    return {
      sessionToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
    };
  }

  /**
   * User logout: Revokes the session row.
   */
  async logout(sessionToken: string): Promise<void> {
    const sessionTokenHash = hashToken(sessionToken);
    await prisma.session.updateMany({
      where: { sessionTokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Validates a session token.
   * Immediately rejects and revokes if the user is suspended.
   */
  async validateSession(sessionToken: string): Promise<{
    session: { id: string; userId: string; expiresAt: Date };
    user: { id: string; email: string; fullName: string; role: string; status: string };
  } | null> {
    const sessionTokenHash = hashToken(sessionToken);
    const session = await prisma.session.findUnique({
      where: { sessionTokenHash },
      include: { user: true },
    });

    if (!session || session.revokedAt !== null || session.expiresAt <= new Date()) {
      return null;
    }

    // Immediate suspension lockout: Revoke all sessions if user is suspended
    if (session.user.status === 'SUSPENDED') {
      await prisma.session.updateMany({
        where: { userId: session.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return null;
    }

    if (session.user.status !== 'ACTIVE') {
      return null;
    }

    return {
      session: {
        id: session.id,
        userId: session.userId,
        expiresAt: session.expiresAt,
      },
      user: {
        id: session.user.id,
        email: session.user.email,
        fullName: session.user.fullName,
        role: session.user.role,
        status: session.user.status,
      },
    };
  }

  /**
   * Password reset request: Anti-enumeration defense.
   */
  async requestPasswordReset(email: string, ipAddress: string = '127.0.0.1'): Promise<{ message: string }> {
    const rateCheck = await checkRateLimit(`forgot:${ipAddress}`, 3, 60 * 60 * 1000);
    if (!rateCheck.allowed) {
      throw new Error(`Too many password reset requests. Please retry in ${rateCheck.retryAfterSeconds} seconds.`);
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (user && user.status === 'ACTIVE') {
      const rawResetToken = generateSecureToken(32);
      const tokenHash = hashToken(rawResetToken);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await prisma.$transaction(async (tx) => {
        // Invalidate previous unused reset tokens
        await tx.passwordResetToken.updateMany({
          where: { userId: user.id, usedAt: null },
          data: { expiresAt: new Date() },
        });

        await tx.passwordResetToken.create({
          data: {
            userId: user.id,
            tokenHash,
            expiresAt,
          },
        });
      });

      await this.emailDispatcher.sendPasswordResetEmail(normalizedEmail, rawResetToken, user.fullName);
    }

    // Anti-enumeration: Identical message whether account exists or not
    return { message: 'If an account is associated with this email, a password reset link has been dispatched.' };
  }

  /**
   * Complete password reset: Updates password and revokes all active sessions for the user.
   */
  async resetPassword(rawResetToken: string, newPassword: string): Promise<{ message: string }> {
    const tokenHash = hashToken(rawResetToken);

    await prisma.$transaction(async (tx) => {
      // 1. Atomically consume reset token using conditional update to prevent race conditions
      const updateResult = await tx.passwordResetToken.updateMany({
        where: {
          tokenHash,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { usedAt: new Date() },
      });

      if (updateResult.count === 0) {
        throw new Error('Password reset link is invalid or has expired.');
      }

      const token = await tx.passwordResetToken.findUniqueOrThrow({
        where: { tokenHash },
      });

      const passwordHash = await hashPassword(newPassword);

      // 2. Update user's password
      await tx.user.update({
        where: { id: token.userId },
        data: { passwordHash },
      });

      // 3. Revoke all active sessions across all devices
      await tx.session.updateMany({
        where: { userId: token.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });

    return { message: 'Password has been successfully reset. Please log in with your new password.' };
  }

  /**
   * Allows an authenticated user to update their password from their profile.
   * Verifies current password, validates new password, and updates the user record.
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.passwordHash) {
      throw new Error('User not found.');
    }

    const isMatch = await comparePassword(currentPassword, user.passwordHash);
    if (!isMatch) {
      throw new Error('Current password is incorrect.');
    }

    if (newPassword.length < 8) {
      throw new Error('New password must be at least 8 characters long.');
    }

    const newHash = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });
  }
}

export const authService = new AuthService();
