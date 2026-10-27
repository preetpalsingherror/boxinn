import { jsonSuccess } from '../../../presentation/http/response.ts';
import { generateSecureToken } from '../../../infrastructure/security/token-service.ts';
import { buildCookieString, CSRF_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from '../../../presentation/security/cookie-service.ts';

export async function GET() {
  const csrfToken = generateSecureToken(32);
  const headers = new Headers();

  const csrfCookie = buildCookieString(CSRF_COOKIE_NAME, csrfToken, {
    maxAge: SESSION_MAX_AGE_SECONDS,
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });

  headers.append('Set-Cookie', csrfCookie);
  return jsonSuccess({ csrfToken }, 200, headers);
}
