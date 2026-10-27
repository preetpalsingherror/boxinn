import { NextRequest } from 'next/server.js';
import { authService } from '../../../../application/services/auth-service.ts';
import { jsonSuccess, jsonError } from '../../../../presentation/http/response.ts';
import { isValidEmail, extractClientIp, sanitizeString } from '../../../../presentation/http/validation.ts';
import { setAuthCookies } from '../../../../presentation/security/cookie-service.ts';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return jsonError('Invalid request payload. JSON object expected.', 400);
    }

    let email = sanitizeString(body.email).toLowerCase().trim();
    if (email && !email.includes('@')) {
      email = `${email}@boxinn.local`;
    }
    if (email === 'preetpal@boxinn.local') {
      email = 'preet@boxinn.local';
    }
    const password = typeof body.password === 'string' ? body.password : '';

    if (!isValidEmail(email)) {
      return jsonError('A valid email address is required.', 400);
    }
    if (!password) {
      return jsonError('Password is required.', 400);
    }

    const clientIp = extractClientIp(req);
    const userAgent = req.headers.get('user-agent') || undefined;

    const result = await authService.login(email, password, clientIp, userAgent);

    const headers = new Headers();
    const csrfToken = setAuthCookies(headers, result.sessionToken);

    return jsonSuccess({ user: result.user, csrfToken }, 200, headers);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Invalid credentials.';
    return jsonError(message, 401);
  }
}
