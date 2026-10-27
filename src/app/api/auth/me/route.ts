import { NextRequest } from 'next/server.js';
import { requireAuth } from '../../../../presentation/security/auth-guard.ts';
import { jsonSuccess } from '../../../../presentation/http/response.ts';
import { prisma } from '../../../../infrastructure/db/client.ts';
import { toGymLocalDate } from '../../../../domain/common/date-utils.ts';
import { checkMembershipAccess } from '../../../../domain/membership/membership-status.ts';

export async function GET(req: NextRequest) {
  const guard = await requireAuth(req);
  if (guard.errorResponse) {
    return guard.errorResponse;
  }

  const { user } = guard.auth;
  const now = new Date();
  const gymDate = toGymLocalDate(now, 'Asia/Kolkata');

  // Load user's memberships and streak state
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    include: {
      memberships: {
        orderBy: { expiryDate: 'desc' },
      },
      streak: true,
    },
  });

  const memberships = dbUser?.memberships || [];
  const covering = memberships.find((m) => m.startDate <= gymDate && gymDate <= m.expiryDate);
  const primaryMembership = covering ?? memberships[0] ?? null;

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
        gymDate
      )
    : { allowed: false, derivedStatus: 'EXPIRED' as const, reason: 'No membership record found.' };

  return jsonSuccess({
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      status: user.status,
    },
    membership: primaryMembership
      ? {
          planName: primaryMembership.planName,
          startDate: primaryMembership.startDate,
          expiryDate: primaryMembership.expiryDate,
          adminStatus: primaryMembership.status,
          derivedStatus: access.derivedStatus,
          allowed: access.allowed,
          daysRemaining: access.daysRemaining,
          reason: access.reason,
        }
      : null,
    streak: dbUser?.streak
      ? {
          currentStreak: dbUser.streak.currentStreak,
          longestStreak: dbUser.streak.longestStreak,
          lastAttendanceDate: dbUser.streak.lastAttendanceDate,
        }
      : { currentStreak: 0, longestStreak: 0, lastAttendanceDate: null },
  });
}
