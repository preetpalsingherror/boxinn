import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../../src/infrastructure/db/client.ts';
import { AuthService } from '../../src/application/services/auth-service.ts';
import { InMemoryEmailDispatcher } from '../../src/infrastructure/email/email-dispatcher.ts';

describe('Integration: Two-Stage Invitation & Genuine Email Verification', () => {
  const emailDispatcher = new InMemoryEmailDispatcher();
  const authService = new AuthService(emailDispatcher);
  let adminId: string;

  before(async () => {
    emailDispatcher.clear();

    // Clean up test rate limit buckets for hermetic test execution
    await prisma.rateLimitBucket.deleteMany({
      where: {
        OR: [
          { key: { contains: 'rohan.test@boxinn.local' } },
          { key: { contains: 'concurrent.test@boxinn.local' } },
          { key: { contains: 'claim_invitation' } },
          { key: { contains: 'verify_email' } },
          { key: { contains: '127.0.0.1' } },
        ],
      },
    });

    const admin = await prisma.user.findFirstOrThrow({
      where: { role: 'ADMIN' },
    });
    adminId = admin.id;
  });

  after(async () => {
    // Clean up test records respecting RESTRICT constraints
    const emails = [
      'rohan.test@boxinn.local',
      'concurrent.test@boxinn.local',
      'verify.reject@boxinn.local',
      'verify.race@boxinn.local',
    ];
    for (const email of emails) {
      const user = await prisma.user.findUnique({ where: { email } });
      if (user) {
        await prisma.attendanceRecord.deleteMany({ where: { userId: user.id } });
        await prisma.membership.deleteMany({ where: { userId: user.id } });
        await prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } });
        await prisma.session.deleteMany({ where: { userId: user.id } });
        await prisma.memberStreak.deleteMany({ where: { userId: user.id } });
        await prisma.invitation.deleteMany({ where: { email } });
        await prisma.user.delete({ where: { id: user.id } });
      }
    }
  });

  it('STAGE 1 & 2: Admin invites member, member claims with password -> PENDING_VERIFICATION', async () => {
    const testEmail = 'rohan.test@boxinn.local';

    // 1. Admin creates invitation
    const { rawInviteToken } = await authService.createInvitation(
      adminId,
      testEmail,
      'Rohan Test',
      '+919876543299',
      'General Training',
      '2026-10-24',
      '2026-11-24'
    );

    // Verify staged User is INVITED
    const stagedUser = await prisma.user.findUniqueOrThrow({
      where: { email: testEmail },
    });
    assert.equal(stagedUser.status, 'INVITED');
    assert.equal(stagedUser.emailVerifiedAt, null);

    // 2. Member claims invitation with new password
    const claimResult = await authService.claimInvitation(
      rawInviteToken,
      testEmail,
      'SecurePass123!',
      '127.0.0.1'
    );
    assert.match(claimResult.message, /verification email has been sent/i);

    // Verify User transitioned to PENDING_VERIFICATION (not ACTIVE)
    const pendingUser = await prisma.user.findUniqueOrThrow({
      where: { email: testEmail },
    });
    assert.equal(pendingUser.status, 'PENDING_VERIFICATION');
    assert.equal(pendingUser.emailVerifiedAt, null);
    assert.notEqual(pendingUser.passwordHash, null);

    // Member CANNOT log in while PENDING_VERIFICATION
    await assert.rejects(
      () => authService.login(testEmail, 'SecurePass123!', '127.0.0.1'),
      /pending verification/i
    );

    // Verify email dispatcher received the verification email
    const dispatched = emailDispatcher.getLastEmailFor(testEmail);
    assert.notEqual(dispatched, undefined);
    assert.match(dispatched!.subject, /Verify your email/i);
    assert.notEqual(dispatched!.token, undefined);

    // 3. STAGE 3: Member verifies email
    const rawVerifyToken = dispatched!.token;
    const verifyResult = await authService.verifyEmail(rawVerifyToken, '127.0.0.1');

    assert.equal(verifyResult.user.email, testEmail);
    assert.notEqual(verifyResult.sessionToken, null);

    // Verify User is now strictly ACTIVE with emailVerifiedAt timestamp
    const activeUser = await prisma.user.findUniqueOrThrow({
      where: { email: testEmail },
    });
    assert.equal(activeUser.status, 'ACTIVE');
    assert.notEqual(activeUser.emailVerifiedAt, null);

    // Member can now log in successfully
    const loginResult = await authService.login(testEmail, 'SecurePass123!', '127.0.0.1');
    assert.equal(loginResult.user.email, testEmail);
    assert.notEqual(loginResult.sessionToken, null);
  });

  it('RESEND: invalidates prior unused verification token without duplicating records', async () => {
    const testEmail = 'rohan.test@boxinn.local';

    // Temporarily set back to PENDING_VERIFICATION to test resend
    await prisma.user.update({
      where: { email: testEmail },
      data: { status: 'PENDING_VERIFICATION', emailVerifiedAt: null },
    });

    // Request resend
    await authService.resendVerificationEmail(testEmail, '127.0.0.1');

    // Exactly one User and Membership should exist
    const userCount = await prisma.user.count({ where: { email: testEmail } });
    const membershipCount = await prisma.membership.count({
      where: { user: { email: testEmail } },
    });
    assert.equal(userCount, 1);
    assert.equal(membershipCount, 1);

    // Check tokens: previous token expired, fresh token active
    const activeTokens = await prisma.emailVerificationToken.count({
      where: { user: { email: testEmail }, usedAt: null, expiresAt: { gt: new Date() } },
    });
    assert.equal(activeTokens, 1);
  });

  it('CONCURRENCY: 5 simultaneous claims on the same invitation token yields exactly 1 success', async () => {
    const concurrentEmail = 'concurrent.test@boxinn.local';
    const { rawInviteToken } = await authService.createInvitation(
      adminId,
      concurrentEmail,
      'Concurrent Member',
      '+919876543288',
      'General Training',
      '2026-10-24',
      '2026-11-24'
    );

    // 5 concurrent claim requests from distinct client IPs
    const attempts = Array.from({ length: 5 }).map((_, idx) =>
      authService
        .claimInvitation(rawInviteToken, concurrentEmail, 'Pass12345!', `127.0.0.${idx + 10}`)
        .then(() => 'success')
        .catch((e: Error) => e.message)
    );

    const results = await Promise.all(attempts);
    const successCount = results.filter((r) => r === 'success').length;
    const failureCount = results.filter((r) => /invalid, expired, or has already been claimed/i.test(r)).length;

    assert.equal(successCount, 1);
    assert.equal(failureCount, 4);

    // Verify invitation is CLAIMED
    const invitation = await prisma.invitation.findFirstOrThrow({
      where: { email: concurrentEmail },
    });
    assert.equal(invitation.status, 'CLAIMED');
  });

  it('VERIFICATION REJECTION: rejects expired, already-used, unknown, and tampered tokens', async () => {
    const testEmail = 'verify.reject@boxinn.local';
    const { rawInviteToken } = await authService.createInvitation(
      adminId,
      testEmail,
      'Reject Member',
      '+919876543266',
      'General Training',
      '2026-10-24',
      '2026-11-24'
    );

    await authService.claimInvitation(rawInviteToken, testEmail, 'Pass123456!', '127.0.0.50');
    const dispatched = emailDispatcher.getLastEmailFor(testEmail);
    assert.notEqual(dispatched, undefined);
    const validRawToken = dispatched!.token;

    // 1. Unknown / nonexistent token rejected
    await assert.rejects(
      () => authService.verifyEmail('nonexistent-raw-token-1234567890abcdef', '127.0.0.51'),
      /invalid or has expired/i
    );

    // 2. Tampered token rejected
    await assert.rejects(
      () => authService.verifyEmail(validRawToken + 'x', '127.0.0.52'),
      /invalid or has expired/i
    );

    // 3. Expired token rejected
    const { hashToken } = await import('../../src/infrastructure/security/token-service.ts');
    const tokenHash = hashToken(validRawToken);

    await prisma.emailVerificationToken.update({
      where: { tokenHash },
      data: { expiresAt: new Date(Date.now() - 5000) }, // Expired 5 seconds ago
    });

    await assert.rejects(
      () => authService.verifyEmail(validRawToken, '127.0.0.53'),
      /invalid or has expired/i
    );

    // Restore valid expiry to test successful use + already-used rejection
    await prisma.emailVerificationToken.update({
      where: { tokenHash },
      data: { expiresAt: new Date(Date.now() + 60000), usedAt: null },
    });

    // 4. Successful verification
    const verified = await authService.verifyEmail(validRawToken, '127.0.0.54');
    assert.equal(verified.user.email, testEmail);

    // 5. Already-used token rejected on second attempt
    await assert.rejects(
      () => authService.verifyEmail(validRawToken, '127.0.0.55'),
      /invalid or has expired/i
    );
  });

  it('CONCURRENCY: 2 concurrent attempts to redeem the same verification token yields exactly 1 success', async () => {
    const testEmail = 'verify.race@boxinn.local';
    const { rawInviteToken } = await authService.createInvitation(
      adminId,
      testEmail,
      'Race Member',
      '+919876543255',
      'General Training',
      '2026-10-24',
      '2026-11-24'
    );

    await authService.claimInvitation(rawInviteToken, testEmail, 'Pass123456!', '127.0.0.60');
    const dispatched = emailDispatcher.getLastEmailFor(testEmail);
    const validRawToken = dispatched!.token;

    // 2 simultaneous verification attempts
    const attempts = [
      authService.verifyEmail(validRawToken, '127.0.0.61'),
      authService.verifyEmail(validRawToken, '127.0.0.62'),
    ];

    const results = await Promise.allSettled(attempts);
    const successes = results.filter((r) => r.status === 'fulfilled');
    const failures = results.filter((r) => r.status === 'rejected');

    assert.equal(successes.length, 1);
    assert.equal(failures.length, 1);
    assert.match(
      (failures[0] as PromiseRejectedResult).reason.message,
      /invalid or has expired/i
    );

    // Verify user is active with exactly 1 session
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: testEmail },
      include: { sessions: true },
    });
    assert.equal(user.status, 'ACTIVE');
    assert.equal(user.sessions.length, 1);
  });
});
