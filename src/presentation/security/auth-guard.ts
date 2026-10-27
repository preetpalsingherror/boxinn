import { authService } from '../../application/services/auth-service.ts';
import { getSessionTokenFromRequest, clearAuthCookies } from './cookie-service.ts';
import { validateCsrf } from './csrf-protection.ts';
import { jsonError } from '../http/response.ts';
import type { NextResponse } from 'next/server.js';

export interface AuthenticatedContext {
  user: {
    id: string;
    email: string;
    fullName: string;
    role: string;
    status: string;
  };
  session: {
    id: string;
    userId: string;
    expiresAt: Date;
  };
}

/**
 * Resolves current authenticated session from HTTP Request cookie.
 * Returns null if missing, expired, or revoked.
 */
export async function getAuthenticatedSession(req: Request): Promise<AuthenticatedContext | null> {
  const token = getSessionTokenFromRequest(req);
  if (!token) return null;

  const result = await authService.validateSession(token);
  return result;
}

/**
 * Guard: Requires an active, authenticated member or admin session.
 * Enforces CSRF on state-changing requests.
 * Returns AuthenticatedContext or a terminal error NextResponse.
 */
export async function requireAuth(
  req: Request
): Promise<{ auth: AuthenticatedContext; errorResponse?: undefined } | { auth?: undefined; errorResponse: NextResponse }> {
  // 1. CSRF Validation for cookie-authenticated state-changing calls
  const csrfCheck = validateCsrf(req);
  if (!csrfCheck.valid) {
    return {
      errorResponse: jsonError(csrfCheck.reason || 'CSRF validation failed', 403),
    };
  }

  // 2. Session Validation
  const token = getSessionTokenFromRequest(req);
  if (!token) {
    return {
      errorResponse: jsonError('Authentication required. No active session.', 401),
    };
  }

  const result = await authService.validateSession(token);
  if (!result) {
    const headers = new Headers();
    clearAuthCookies(headers);
    return {
      errorResponse: jsonError('Session is invalid, expired, or revoked. Please log in again.', 401, undefined, headers),
    };
  }

  return { auth: result };
}

/**
 * Guard: Requires an authenticated user with role === 'ADMIN'.
 */
export async function requireAdmin(
  req: Request
): Promise<{ auth: AuthenticatedContext; errorResponse?: undefined } | { auth?: undefined; errorResponse: NextResponse }> {
  const check = await requireAuth(req);
  if (check.errorResponse) {
    return check;
  }

  if (check.auth.user.role !== 'ADMIN') {
    return {
      errorResponse: jsonError('Access forbidden. Administrator privileges required.', 403),
    };
  }

  return check;
}
