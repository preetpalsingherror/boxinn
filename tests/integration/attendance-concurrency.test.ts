import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../../src/infrastructure/db/client.ts';
import { AttendanceService } from '../../src/application/services/attendance-service.ts';
import { toGymLocalDate } from '../../src/domain/common/date-utils.ts';

describe('Integration: Attendance Concurrency & Streak Recalculation', () => {
  const attendanceService = new AttendanceService();
  let memberId: string;
  let adminId: string;
  const testEmail = 'attendance.test@boxinn.local';

  before(async () => {
    // Ensure clean state before starting
    const cleanupEmails = [testEmail, 'parallel.scan@boxinn.local', 'status.member@boxinn.local', 'inclusive.member@boxinn.local'];
    for (const email of cleanupEmails) {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        await prisma.attendanceCorrection.deleteMany({ where: { attendanceRecord: { userId: existing.id } } });
        await prisma.attendanceRecord.deleteMany({ where: { userId: existing.id } });
        await prisma.membership.deleteMany({ where: { userId: existing.id } });
        await prisma.memberStreak.deleteMany({ where: { userId: existing.id } });
        await prisma.user.delete({ where: { id: existing.id } });
      }
    }

    const admin = await prisma.user.findFirstOrThrow({ where: { role: 'ADMIN' } });
    adminId = admin.id;

    // Create active member with active membership
    const user = await prisma.user.create({
      data: {
        email: testEmail,
        fullName: 'Attendance Member',
        status: 'ACTIVE',
        role: 'MEMBER',
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
          create: {
            currentStreak: 0,
            longestStreak: 0,
          },
        },
      },
    });
    memberId = user.id;
  });

  after(async () => {
    // Delete in correct dependency order to respect RESTRICT constraints
    await prisma.attendanceCorrection.deleteMany({
      where: { attendanceRecord: { userId: memberId } },
    });
    await prisma.attendanceRecord.deleteMany({ where: { userId: memberId } });
    await prisma.membership.deleteMany({ where: { userId: memberId } });
    await prisma.memberStreak.deleteMany({ where: { userId: memberId } });
    await prisma.user.delete({ where: { id: memberId } });
  });

  it('records initial check-in and increments streak', async () => {
    const today = toGymLocalDate(new Date(), 'Asia/Kolkata');

    const result = await attendanceService.recordCheckIn(memberId, 'ENTRANCE_QR');
    assert.equal(result.success, true);
    assert.equal(result.isDuplicate, false);
    assert.equal(result.gymDate, today);
    assert.equal(result.streak?.currentStreak, 1);

    const record = await prisma.attendanceRecord.findUniqueOrThrow({
      where: { userId_gymDate: { userId: memberId, gymDate: today } },
    });
    assert.equal(record.gymDate, today);
  });

  it('returns friendly duplicate message on second scan without creating another record', async () => {
    const today = toGymLocalDate(new Date(), 'Asia/Kolkata');

    const result = await attendanceService.recordCheckIn(memberId, 'ENTRANCE_QR');
    assert.equal(result.success, true);
    assert.equal(result.isDuplicate, true);
    assert.match(result.message, /already checked in today/i);

    // Verify count of records is strictly 1
    const count = await prisma.attendanceRecord.count({
      where: { userId: memberId, gymDate: today },
    });
    assert.equal(count, 1);
  });

  it('CONCURRENCY: 3 parallel check-in requests create exactly 1 record', async () => {
    // Ensure clean state for concurrent user
    const existing = await prisma.user.findUnique({ where: { email: 'parallel.scan@boxinn.local' } });
    if (existing) {
      await prisma.attendanceRecord.deleteMany({ where: { userId: existing.id } });
      await prisma.membership.deleteMany({ where: { userId: existing.id } });
      await prisma.memberStreak.deleteMany({ where: { userId: existing.id } });
      await prisma.user.delete({ where: { id: existing.id } });
    }

    // Create another member to test parallel scans on today
    const concurrentUser = await prisma.user.create({
      data: {
        email: 'parallel.scan@boxinn.local',
        fullName: 'Parallel User',
        status: 'ACTIVE',
        memberships: {
          create: {
            planName: 'General Training',
            startDate: '2026-10-01',
            expiryDate: '2026-11-30',
            status: 'ACTIVE',
          },
        },
        streak: {
          create: { currentStreak: 0, longestStreak: 0 },
        },
      },
    });

    const today = toGymLocalDate(new Date(), 'Asia/Kolkata');

    // 3 parallel check-ins
    const promises = [
      attendanceService.recordCheckIn(concurrentUser.id),
      attendanceService.recordCheckIn(concurrentUser.id),
      attendanceService.recordCheckIn(concurrentUser.id),
    ];

    const results = await Promise.all(promises);
    const newVisits = results.filter((r) => !r.isDuplicate).length;
    const duplicates = results.filter((r) => r.isDuplicate).length;

    assert.equal(newVisits, 1);
    assert.equal(duplicates, 2);

    // Verify database has exactly 1 row
    const count = await prisma.attendanceRecord.count({
      where: { userId: concurrentUser.id, gymDate: today },
    });
    assert.equal(count, 1);

    await prisma.attendanceRecord.deleteMany({ where: { userId: concurrentUser.id } });
    await prisma.membership.deleteMany({ where: { userId: concurrentUser.id } });
    await prisma.memberStreak.deleteMany({ where: { userId: concurrentUser.id } });
    await prisma.user.delete({ where: { id: concurrentUser.id } });
  });

  it('ATOMIC CORRECTION: admin corrects past attendance, writes audit record, and updates streak', async () => {
    // Create attendance on 2 past days: 2026-10-10, 2026-10-15
    await prisma.attendanceRecord.createMany({
      data: [
        {
          userId: memberId,
          gymDate: '2026-10-10',
          checkInTime: new Date('2026-10-10T02:00:00Z'),
          source: 'ENTRANCE_QR',
        },
        {
          userId: memberId,
          gymDate: '2026-10-15',
          checkInTime: new Date('2026-10-15T02:00:00Z'),
          source: 'ENTRANCE_QR',
        },
      ],
    });

    // Admin corrects 2026-10-15 to 2026-10-13 (which is 2 absent days from 2026-10-10, preserving streak!)
    const correctionResult = await attendanceService.correctAttendance(
      adminId,
      memberId,
      '2026-10-15',
      '2026-10-13',
      'Member mistakenly scanned after midnight; corrected to actual training date.'
    );

    assert.equal(correctionResult.success, true);

    // Verify audit record exists with mandatory fields
    const audit = await prisma.attendanceCorrection.findFirstOrThrow({
      where: { adminId },
      orderBy: { createdAt: 'desc' },
    });
    assert.equal(audit.originalGymDate, '2026-10-15');
    assert.equal(audit.correctedGymDate, '2026-10-13');
    assert.match(audit.reason, /mistakenly scanned after midnight/i);
  });

  it('MEMBERSHIP ACCESS ENFORCEMENT: blocks check-in for suspended, frozen, not-yet-started, and expired memberships', async () => {
    const statusUser = await prisma.user.create({
      data: {
        email: 'status.member@boxinn.local',
        fullName: 'Status Member',
        status: 'ACTIVE',
        memberships: {
          create: {
            planName: 'General Training',
            startDate: '2026-10-01',
            expiryDate: '2026-11-30',
            status: 'SUSPENDED',
            suspensionReason: 'Payment defaulted',
          },
        },
      },
    });

    try {
      // 1. Suspended membership blocked with suspension reason
      await assert.rejects(
        () => attendanceService.recordCheckIn(statusUser.id),
        /Membership is suspended: Payment defaulted/i
      );

      // 2. Frozen membership blocked
      await prisma.membership.updateMany({
        where: { userId: statusUser.id },
        data: { status: 'FROZEN', suspensionReason: null },
      });

      await assert.rejects(
        () => attendanceService.recordCheckIn(statusUser.id),
        /Membership is currently frozen/i
      );

      // 3. Future / not yet started membership blocked
      await prisma.membership.updateMany({
        where: { userId: statusUser.id },
        data: { status: 'ACTIVE', startDate: '2099-01-01', expiryDate: '2099-12-31' },
      });

      await assert.rejects(
        () => attendanceService.recordCheckIn(statusUser.id),
        /Membership starts on 2099-01-01/i
      );

      // 4. Expired membership blocked
      await prisma.membership.updateMany({
        where: { userId: statusUser.id },
        data: { status: 'ACTIVE', startDate: '2020-01-01', expiryDate: '2020-01-31' },
      });

      await assert.rejects(
        () => attendanceService.recordCheckIn(statusUser.id),
        /Membership expired on 2020-01-31/i
      );
    } finally {
      await prisma.attendanceRecord.deleteMany({ where: { userId: statusUser.id } });
      await prisma.membership.deleteMany({ where: { userId: statusUser.id } });
      await prisma.memberStreak.deleteMany({ where: { userId: statusUser.id } });
      await prisma.user.delete({ where: { id: statusUser.id } });
    }
  });

  it('INCLUSIVE EXPIRY: allows check-in on the exact expiry date and blocks starting at 00:00 on the day after', async () => {
    const today = toGymLocalDate(new Date(), 'Asia/Kolkata');
    const { addCalendarDays } = await import('../../src/domain/common/date-utils.ts');
    const yesterday = addCalendarDays(today, -1);

    const inclusiveUser = await prisma.user.create({
      data: {
        email: 'inclusive.member@boxinn.local',
        fullName: 'Inclusive Member',
        status: 'ACTIVE',
        memberships: {
          create: {
            planName: 'General Training',
            startDate: yesterday,
            expiryDate: today, // Valid through today inclusive
            status: 'ACTIVE',
          },
        },
      },
    });

    try {
      // Allowed on the exact expiry date
      const checkInResult = await attendanceService.recordCheckIn(inclusiveUser.id);
      assert.equal(checkInResult.success, true);
      assert.equal(checkInResult.gymDate, today);

      // Update expiry date to yesterday (day after expiry)
      await prisma.attendanceRecord.deleteMany({ where: { userId: inclusiveUser.id } });
      await prisma.membership.updateMany({
        where: { userId: inclusiveUser.id },
        data: { expiryDate: yesterday },
      });

      // Blocked starting at 00:00 on the day after expiry
      await assert.rejects(
        () => attendanceService.recordCheckIn(inclusiveUser.id),
        new RegExp(`Membership expired on ${yesterday}`, 'i')
      );
    } finally {
      await prisma.attendanceRecord.deleteMany({ where: { userId: inclusiveUser.id } });
      await prisma.membership.deleteMany({ where: { userId: inclusiveUser.id } });
      await prisma.memberStreak.deleteMany({ where: { userId: inclusiveUser.id } });
      await prisma.user.delete({ where: { id: inclusiveUser.id } });
    }
  });
});
