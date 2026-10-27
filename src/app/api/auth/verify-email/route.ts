import { NextRequest } from 'next/server.js';
import { authService } from '../../../../application/services/auth-service.ts';
import { jsonSuccess, jsonError } from '../../../../presentation/http/response.ts';
import { extractClientIp, sanitizeString } from '../../../../presentation/http/validation.ts';
import { setAuthCookies } from '../../../../presentation/security/cookie-service.ts';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return jsonError('Invalid request payload. JSON object expected.', 400);
    }

    const token = sanitizeString(body.token);
    if (!token) {
      return jsonError('Verification token is required.', 400);
    }

    const clientIp = extractClientIp(req);
    const userAgent = req.headers.get('user-agent') || undefined;

    const result = await authService.verifyEmail(token, clientIp, userAgent);

    const headers = new Headers();
    const csrfToken = setAuthCookies(headers, result.sessionToken);

    return jsonSuccess({ user: result.user, csrfToken }, 200, headers);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Verification failed or link expired.';
    return jsonError(message, 400);
  }
}
