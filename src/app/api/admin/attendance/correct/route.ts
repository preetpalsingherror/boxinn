import { NextRequest } from 'next/server.js';
import { requireAdmin } from '../../../../../presentation/security/auth-guard.ts';
import { attendanceService } from '../../../../../application/services/attendance-service.ts';
import { jsonSuccess, jsonError } from '../../../../../presentation/http/response.ts';
import { sanitizeString } from '../../../../../presentation/http/validation.ts';
import { isValidISODateString } from '../../../../../domain/common/date-utils.ts';

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (guard.errorResponse) {
    return guard.errorResponse;
  }

  const { user: admin } = guard.auth;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return jsonError('Invalid request payload.', 400);
    }

    const userId = sanitizeString(body.userId);
    const originalGymDate = sanitizeString(body.originalGymDate, 10);
    const correctedGymDate = sanitizeString(body.correctedGymDate, 10);
    const reason = sanitizeString(body.reason, 1024);

    if (!userId) {
      return jsonError('User ID is required.', 400);
    }
    if (!isValidISODateString(originalGymDate) || !isValidISODateString(correctedGymDate)) {
      return jsonError('Both original and corrected dates must be valid YYYY-MM-DD strings.', 400);
    }
    if (!reason) {
      return jsonError('A valid administrative reason is required for attendance correction audit trail.', 400);
    }

    const result = await attendanceService.correctAttendance(
      admin.id,
      userId,
      originalGymDate,
      correctedGymDate,
      reason
    );

    return jsonSuccess({
      message: 'Attendance record corrected and member streak recalculated.',
      result,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Attendance correction failed.';
    return jsonError(message, 400);
  }
}
