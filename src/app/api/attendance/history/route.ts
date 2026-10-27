import { NextRequest } from 'next/server.js';
import { requireAuth } from '../../../../presentation/security/auth-guard.ts';
import { prisma } from '../../../../infrastructure/db/client.ts';
import { attendanceService } from '../../../../application/services/attendance-service.ts';
import { jsonSuccess } from '../../../../presentation/http/response.ts';
import { toGymLocalDate } from '../../../../domain/common/date-utils.ts';
import { evaluateActiveStreak } from '../../../../domain/streak/streak-calculator.ts';

export async function GET(req: NextRequest) {
  const guard = await requireAuth(req);
  if (guard.errorResponse) {
    return guard.errorResponse;
  }

  const { user } = guard.auth;
  const today = toGymLocalDate(new Date(), 'Asia/Kolkata');

  // Fetch all attendance records in reverse chronological order
  const [records, streakRow, occupancy] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where: { userId: user.id },
      orderBy: { gymDate: 'desc' },
      select: {
        id: true,
        gymDate: true,
        checkInTime: true,
        checkOutTime: true,
        source: true,
        isAutoClosed: true,
      },
    }),
    prisma.memberStreak.findUnique({
      where: { userId: user.id },
    }),
    attendanceService.getLiveOccupancy(),
  ]);

  // Calculate live streak evaluation against today
  const activeStreak = streakRow
    ? evaluateActiveStreak(
        {
          currentStreak: streakRow.currentStreak,
          longestStreak: streakRow.longestStreak,
          lastAttendanceDate: streakRow.lastAttendanceDate,
          streakStartDate: streakRow.streakStartDate,
        },
        today
      )
    : {
        displayStreak: 0,
        longestStreak: 0,
        isStreakActive: false,
        absentDaysElapsed: 0,
        isGraceDay: false,
      };

  const checkedInToday = records.some((r) => r.gymDate === today);

  return jsonSuccess({
    totalVisits: records.length,
    checkedInToday,
    liveOccupancy: occupancy.count,
    occupancyNotice: occupancy.capacityNotice,
    streak: {
      currentStreak: streakRow ? streakRow.currentStreak : 0,
      displayStreak: activeStreak.displayStreak,
      longestStreak: activeStreak.longestStreak,
      lastAttendanceDate: streakRow ? streakRow.lastAttendanceDate : null,
      streakStartDate: streakRow ? streakRow.streakStartDate : null,
      isStreakActive: activeStreak.isStreakActive,
      absentDaysElapsed: activeStreak.absentDaysElapsed,
      isGraceDay: activeStreak.isGraceDay,
    },
    records,
  });
}
