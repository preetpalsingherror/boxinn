import { NextRequest } from 'next/server.js';
import { requireAuth } from '../../../../presentation/security/auth-guard.ts';
import { attendanceService } from '../../../../application/services/attendance-service.ts';
import { jsonSuccess } from '../../../../presentation/http/response.ts';

export async function GET(req: NextRequest) {
  const guard = await requireAuth(req);
  if (guard.errorResponse) {
    return guard.errorResponse;
  }

  const occupancy = await attendanceService.getLiveOccupancy();
  return jsonSuccess(occupancy);
}
