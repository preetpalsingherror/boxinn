import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server.js';
import { prisma } from '../../src/infrastructure/db/client.ts';
import { authService } from '../../src/application/services/auth-service.ts';
import { defaultEmailDispatcher, InMemoryEmailDispatcher } from '../../src/infrastructure/email/email-dispatcher.ts';
import { POST as claimHandler } from '../../src/app/api/auth/invitation/claim/route.ts';
import { POST as verifyHandler } from '../../src/app/api/auth/verify-email/route.ts';
import { POST as loginHandler } from '../../src/app/api/auth/login/route.ts';
import { POST as logoutHandler } from '../../src/app/api/auth/logout/route.ts';
import { GET as meHandler } from '../../src/app/api/auth/me/route.ts';
import { requireAdmin } from '../../src/presentation/security/auth-guard.ts';
import { SESSION_COOKIE_NAME, CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '../../src/presentation/security/cookie-service.ts';

describe('Integration: HTTP Authentication, Cookies, CSRF, and Route Guards', () => {
  let adminId: string;
  const testEmail = 'http.test@boxinn.local';
  let rawInviteToken: string;
  let testSessionCookie = '';
  let testCsrfToken = '';

  before(async () => {
    // Clear dispatcher
    if (defaultEmailDispatcher instanceof InMemoryEmailDispatcher) {
      defaultEmailDispatcher.clear();
    }

    // Clean up test data
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

    // Clean rate limit buckets for this test
    await prisma.rateLimitBucket.deleteMany({
      where: {
        OR: [
          { key: { contains: testEmail } },
          { key: { contains: '127.0.0.199' } },
          { key: { contains: '127.0.0.198' } },
        ],
      },
    });

    const admin = await prisma.user.findFirstOrThrow({ where: { role: 'ADMIN' } });
    adminId = admin.id;

    // Generate initial invitation
    const invite = await authService.createInvitation(
      adminId,
      testEmail,
      'HTTP Member',
      '+919876543200',
      'General Training',
      '2026-10-01',
      '2026-11-30'
    );
    rawInviteToken = invite.rawInviteToken;
  });

  after(async () => {
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
  });

  it('STAGE 1 (HTTP Claim): claims invitation, validates password, sets NO session cookie', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/invitation/claim', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': '127.0.0.199',
      },
      body: JSON.stringify({
        token: rawInviteToken,
        email: testEmail,
        password: 'ValidPassword123!',
      }),
    });

    const res = await claimHandler(req);
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.email, testEmail);

    // Verify NO Set-Cookie header is issued
    assert.equal(res.headers.get('set-cookie'), null);

    // Verify user is PENDING_VERIFICATION in DB
    const user = await prisma.user.findUniqueOrThrow({ where: { email: testEmail } });
    assert.equal(user.status, 'PENDING_VERIFICATION');
    assert.equal(user.emailVerifiedAt, null);
  });

  it('STAGE 2 (HTTP Verify): consumes verification token, sets HttpOnly session cookie and CSRF cookie', async () => {
    let rawVerifyToken = '';
    if (defaultEmailDispatcher instanceof InMemoryEmailDispatcher) {
      const email = defaultEmailDispatcher.getLastEmailFor(testEmail);
      assert.notEqual(email, undefined);
      rawVerifyToken = email!.token;
    } else {
      // Fallback: look up in database
      const user = await prisma.user.findUniqueOrThrow({ where: { email: testEmail } });
      const tokenRow = await prisma.emailVerificationToken.findFirstOrThrow({
        where: { userId: user.id },
      });
      // We need raw token; in tests InMemoryEmailDispatcher is used
      assert.fail('Expected InMemoryEmailDispatcher for testing');
    }

    const req = new NextRequest('http://localhost:3000/api/auth/verify-email', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': '127.0.0.199',
      },
      body: JSON.stringify({ token: rawVerifyToken }),
    });

    const res = await verifyHandler(req);
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.user.email, testEmail);

    // Inspect Set-Cookie headers
    const setCookieHeader = res.headers.get('set-cookie');
    assert.notEqual(setCookieHeader, null);
    assert.match(setCookieHeader!, new RegExp(SESSION_COOKIE_NAME));
    assert.match(setCookieHeader!, new RegExp(CSRF_COOKIE_NAME));
    assert.match(setCookieHeader!, /HttpOnly/i);
    assert.match(setCookieHeader!, /Path=\//i);
    assert.match(setCookieHeader!, /SameSite=Lax/i);

    // Save cookies for subsequent tests
    const cookies = setCookieHeader!.split(', ');
    const sessionPart = cookies.find((c) => c.includes(SESSION_COOKIE_NAME))?.split(';')[0];
    const csrfPart = cookies.find((c) => c.includes(CSRF_COOKIE_NAME))?.split(';')[0];
    testSessionCookie = `${sessionPart}; ${csrfPart}`;
    testCsrfToken = json.data.csrfToken;
  });

  it('STAGE 3 (HTTP Me): retrieves authenticated user and membership data with session cookie', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/me', {
      method: 'GET',
      headers: {
        cookie: testSessionCookie,
      },
    });

    const res = await meHandler(req);
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.user.email, testEmail);
    assert.equal(json.data.user.status, 'ACTIVE');
    assert.equal(json.data.membership.planName, 'General Training');
    assert.equal(json.data.membership.allowed, true);
  });

  it('CSRF PROTECTION: rejects state-changing requests when CSRF token is invalid or missing', async () => {
    // Missing x-csrf-token header on state-changing logout
    const req = new NextRequest('http://localhost:3000/api/auth/logout', {
      method: 'POST',
      headers: {
        cookie: testSessionCookie, // Has session and CSRF cookie, but no x-csrf-token header!
      },
    });

    const { errorResponse } = await requireAdmin(req);
    assert.notEqual(errorResponse, undefined);
    assert.equal(errorResponse!.status, 403);
    const json = await errorResponse!.json();
    assert.match(json.error, /CSRF token/i);
  });

  it('ROLE GUARD: member user cannot access admin-only endpoints (returns 403)', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/members', {
      method: 'GET',
      headers: {
        cookie: testSessionCookie,
        [CSRF_HEADER_NAME]: testCsrfToken,
      },
    });

    const { errorResponse } = await requireAdmin(req);
    assert.notEqual(errorResponse, undefined);
    assert.equal(errorResponse!.status, 403);
    const json = await errorResponse!.json();
    assert.match(json.error, /Administrator privileges required/i);
  });

  it('STAGE 4 (HTTP Logout): revokes session in DB and clears session cookies', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/logout', {
      method: 'POST',
      headers: {
        cookie: testSessionCookie,
        [CSRF_HEADER_NAME]: testCsrfToken,
      },
    });

    const res = await logoutHandler(req);
    assert.equal(res.status, 200);

    const setCookieHeader = res.headers.get('set-cookie');
    assert.notEqual(setCookieHeader, null);
    assert.match(setCookieHeader!, /Max-Age=0/i);

    // Verify session in DB is revoked
    const user = await prisma.user.findUniqueOrThrow({ where: { email: testEmail } });
    const activeSessions = await prisma.session.count({
      where: { userId: user.id, revokedAt: null },
    });
    assert.equal(activeSessions, 0);

    // Trying to access /api/auth/me with old cookie now returns 401
    const meReq = new NextRequest('http://localhost:3000/api/auth/me', {
      method: 'GET',
      headers: {
        cookie: testSessionCookie,
      },
    });
    const meRes = await meHandler(meReq);
    assert.equal(meRes.status, 401);
  });
});
