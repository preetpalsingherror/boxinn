import { generateSecureToken } from '../../infrastructure/security/token-service.ts';
import {
  SESSION_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  SESSION_MAX_AGE_SECONDS,
} from './cookie-constants.ts';

export {
  SESSION_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  SESSION_MAX_AGE_SECONDS,
};

const isSecureEnvironment = (): boolean => {
  if (process.env.COOKIE_SECURE === 'true') return true;
  if (process.env.COOKIE_SECURE === 'false') return false;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_ORIGIN || '';
  if (appUrl.startsWith('https://')) return true;
  return false;
};

/**
 * Parses raw Cookie header string into key-value map.
 */
export function parseCookies(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {};
  const map: Record<string, string> = {};
  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx > -1) {
      const key = pair.slice(0, idx).trim();
      const val = pair.slice(idx + 1).trim();
      map[key] = decodeURIComponent(val);
    }
  }
  return map;
}

/**
 * Builds standard Set-Cookie string.
 */
export function buildCookieString(
  name: string,
  value: string,
  options: {
    maxAge?: number;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'lax' | 'strict' | 'none';
    path?: string;
  } = {}
): string {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Path=${options.path || '/'}`);

  if (typeof options.maxAge === 'number') {
    parts.push(`Max-Age=${options.maxAge}`);
  }
  if (options.httpOnly !== false) {
    parts.push('HttpOnly');
  }
  
  const isSecure = options.secure !== undefined ? options.secure : isSecureEnvironment();
  if (isSecure) {
    parts.push('Secure');
  }
  
  const sameSite = options.sameSite || 'lax';
  parts.push(`SameSite=${sameSite.charAt(0).toUpperCase() + sameSite.slice(1)}`);

  return parts.join('; ');
}

/**
 * Attaches authenticated session and CSRF cookies to response headers.
 */
export function setAuthCookies(
  headers: Headers,
  sessionToken: string,
  existingCsrfToken?: string
): string {
  const csrfToken = existingCsrfToken || generateSecureToken(32);
  const secure = isSecureEnvironment();

  // 1. Session Cookie (HttpOnly)
  const sessionCookie = buildCookieString(SESSION_COOKIE_NAME, sessionToken, {
    maxAge: SESSION_MAX_AGE_SECONDS,
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
  });

  // 2. CSRF Cookie (Readable by client JS to send in x-csrf-token header)
  const csrfCookie = buildCookieString(CSRF_COOKIE_NAME, csrfToken, {
    maxAge: SESSION_MAX_AGE_SECONDS,
    httpOnly: false, // Must be readable by client JS
    secure,
    sameSite: 'lax',
    path: '/',
  });

  headers.append('Set-Cookie', sessionCookie);
  headers.append('Set-Cookie', csrfCookie);

  return csrfToken;
}

/**
 * Clears authenticated session and CSRF cookies from response headers.
 */
export function clearAuthCookies(headers: Headers): void {
  const secure = isSecureEnvironment();

  const expiredSessionCookie = buildCookieString(SESSION_COOKIE_NAME, '', {
    maxAge: 0,
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
  });

  const expiredCsrfCookie = buildCookieString(CSRF_COOKIE_NAME, '', {
    maxAge: 0,
    httpOnly: false,
    secure,
    sameSite: 'lax',
    path: '/',
  });

  headers.append('Set-Cookie', expiredSessionCookie);
  headers.append('Set-Cookie', expiredCsrfCookie);
}

/**
 * Extracts session token from incoming HTTP Request.
 */
export function getSessionTokenFromRequest(req: Request): string | null {
  const cookies = parseCookies(req.headers.get('cookie'));
  return cookies[SESSION_COOKIE_NAME] || cookies['__Host-boxinn_session'] || null;
}

/**
 * Extracts CSRF token from incoming HTTP Request cookie.
 */
export function getCsrfTokenFromRequest(req: Request): string | null {
  const cookies = parseCookies(req.headers.get('cookie'));
  return cookies[CSRF_COOKIE_NAME] || null;
}
