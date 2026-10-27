import { NextRequest } from 'next/server.js';
import { requireAuth } from '../../../../presentation/security/auth-guard.ts';
import { authService } from '../../../../application/services/auth-service.ts';
import { jsonSuccess, jsonError } from '../../../../presentation/http/response.ts';
import { validateCsrf } from '../../../../presentation/security/csrf-protection.ts';

export async function POST(req: NextRequest) {
  const guard = await requireAuth(req);
  if (guard.errorResponse) {
    return guard.errorResponse;
  }

  // Validate CSRF token for authenticated state mutation
  const csrf = validateCsrf(req);
  if (!csrf.valid) {
    return jsonError(csrf.reason || 'Invalid or missing CSRF token.', 403);
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return jsonError('Invalid request payload.', 400);
    }

    const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';

    if (!currentPassword) {
      return jsonError('Current password is required.', 400);
    }
    if (!newPassword || newPassword.length < 8) {
      return jsonError('New password must be at least 8 characters long.', 400);
    }

    await authService.changePassword(guard.auth.user.id, currentPassword, newPassword);

    return jsonSuccess({ message: 'Password updated successfully.' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to change password.';
    return jsonError(message, 400);
  }
}
