import { NextRequest } from 'next/server.js';
import { authService } from '../../../../application/services/auth-service.ts';
import { jsonSuccess, jsonError } from '../../../../presentation/http/response.ts';
import { validatePassword, sanitizeString } from '../../../../presentation/http/validation.ts';
import { clearAuthCookies } from '../../../../presentation/security/cookie-service.ts';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return jsonError('Invalid request payload. JSON object expected.', 400);
    }

    const token = sanitizeString(body.token);
    const password = typeof body.password === 'string' ? body.password : '';

    if (!token) {
      return jsonError('Password reset token is required.', 400);
    }
    const passCheck = validatePassword(password);
    if (!passCheck.valid) {
      return jsonError(passCheck.reason || 'Invalid password.', 400);
    }

    const result = await authService.resetPassword(token, password);

    // Any existing cookies on the resetting device should be invalidated
    const headers = new Headers();
    clearAuthCookies(headers);

    return jsonSuccess(result, 200, headers);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Password reset failed.';
    return jsonError(message, 400);
  }
}
