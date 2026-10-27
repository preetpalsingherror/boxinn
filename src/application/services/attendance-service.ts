import { prisma } from '../../infrastructure/db/client.ts';
import { toGymLocalDate } from '../../domain/common/date-utils.ts';
import { checkMembershipAccess } from '../../domain/membership/membership-status.ts';
import type { MembershipRecord } from '../../domain/membership/membership-status.ts';
import { handleDuplicateScan, evaluateSessionClosure, SESSION_DURATION_MS } from '../../domain/attendance/session-closure.policy.ts';
import { calculateStreakOnAttendance, recalculateFullStreak } from '../../domain/streak/streak-calculator.ts';
import type { StreakState } from '../../domain/streak/streak-calculator.ts';

export class AttendanceService {
  /**
   * Entrance QR check-in.
   * Atomically verifies membership, captures server timestamps in Asia/Kolkata,
   * locks member_streaks with FOR UPDATE, updates streaks, and provides friendly duplicate feedback.
   */
  async recordCheckIn(
    userId: string,
    source: 'ENTRANCE_QR' | 'ADMIN_MANUAL' = 'ENTRANCE_QR'
  ): Promise<{
    success: boolean;
    isDuplicate: boolean;
    message: string;
    gymDate: string;
    checkInTime: Date;
    streak?: { currentStreak: number; longestStreak: number };
  }> {
    const now = new Date();
    const gymDate = toGymLocalDate(now, 'Asia/Kolkata');

    // 1. Verify user exists and is ACTIVE
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          orderBy: { expiryDate: 'desc' },
        },
      },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new Error('Account is not active or verified. Access denied.');
    }

    // 2. Evaluate membership for today's gym date
    // Prefer any membership covering today (startDate <= gymDate <= expiryDate).
    // If none covers today, take the most recent membership (by expiryDate desc).
    const coveringMembership = user.memberships.find(
      (m) => m.startDate <= gymDate && gymDate <= m.expiryDate
    );
    const chosenMembership = coveringMembership ?? user.memberships[0] ?? null;

    const membershipRecord: MembershipRecord | null = chosenMembership
      ? {
          id: chosenMembership.id,
          userId: chosenMembership.userId,
          planName: chosenMembership.planName,
          startDate: chosenMembership.startDate,
          expiryDate: chosenMembership.expiryDate,
          adminStatus: chosenMembership.status,
          suspensionReason: chosenMembership.suspensionReason || undefined,
        }
      : null;

    const access = checkMembershipAccess(membershipRecord, gymDate);
    if (!access.allowed) {
      throw new Error(access.reason || 'Membership is not active for today. Access denied.');
    }

    try {
      // 3. Atomic transaction with row lock on member_streaks
      const result = await prisma.$transaction(async (tx) => {
        // Ensure member streak row exists before locking
        await tx.memberStreak.upsert({
          where: { userId },
          update: {},
          create: { userId, currentStreak: 0, longestStreak: 0 },
        });

        // Row-level lock to serialize streak updates (Condition 3)
        await tx.$queryRaw`
          SELECT * FROM "member_streaks"
          WHERE "user_id" = ${userId}::uuid
          FOR UPDATE;
        `;

        // Create attendance record
        const attendance = await tx.attendanceRecord.create({
          data: {
            userId,
            gymDate,
            checkInTime: now,
            source,
            isAutoClosed: false,
          },
        });

        // Load existing streak state
        const currentStreakRow = await tx.memberStreak.findUniqueOrThrow({
          where: { userId },
        });

        const previousState: StreakState = {
          currentStreak: currentStreakRow.currentStreak,
          longestStreak: currentStreakRow.longestStreak,
          lastAttendanceDate: currentStreakRow.lastAttendanceDate,
          streakStartDate: currentStreakRow.streakStartDate,
        };

        // Compute updated streak via pure domain logic
        const nextState = calculateStreakOnAttendance(previousState, gymDate);

        // Update streak record
        await tx.memberStreak.update({
          where: { userId },
          data: {
            currentStreak: nextState.currentStreak,
            longestStreak: nextState.longestStreak,
            lastAttendanceDate: nextState.lastAttendanceDate,
            streakStartDate: nextState.streakStartDate,
          },
        });

        return {
          attendance,
          streak: {
            currentStreak: nextState.currentStreak,
            longestStreak: nextState.longestStreak,
          },
        };
      });

      return {
        success: true,
        isDuplicate: false,
        message: `Welcome to BOX INN! Checked in at ${now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}. Current streak: ${result.streak.currentStreak} day(s).`,
        gymDate,
        checkInTime: now,
        streak: result.streak,
      };
    } catch (err: unknown) {
      // Catch unique constraint violation (P2002) for duplicate scans
      const isUniqueError =
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as { code: string }).code === 'P2002';

      if (isUniqueError) {
        // Query existing attendance record
        const existing = await prisma.attendanceRecord.findUnique({
          where: {
            userId_gymDate: { userId, gymDate },
          },
        });

        if (existing) {
          const feedback = handleDuplicateScan(
            {
              id: existing.id,
              userId: existing.userId,
              gymDate: existing.gymDate,
              checkInTime: existing.checkInTime,
              checkOutTime: existing.checkOutTime,
              isAutoClosed: existing.isAutoClosed,
            },
            now
          );

          return {
            success: true,
            isDuplicate: true,
            message: feedback.message,
            gymDate,
            checkInTime: existing.checkInTime,
          };
        }
      }

      throw err;
    }
  }

  /**
   * Administrator corrects an attendance record.
   * Atomically acquires row lock on member_streaks, logs audit trail,
   * updates record, and recalculates full streak ledger deterministically.
   */
  async correctAttendance(
    adminId: string,
    userId: string,
    originalGymDate: string,
    correctedGymDate: string,
    reason: string
  ): Promise<{ success: boolean; newStreak: StreakState }> {
    if (!reason || reason.trim().length === 0) {
      throw new Error('A valid reason must be provided for attendance correction audit trail.');
    }

    return prisma.$transaction(async (tx) => {
      // 1. Ensure member streak row exists and lock it
      await tx.memberStreak.upsert({
        where: { userId },
        update: {},
        create: { userId, currentStreak: 0, longestStreak: 0 },
      });

      // Row-level lock to serialize correction against concurrent scans
      await tx.$queryRaw`
        SELECT * FROM "member_streaks"
        WHERE "user_id" = ${userId}::uuid
        FOR UPDATE;
      `;

      // 2. Find the existing record
      const record = await tx.attendanceRecord.findUnique({
        where: {
          userId_gymDate: { userId, gymDate: originalGymDate },
        },
      });

      if (!record) {
        throw new Error(`Attendance record not found for member on date ${originalGymDate}.`);
      }

      const beforeState = JSON.stringify({ gymDate: record.gymDate, source: record.source });

      // 3. Update attendance record
      const updated = await tx.attendanceRecord.update({
        where: { id: record.id },
        data: { gymDate: correctedGymDate },
      });

      const afterState = JSON.stringify({ gymDate: updated.gymDate, source: updated.source });

      // 4. Record audit correction log (Non-cascading)
      await tx.attendanceCorrection.create({
        data: {
          attendanceRecordId: record.id,
          adminId,
          originalGymDate,
          correctedGymDate,
          beforeState,
          afterState,
          reason,
        },
      });

      // 5. Fetch full chronological attendance dates for user
      const allRecords = await tx.attendanceRecord.findMany({
        where: { userId },
        select: { gymDate: true },
        orderBy: { gymDate: 'asc' },
      });

      const distinctDates = allRecords.map((r) => r.gymDate);

      // 6. Recalculate full streak deterministically
      const newStreak = recalculateFullStreak(distinctDates);

      // 7. Update member streak state
      await tx.memberStreak.update({
        where: { userId },
        data: {
          currentStreak: newStreak.currentStreak,
          longestStreak: newStreak.longestStreak,
          lastAttendanceDate: newStreak.lastAttendanceDate,
          streakStartDate: newStreak.streakStartDate,
        },
      });

      return { success: true, newStreak };
    });
  }

  /**
   * Reconciles overdue sessions past the 3-hour mark.
   */
  async reconcileOverdueSessions(): Promise<number> {
    const now = new Date();
    const result = await prisma.$executeRaw`
      UPDATE "attendance_records"
      SET 
        "check_out_time" = "check_in_time" + INTERVAL '3 hours',
        "is_auto_closed" = true
      WHERE "check_out_time" IS NULL 
        AND "check_in_time" + INTERVAL '3 hours' <= ${now};
    `;
    return result;
  }

  /**
   * Calculates real-time gym floor occupancy count and active athlete list.
   * Calculated from check-ins recorded today (Asia/Kolkata) where session auto-close (3 hours)
   * has not elapsed and member has not manually checked out.
   */
  async getLiveOccupancy(): Promise<{
    count: number;
    gymDate: string;
    asOf: string;
    capacityNotice: string;
    activeAthletes: Array<{
      userId: string;
      fullName: string;
      email: string;
      checkInTime: string;
      elapsedMinutes: number;
      remainingMinutes: number;
    }>;
  }> {
    const now = new Date();
    const gymDate = toGymLocalDate(now, 'Asia/Kolkata');
    const threeHoursAgo = new Date(now.getTime() - SESSION_DURATION_MS);

    const activeRecords = await prisma.attendanceRecord.findMany({
      where: {
        gymDate,
        checkOutTime: null,
        isAutoClosed: false,
        checkInTime: {
          gt: threeHoursAgo,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
      orderBy: {
        checkInTime: 'desc',
      },
    });

    const count = activeRecords.length;

    let capacityNotice = 'Calm & Spaced • Great time to train';
    if (count >= 15) {
      capacityNotice = 'Peak Training Hour • High Floor Energy';
    } else if (count >= 6) {
      capacityNotice = 'Moderate Activity • Rigs & Stations Ready';
    }

    const activeAthletes = activeRecords.map((r) => {
      const checkInMs = r.checkInTime.getTime();
      const elapsedMs = Math.max(0, now.getTime() - checkInMs);
      const elapsedMinutes = Math.floor(elapsedMs / (60 * 1000));
      const remainingMinutes = Math.max(0, 180 - elapsedMinutes);

      return {
        userId: r.user.id,
        fullName: r.user.fullName,
        email: r.user.email,
        checkInTime: r.checkInTime.toISOString(),
        elapsedMinutes,
        remainingMinutes,
      };
    });

    return {
      count,
      gymDate,
      asOf: now.toISOString(),
      capacityNotice,
      activeAthletes,
    };
  }
}

export const attendanceService = new AttendanceService();
