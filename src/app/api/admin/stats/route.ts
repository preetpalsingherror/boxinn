import { NextRequest } from 'next/server.js';
import { requireAdmin } from '../../../../presentation/security/auth-guard.ts';
import { prisma } from '../../../../infrastructure/db/client.ts';
import { attendanceService } from '../../../../application/services/attendance-service.ts';
import { jsonSuccess } from '../../../../presentation/http/response.ts';
import { toGymLocalDate, addCalendarDays } from '../../../../domain/common/date-utils.ts';

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (guard.errorResponse) {
    return guard.errorResponse;
  }

  const today = toGymLocalDate(new Date(), 'Asia/Kolkata');
  const in7Days = addCalendarDays(today, 7);

  const [activeMembers, todayAttendance, pendingVerifications, expiringSoon, machinesCount, occupancy] = await Promise.all([
    prisma.user.count({ where: { status: 'ACTIVE', role: 'MEMBER' } }),
    prisma.attendanceRecord.count({ where: { gymDate: today } }),
    prisma.user.count({ where: { status: 'PENDING_VERIFICATION' } }),
    prisma.membership.count({
      where: {
        status: 'ACTIVE',
        expiryDate: { gte: today, lte: in7Days },
      },
    }),
    prisma.machine.count(),
    attendanceService.getLiveOccupancy(),
  ]);

  return jsonSuccess({
    gymDate: today,
    activeMembers,
    todayAttendance,
    pendingVerifications,
    expiringSoon,
    machinesCount,
    liveOccupancy: occupancy.count,
    occupancyNotice: occupancy.capacityNotice,
    activeAthletes: occupancy.activeAthletes,
  });
}
