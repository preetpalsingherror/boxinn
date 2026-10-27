import { NextRequest } from 'next/server.js';
import { authService } from '../../../../application/services/auth-service.ts';
import { jsonSuccess } from '../../../../presentation/http/response.ts';
import { getSessionTokenFromRequest, clearAuthCookies } from '../../../../presentation/security/cookie-service.ts';

export async function POST(req: NextRequest) {
  const token = getSessionTokenFromRequest(req);
  if (token) {
    await authService.logout(token).catch(() => {});
  }

  const headers = new Headers();
  clearAuthCookies(headers);

  return jsonSuccess({ message: 'Logged out successfully.' }, 200, headers);
}
