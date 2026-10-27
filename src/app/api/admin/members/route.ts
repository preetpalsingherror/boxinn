import { NextRequest } from 'next/server.js';
import { requireAdmin } from '../../../../presentation/security/auth-guard.ts';
import { prisma } from '../../../../infrastructure/db/client.ts';
import { jsonSuccess } from '../../../../presentation/http/response.ts';
import { toGymLocalDate } from '../../../../domain/common/date-utils.ts';
import { checkMembershipAccess } from '../../../../domain/membership/membership-status.ts';

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (guard.errorResponse) {
    return guard.errorResponse;
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search')?.trim().toLowerCase() || '';
  const statusFilter = searchParams.get('status')?.trim() || '';

  const today = toGymLocalDate(new Date(), 'Asia/Kolkata');

  const users = await prisma.user.findMany({
    where: {
      AND: [
        search
          ? {
              OR: [
                { email: { contains: search, mode: 'insensitive' } },
                { fullName: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {},
        statusFilter ? { status: statusFilter as any } : {},
      ],
    },
    orderBy: { createdAt: 'desc' },
    include: {
      memberships: {
        orderBy: { expiryDate: 'desc' },
      },
      streak: true,
      _count: {
        select: { attendanceRecords: true },
      },
    },
  });

  const memberList = users.map((u) => {
    const primaryMembership = u.memberships[0] || null;
    const access = primaryMembership
      ? checkMembershipAccess(
          {
            id: primaryMembership.id,
            userId: primaryMembership.userId,
            planName: primaryMembership.planName,
            startDate: primaryMembership.startDate,
            expiryDate: primaryMembership.expiryDate,
            adminStatus: primaryMembership.status,
            suspensionReason: primaryMembership.suspensionReason || undefined,
          },
          today
        )
      : null;

    return {
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      phone: u.phone,
      role: u.role,
      status: u.status,
      emailVerifiedAt: u.emailVerifiedAt,
      createdAt: u.createdAt,
      totalVisits: u._count.attendanceRecords,
      streak: u.streak ? { current: u.streak.currentStreak, longest: u.streak.longestStreak } : { current: 0, longest: 0 },
      membership: primaryMembership
        ? {
            id: primaryMembership.id,
            planName: primaryMembership.planName,
            startDate: primaryMembership.startDate,
            expiryDate: primaryMembership.expiryDate,
            adminStatus: primaryMembership.status,
            derivedStatus: access?.derivedStatus,
            daysRemaining: access?.daysRemaining,
            suspensionReason: primaryMembership.suspensionReason,
          }
        : null,
    };
  });

  return jsonSuccess(memberList);
}
