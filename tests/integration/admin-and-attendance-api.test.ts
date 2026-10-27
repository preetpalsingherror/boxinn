import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server.js';
import { prisma } from '../../src/infrastructure/db/client.ts';
import { authService } from '../../src/application/services/auth-service.ts';
import { POST as checkInHandler } from '../../src/app/api/attendance/check-in/route.ts';
import { GET as historyHandler } from '../../src/app/api/attendance/history/route.ts';
import { GET as machinesHandler } from '../../src/app/api/machines/route.ts';
import { GET as machineDetailHandler } from '../../src/app/api/machines/[code]/route.ts';
import { GET as announcementsHandler, POST as createAnnouncementHandler } from '../../src/app/api/announcements/route.ts';
import { GET as adminMembersHandler } from '../../src/app/api/admin/members/route.ts';
import { POST as adminInviteHandler } from '../../src/app/api/admin/invitations/route.ts';
import { POST as adminMembershipActionHandler } from '../../src/app/api/admin/memberships/action/route.ts';
import { POST as adminAttendanceCorrectHandler } from '../../src/app/api/admin/attendance/correct/route.ts';
import { GET as adminStatsHandler } from '../../src/app/api/admin/stats/route.ts';
import { GET as healthHandler } from '../../src/app/api/health/route.ts';
import { POST as cronReconcileHandler } from '../../src/app/api/cron/reconcile/route.ts';
import { SESSION_COOKIE_NAME, CSRF_COOKIE_NAME, CSRF_HEADER_NAME, setAuthCookies } from '../../src/presentation/security/cookie-service.ts';
import { hashPassword } from '../../src/infrastructure/security/password-service.ts';

describe('Integration: Member & Admin API Endpoints, Workflows, and Health', () => {
  let memberSessionCookie = '';
  let memberCsrfToken = '';
  let memberId = '';
  const memberEmail = 'api.member@boxinn.local';

  let adminSessionCookie = '';
  let adminCsrfToken = '';
  let adminId = '';

  before(async () => {
    // 1. Clean up member if existing
    const existing = await prisma.user.findUnique({ where: { email: memberEmail } });
    if (existing) {
      await prisma.attendanceCorrection.deleteMany({ where: { attendanceRecord: { userId: existing.id } } });
      await prisma.attendanceRecord.deleteMany({ where: { userId: existing.id } });
      await prisma.membershipAudit.deleteMany({ where: { membership: { userId: existing.id } } });
      await prisma.membership.deleteMany({ where: { userId: existing.id } });
      await prisma.session.deleteMany({ where: { userId: existing.id } });
      await prisma.memberStreak.deleteMany({ where: { userId: existing.id } });
      await prisma.user.delete({ where: { id: existing.id } });
    }

    // 2. Load admin and create session
    const admin = await prisma.user.findFirstOrThrow({ where: { role: 'ADMIN' } });
    adminId = admin.id;

    const adminLogin = await authService.login(admin.email, 'AdminPass123!', '127.0.0.1');
    const adminHeaders = new Headers();
    adminCsrfToken = setAuthCookies(adminHeaders, adminLogin.sessionToken);
    const adminCookie = adminHeaders.get('set-cookie')!;
    const adminSessionPart = adminCookie.split(', ').find((c) => c.includes(SESSION_COOKIE_NAME))?.split(';')[0];
    const adminCsrfPart = adminCookie.split(', ').find((c) => c.includes(CSRF_COOKIE_NAME))?.split(';')[0];
    adminSessionCookie = `${adminSessionPart}; ${adminCsrfPart}`;

    // 3. Create active member with active membership and streak
    const member = await prisma.user.create({
      data: {
        email: memberEmail,
        fullName: 'API Test Member',
        status: 'ACTIVE',
        role: 'MEMBER',
        passwordHash: await hashPassword('MemberPass123!'),
        emailVerifiedAt: new Date(),
        memberships: {
          create: {
            planName: 'General Training',
            startDate: '2026-10-01',
            expiryDate: '2026-11-30',
            status: 'ACTIVE',
          },
        },
        streak: {
          create: { currentStreak: 2, longestStreak: 5, lastAttendanceDate: '2026-10-23' },
        },
      },
    });
    memberId = member.id;

    // Issue session for member
    const memberLogin = await authService.login(memberEmail, 'MemberPass123!', '127.0.0.1');
    const memberHeaders = new Headers();
    memberCsrfToken = setAuthCookies(memberHeaders, memberLogin.sessionToken);
    const memberCookie = memberHeaders.get('set-cookie')!;
    const memberSessionPart = memberCookie.split(', ').find((c) => c.includes(SESSION_COOKIE_NAME))?.split(';')[0];
    const memberCsrfPart = memberCookie.split(', ').find((c) => c.includes(CSRF_COOKIE_NAME))?.split(';')[0];
    memberSessionCookie = `${memberSessionPart}; ${memberCsrfPart}`;
  });

  after(async () => {
    const existing = await prisma.user.findUnique({ where: { email: memberEmail } });
    if (existing) {
      await prisma.attendanceCorrection.deleteMany({ where: { attendanceRecord: { userId: existing.id } } });
      await prisma.attendanceRecord.deleteMany({ where: { userId: existing.id } });
      await prisma.membershipAudit.deleteMany({ where: { membership: { userId: existing.id } } });
      await prisma.membership.deleteMany({ where: { userId: existing.id } });
      await prisma.session.deleteMany({ where: { userId: existing.id } });
      await prisma.memberStreak.deleteMany({ where: { userId: existing.id } });
      await prisma.user.delete({ where: { id: existing.id } });
    }
  });

  it('HEALTH: GET /api/health returns database connectivity, timezone, and gym date', async () => {
    const res = await healthHandler();
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.status, 'healthy');
    assert.equal(json.data.timezone, 'Asia/Kolkata');
    assert.equal(json.data.database.connected, true);
  });

  it('CHECK-IN: member performs entrance check-in and receives streak update', async () => {
    const req = new NextRequest('http://localhost:3000/api/attendance/check-in', {
      method: 'POST',
      headers: {
        cookie: memberSessionCookie,
        [CSRF_HEADER_NAME]: memberCsrfToken,
      },
    });

    const res = await checkInHandler(req);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.isDuplicate, false);
    assert.match(json.data.message, /welcome to box inn/i);
    assert.equal(json.data.streak.currentStreak, 3); // 2 -> 3
  });

  it('DUPLICATE CHECK-IN: second scan delivers friendly message without duplicate entry', async () => {
    const req = new NextRequest('http://localhost:3000/api/attendance/check-in', {
      method: 'POST',
      headers: {
        cookie: memberSessionCookie,
        [CSRF_HEADER_NAME]: memberCsrfToken,
      },
    });

    const res = await checkInHandler(req);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.isDuplicate, true);
    assert.match(json.data.message, /already checked in today/i);
  });

  it('HISTORY: GET /api/attendance/history returns chronological history and live streak', async () => {
    const req = new NextRequest('http://localhost:3000/api/attendance/history', {
      method: 'GET',
      headers: { cookie: memberSessionCookie },
    });

    const res = await historyHandler(req);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.checkedInToday, true);
    assert.ok(json.data.totalVisits >= 1);
    assert.equal(json.data.streak.currentStreak, 3);
  });

  it('MACHINES: GET /api/machines & /api/machines/M-ROW-01 return equipment guides', async () => {
    // List machines
    const listReq = new NextRequest('http://localhost:3000/api/machines', {
      method: 'GET',
      headers: { cookie: memberSessionCookie },
    });
    const listRes = await machinesHandler(listReq);
    assert.equal(listRes.status, 200);
    const listJson = await listRes.json();
    assert.ok(listJson.data.length >= 1);

    // Detail machine
    const detailReq = new NextRequest('http://localhost:3000/api/machines/M-ROW-01', {
      method: 'GET',
      headers: { cookie: memberSessionCookie },
    });
    const detailRes = await machineDetailHandler(detailReq, {
      params: Promise.resolve({ code: 'M-ROW-01' }),
    });
    assert.equal(detailRes.status, 200);
    const detailJson = await detailRes.json();
    assert.equal(detailJson.data.code, 'M-ROW-01');
    assert.ok(detailJson.data.exercises.length >= 1);
  });

  it('ANNOUNCEMENTS: member views announcements; admin creates new announcement', async () => {
    // Member reads
    const getReq = new NextRequest('http://localhost:3000/api/announcements', {
      method: 'GET',
      headers: { cookie: memberSessionCookie },
    });
    const getRes = await announcementsHandler(getReq);
    assert.equal(getRes.status, 200);
    const getJson = await getRes.json();
    assert.ok(Array.isArray(getJson.data));

    // Admin creates
    const postReq = new NextRequest('http://localhost:3000/api/announcements', {
      method: 'POST',
      headers: {
        cookie: adminSessionCookie,
        [CSRF_HEADER_NAME]: adminCsrfToken,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        title: 'New HYROX Sleds Arrived',
        content: 'Two brand new competition-weight HYROX sleds are now active on the turf.',
        isUrgent: false,
      }),
    });
    const postRes = await createAnnouncementHandler(postReq);
    assert.equal(postRes.status, 201);
    const postJson = await postRes.json();
    assert.equal(postJson.data.title, 'New HYROX Sleds Arrived');
  });

  it('ADMIN MEMBERS: lists members with membership status and visit metrics', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/members?search=API+Test', {
      method: 'GET',
      headers: { cookie: adminSessionCookie },
    });
    const res = await adminMembersHandler(req);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.data.length, 1);
    assert.equal(json.data[0].email, memberEmail);
    assert.equal(json.data[0].membership.planName, 'General Training');
  });

  it('ADMIN MEMBERSHIP ACTION: admin renews membership and records audit log', async () => {
    const member = await prisma.user.findUniqueOrThrow({
      where: { email: memberEmail },
      include: { memberships: true },
    });
    const membershipId = member.memberships[0].id;

    const req = new NextRequest('http://localhost:3000/api/admin/memberships/action', {
      method: 'POST',
      headers: {
        cookie: adminSessionCookie,
        [CSRF_HEADER_NAME]: adminCsrfToken,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        membershipId,
        action: 'RENEW',
        newExpiryDate: '2026-12-31',
        reason: 'Member renewed for an additional month at front desk.',
      }),
    });

    const res = await adminMembershipActionHandler(req);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.data.membership.expiryDate, '2026-12-31');

    // Verify audit entry exists
    const audit = await prisma.membershipAudit.findFirstOrThrow({
      where: { membershipId },
      orderBy: { createdAt: 'desc' },
    });
    assert.equal(audit.action, 'RENEW');
    assert.match(audit.reason, /renewed for an additional month/i);
  });

  it('ADMIN STATS: GET /api/admin/stats returns gym attendance and member counts', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/stats', {
      method: 'GET',
      headers: { cookie: adminSessionCookie },
    });
    const res = await adminStatsHandler(req);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.ok(json.data.activeMembers >= 1);
    assert.ok(json.data.todayAttendance >= 1);
  });

  it('CRON RECONCILE: POST /api/cron/reconcile runs auto-closure and rate limit cleanup', async () => {
    const req = new NextRequest('http://localhost:3000/api/cron/reconcile', {
      method: 'POST',
      headers: {
        cookie: adminSessionCookie,
        [CSRF_HEADER_NAME]: adminCsrfToken,
      },
    });
    const res = await cronReconcileHandler(req);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(typeof json.data.reconciledOverdueSessions === 'number');
    assert.ok(typeof json.data.cleanedExpiredRateLimits === 'number');
  });
});
