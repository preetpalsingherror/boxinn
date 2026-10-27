import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../../src/infrastructure/db/client.ts';
import { AuthService } from '../../src/application/services/auth-service.ts';
import { InMemoryEmailDispatcher } from '../../src/infrastructure/email/email-dispatcher.ts';

describe('Integration: Database-Backed Sessions & Revocation Security', () => {
  const emailDispatcher = new InMemoryEmailDispatcher();
  const authService = new AuthService(emailDispatcher);
  let memberId: string;
  const testEmail = 'session.test@boxinn.local';

  before(async () => {
    emailDispatcher.clear();

    // Ensure clean state before starting
    const existing = await prisma.user.findUnique({ where: { email: testEmail } });
    if (existing) {
      await prisma.session.deleteMany({ where: { userId: existing.id } });
      await prisma.emailVerificationToken.deleteMany({ where: { userId: existing.id } });
      await prisma.passwordResetToken.deleteMany({ where: { userId: existing.id } });
      await prisma.membership.deleteMany({ where: { userId: existing.id } });
      await prisma.memberStreak.deleteMany({ where: { userId: existing.id } });
      await prisma.invitation.deleteMany({ where: { email: testEmail } });
      await prisma.user.delete({ where: { id: existing.id } });
    }

    // Clear rate limit buckets for this test
    await prisma.rateLimitBucket.deleteMany({
      where: {
        OR: [
          { key: { contains: testEmail } },
          { key: { contains: '127.0.0.1' } },
          { key: { contains: '127.0.0.5' } },
        ],
      },
    });

    const admin = await prisma.user.findFirstOrThrow({ where: { role: 'ADMIN' } });

    // Create and activate user
    const { rawInviteToken } = await authService.createInvitation(
      admin.id,
      testEmail,
      'Session User',
      '+919876543277',
      'General Training',
      '2026-10-24',
      '2026-11-24'
    );
    await authService.claimInvitation(rawInviteToken, testEmail, 'Password123!', '127.0.0.1');
    const email = emailDispatcher.getLastEmailFor(testEmail);
    const verifyResult = await authService.verifyEmail(email!.token, '127.0.0.1');
    memberId = verifyResult.user.id;
  });

  after(async () => {
    const user = await prisma.user.findUnique({ where: { email: testEmail } });
    if (user) {
      await prisma.session.deleteMany({ where: { userId: user.id } });
      await prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } });
      await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
      await prisma.membership.deleteMany({ where: { userId: user.id } });
      await prisma.memberStreak.deleteMany({ where: { userId: user.id } });
      await prisma.invitation.deleteMany({ where: { email: testEmail } });
      await prisma.user.delete({ where: { id: user.id } });
    }
  });

  it('authenticates valid session token and returns active user', async () => {
    const loginResult = await authService.login(testEmail, 'Password123!', '127.0.0.1');
    const validated = await authService.validateSession(loginResult.sessionToken);

    assert.notEqual(validated, null);
    assert.equal(validated!.user.email, testEmail);
    assert.equal(validated!.user.status, 'ACTIVE');
  });

  it('LOGOUT: immediately revokes the session', async () => {
    const loginResult = await authService.login(testEmail, 'Password123!', '127.0.0.1');
    await authService.logout(loginResult.sessionToken);

    const validated = await authService.validateSession(loginResult.sessionToken);
    assert.equal(validated, null);
  });

  it('PASSWORD RESET: revokes all active sessions across all devices', async () => {
    // Member logs in on 2 devices
    const device1 = await authService.login(testEmail, 'Password123!', '127.0.0.1', 'Mobile App');
    const device2 = await authService.login(testEmail, 'Password123!', '127.0.0.1', 'Laptop');

    assert.notEqual(await authService.validateSession(device1.sessionToken), null);
    assert.notEqual(await authService.validateSession(device2.sessionToken), null);

    // Request and perform password reset
    await authService.requestPasswordReset(testEmail, '127.0.0.1');
    const resetEmail = emailDispatcher.getLastEmailFor(testEmail);
    await authService.resetPassword(resetEmail!.token, 'NewPassword456!');

    // Both previous sessions must now be revoked!
    assert.equal(await authService.validateSession(device1.sessionToken), null);
    assert.equal(await authService.validateSession(device2.sessionToken), null);

    // Member can log in with new password
    const newSession = await authService.login(testEmail, 'NewPassword456!', '127.0.0.1');
    assert.notEqual(await authService.validateSession(newSession.sessionToken), null);
  });

  it('ACCOUNT SUSPENSION: immediately revokes active sessions and blocks requests', async () => {
    // Clear rate limit bucket before suspension test
    await prisma.rateLimitBucket.deleteMany({
      where: { key: { contains: testEmail } },
    });

    const loginResult = await authService.login(testEmail, 'NewPassword456!', '127.0.0.5');
    assert.notEqual(await authService.validateSession(loginResult.sessionToken), null);

    // Administrator suspends member
    await prisma.user.update({
      where: { id: memberId },
      data: { status: 'SUSPENDED' },
    });

    // Immediate next request with cookie is rejected and session revoked
    const validated = await authService.validateSession(loginResult.sessionToken);
    assert.equal(validated, null);

    // Future login is also blocked
    await assert.rejects(
      () => authService.login(testEmail, 'NewPassword456!', '127.0.0.1'),
      /Account has been suspended/i
    );
  });

  it('PASSWORD RESET REJECTION: rejects already-used, expired, and tampered reset tokens', async () => {
    // Reactivate user for password reset test
    await prisma.user.update({
      where: { id: memberId },
      data: { status: 'ACTIVE' },
    });

    // Clear rate limits
    await prisma.rateLimitBucket.deleteMany({
      where: {
        OR: [
          { key: { contains: testEmail } },
          { key: { contains: '127.0.0.70' } },
        ],
      },
    });

    await authService.requestPasswordReset(testEmail, '127.0.0.70');
    const resetEmail = emailDispatcher.getLastEmailFor(testEmail);
    assert.notEqual(resetEmail, undefined);
    const validRawToken = resetEmail!.token;

    // 1. Unknown / tampered token rejected
    await assert.rejects(
      () => authService.resetPassword(validRawToken + 'tampered', 'ValidPass789!'),
      /invalid or has expired/i
    );

    // 2. Expired token rejected
    const { hashToken } = await import('../../src/infrastructure/security/token-service.ts');
    const tokenHash = hashToken(validRawToken);

    await prisma.passwordResetToken.update({
      where: { tokenHash },
      data: { expiresAt: new Date(Date.now() - 5000) },
    });

    await assert.rejects(
      () => authService.resetPassword(validRawToken, 'ValidPass789!'),
      /invalid or has expired/i
    );

    // Restore unexpired
    await prisma.passwordResetToken.update({
      where: { tokenHash },
      data: { expiresAt: new Date(Date.now() + 60000), usedAt: null },
    });

    // 3. Successful reset
    const result = await authService.resetPassword(validRawToken, 'ValidPass789!');
    assert.match(result.message, /successfully reset/i);

    // 4. Reusing already-used token rejected
    await assert.rejects(
      () => authService.resetPassword(validRawToken, 'AnotherPass999!'),
      /invalid or has expired/i
    );
  });

  it('CONCURRENCY: 2 concurrent attempts to reset password with the same token yields exactly 1 success', async () => {
    // Clear rate limits
    await prisma.rateLimitBucket.deleteMany({
      where: {
        OR: [
          { key: { contains: testEmail } },
          { key: { contains: '127.0.0.71' } },
        ],
      },
    });

    await authService.requestPasswordReset(testEmail, '127.0.0.71');
    const resetEmail = emailDispatcher.getLastEmailFor(testEmail);
    const validRawToken = resetEmail!.token;

    // 2 concurrent reset attempts
    const attempts = [
      authService.resetPassword(validRawToken, 'ConcurrentPassA1!'),
      authService.resetPassword(validRawToken, 'ConcurrentPassB2!'),
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
  });
});
