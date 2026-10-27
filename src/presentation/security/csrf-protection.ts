import { CSRF_HEADER_NAME, getCsrfTokenFromRequest } from './cookie-service.ts';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export interface CsrfValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Validates CSRF token on state-changing requests using standard double-submit cookie pattern.
 * If the request has an active session cookie, it MUST include a matching x-csrf-token header.
 */
export function validateCsrf(req: Request): CsrfValidationResult {
  if (SAFE_METHODS.has(req.method.toUpperCase())) {
    return { valid: true };
  }

  const cookieCsrfToken = getCsrfTokenFromRequest(req);
  const headerCsrfToken = req.headers.get(CSRF_HEADER_NAME);

  if (!cookieCsrfToken) {
    // If no CSRF cookie exists, the client has not established a state-protected session yet
    return { valid: true };
  }

  if (!headerCsrfToken || headerCsrfToken !== cookieCsrfToken) {
    return {
      valid: false,
      reason: 'Invalid or missing CSRF token. Request rejected.',
    };
  }

  return { valid: true };
}
