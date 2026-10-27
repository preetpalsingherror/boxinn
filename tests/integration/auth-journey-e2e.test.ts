import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../../src/infrastructure/db/client.ts';
import { POST as loginHandler } from '../../src/app/api/auth/login/route.ts';
import { GET as meHandler } from '../../src/app/api/auth/me/route.ts';
import { GET as statsHandler } from '../../src/app/api/admin/stats/route.ts';
import { GET as historyHandler } from '../../src/app/api/attendance/history/route.ts';
import { POST as logoutHandler } from '../../src/app/api/auth/logout/route.ts';
import { NextRequest } from 'next/server.js';
import { SESSION_COOKIE_NAME, CSRF_COOKIE_NAME, parseCookies } from '../../src/presentation/security/cookie-service.ts';

describe('E2E Journey: Admin and Member Authentication & Navigation Flow', () => {
  before(async () => {
    // Clear any rate-limit buckets to ensure clean test runs
    await prisma.rateLimitBucket.deleteMany({
      where: { key: { contains: 'login' } },
    });
  });

  test('ADMIN JOURNEY: login sets valid session cookie and unlocks /admin APIs without stall', async () => {
    // 1. Submit login request as admin
    const loginReq = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': '127.0.0.1',
      },
      body: JSON.stringify({
        email: 'admin@boxinn.local',
        password: 'AdminPass123!',
      }),
    });

    const loginRes = await loginHandler(loginReq);
    assert.equal(loginRes.status, 200, 'Admin login must return 200 OK');

    const loginData = await loginRes.json();
    assert.equal(loginData.success, true);
    assert.equal(loginData.data.user.role, 'ADMIN');
    assert.equal(loginData.data.user.email, 'admin@boxinn.local');

    // 2. Extract Set-Cookie headers
    const setCookieHeader = loginRes.headers.get('set-cookie');
    assert.ok(setCookieHeader, 'Set-Cookie header must be present');
    assert.ok(setCookieHeader.includes(SESSION_COOKIE_NAME), `Cookie must contain ${SESSION_COOKIE_NAME}`);

    // Verify cookie attributes: must NOT force Secure on plain http localhost
    const cookieTokens = setCookieHeader.split(';');
    const cookieMap = parseCookies(setCookieHeader);
    const sessionToken = cookieMap[SESSION_COOKIE_NAME];
    assert.ok(sessionToken, 'Session token value must be parseable from Set-Cookie');

    // 3. Test that subsequent request to /api/auth/me succeeds with the session cookie
    const meReq = new NextRequest('http://localhost:3000/api/auth/me', {
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${sessionToken}`,
      },
    });

    const meRes = await meHandler(meReq);
    assert.equal(meRes.status, 200, '/api/auth/me must return 200 for authenticated admin');
    const meData = await meRes.json();
    assert.equal(meData.data.user.role, 'ADMIN');

    // 4. Test that admin can access protected admin statistics endpoint
    const statsReq = new NextRequest('http://localhost:3000/api/admin/stats', {
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${sessionToken}`,
      },
    });

    const statsRes = await statsHandler(statsReq);
    assert.equal(statsRes.status, 200, 'Admin must be authorized to access /api/admin/stats');
    const statsData = await statsRes.json();
    assert.ok(statsData.data.activeMembers >= 1);
  });

  test('MEMBER JOURNEY: login sets valid session cookie, accesses member portal, and is blocked from admin', async () => {
    // 1. Submit login request as member
    const loginReq = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': '127.0.0.1',
      },
      body: JSON.stringify({
        email: 'aarav@boxinn.local',
        password: 'MemberPass123!',
      }),
    });

    const loginRes = await loginHandler(loginReq);
    assert.equal(loginRes.status, 200, 'Member login must return 200 OK');

    const loginData = await loginRes.json();
    assert.equal(loginData.data.user.role, 'MEMBER');

    const setCookieHeader = loginRes.headers.get('set-cookie');
    assert.ok(setCookieHeader);
    const cookieMap = parseCookies(setCookieHeader);
    const sessionToken = cookieMap[SESSION_COOKIE_NAME];
    assert.ok(sessionToken);

    // 2. Member accesses /api/attendance/history
    const historyReq = new NextRequest('http://localhost:3000/api/attendance/history', {
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${sessionToken}`,
      },
    });

    const historyRes = await historyHandler(historyReq);
    assert.equal(historyRes.status, 200, 'Member must be authorized to view attendance history');
    const historyData = await historyRes.json();
    assert.ok(historyData.data.totalVisits >= 1);

    // 3. Member attempts to access admin endpoint -> must receive 403 Forbidden
    const statsReq = new NextRequest('http://localhost:3000/api/admin/stats', {
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${sessionToken}`,
      },
    });

    const statsRes = await statsHandler(statsReq);
    assert.equal(statsRes.status, 403, 'Member must be strictly forbidden (403) from accessing admin stats');

    // 4. Logout revokes session
    const csrfToken = cookieMap[CSRF_COOKIE_NAME];
    const logoutReq = new NextRequest('http://localhost:3000/api/auth/logout', {
      method: 'POST',
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${sessionToken}; ${CSRF_COOKIE_NAME}=${csrfToken}`,
        'x-csrf-token': csrfToken || '',
      },
    });

    const logoutRes = await logoutHandler(logoutReq);
    assert.equal(logoutRes.status, 200);

    // Verify session is no longer valid
    const postLogoutReq = new NextRequest('http://localhost:3000/api/auth/me', {
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${sessionToken}`,
      },
    });

    const postLogoutRes = await meHandler(postLogoutReq);
    assert.equal(postLogoutRes.status, 401, 'Revoked session must be rejected with 401 Unauthorized');
  });

  test('INVALID CREDENTIALS: rejects bad password without issuing session cookie', async () => {
    const loginReq = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': '127.0.0.1',
      },
      body: JSON.stringify({
        email: 'admin@boxinn.local',
        password: 'WrongPassword!',
      }),
    });

    const loginRes = await loginHandler(loginReq);
    assert.equal(loginRes.status, 401);
    const loginData = await loginRes.json();
    assert.equal(loginData.success, false);
    assert.ok(!loginRes.headers.get('set-cookie') || !loginRes.headers.get('set-cookie')?.includes(SESSION_COOKIE_NAME));
  });
});
