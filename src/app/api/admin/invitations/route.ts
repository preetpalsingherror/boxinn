import { NextRequest } from 'next/server.js';
import { requireAdmin } from '../../../../presentation/security/auth-guard.ts';
import { authService } from '../../../../application/services/auth-service.ts';
import { jsonSuccess, jsonError } from '../../../../presentation/http/response.ts';
import { isValidEmail, sanitizeString } from '../../../../presentation/http/validation.ts';
import { isValidISODateString } from '../../../../domain/common/date-utils.ts';

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (guard.errorResponse) {
    return guard.errorResponse;
  }

  const { user: admin } = guard.auth;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return jsonError('Invalid request payload.', 400);
    }

    const email = sanitizeString(body.email);
    const fullName = sanitizeString(body.fullName, 128);
    const phone = body.phone ? sanitizeString(body.phone, 32) : undefined;
    const planName = sanitizeString(body.planName || 'General Training', 64);
    const startDate = sanitizeString(body.startDate, 10);
    const expiryDate = sanitizeString(body.expiryDate, 10);

    if (!isValidEmail(email)) {
      return jsonError('A valid email address is required.', 400);
    }
    if (!fullName) {
      return jsonError('Full name is required.', 400);
    }
    if (!isValidISODateString(startDate) || !isValidISODateString(expiryDate)) {
      return jsonError('Start date and expiry date must be valid YYYY-MM-DD dates.', 400);
    }
    if (expiryDate < startDate) {
      return jsonError('Expiry date cannot precede start date.', 400);
    }

    const result = await authService.createInvitation(
      admin.id,
      email,
      fullName,
      phone,
      planName,
      startDate,
      expiryDate
    );

    return jsonSuccess(result, 201);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create invitation.';
    return jsonError(message, 400);
  }
}
