import { NextRequest } from 'next/server.js';
import { attendanceService } from '../../../../application/services/attendance-service.ts';
import { cleanupExpiredRateLimits } from '../../../../infrastructure/security/rate-limiter.ts';
import { jsonSuccess, jsonError } from '../../../../presentation/http/response.ts';
import { getAuthenticatedSession } from '../../../../presentation/security/auth-guard.ts';

export async function POST(req: NextRequest) {
  // Authorization: check Authorization Bearer CRON_SECRET or an authenticated admin
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  let authorized = false;
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    authorized = true;
  } else {
    const authSession = await getAuthenticatedSession(req);
    if (authSession && authSession.user.role === 'ADMIN') {
      authorized = true;
    }
  }

  if (!authorized) {
    return jsonError('Unauthorized. Valid cron token or admin session required.', 401);
  }

  try {
    const closedSessionsCount = await attendanceService.reconcileOverdueSessions();
    const cleanedRateLimitsCount = await cleanupExpiredRateLimits();

    return jsonSuccess({
      message: 'Maintenance jobs executed successfully.',
      reconciledOverdueSessions: closedSessionsCount,
      cleanedExpiredRateLimits: cleanedRateLimitsCount,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Maintenance job failed.';
    return jsonError(message, 500);
  }
}
