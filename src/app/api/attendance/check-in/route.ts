import { NextRequest } from 'next/server.js';
import { requireAuth } from '../../../../presentation/security/auth-guard.ts';
import { attendanceService } from '../../../../application/services/attendance-service.ts';
import { jsonSuccess, jsonError } from '../../../../presentation/http/response.ts';

export async function POST(req: NextRequest) {
  const guard = await requireAuth(req);
  if (guard.errorResponse) {
    return guard.errorResponse;
  }

  const { user } = guard.auth;

  try {
    const result = await attendanceService.recordCheckIn(user.id, 'ENTRANCE_QR');
    return jsonSuccess(result, 200);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Check-in failed.';
    return jsonError(message, 400);
  }
}
