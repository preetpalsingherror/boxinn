import { NextRequest } from 'next/server.js';
import { authService } from '../../../../application/services/auth-service.ts';
import { jsonSuccess, jsonError } from '../../../../presentation/http/response.ts';
import { isValidEmail, extractClientIp, sanitizeString } from '../../../../presentation/http/validation.ts';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return jsonError('Invalid request payload. JSON object expected.', 400);
    }

    const email = sanitizeString(body.email);
    if (!isValidEmail(email)) {
      return jsonError('A valid email address is required.', 400);
    }

    const clientIp = extractClientIp(req);
    const result = await authService.requestPasswordReset(email, clientIp);

    return jsonSuccess(result, 200);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to process request.';
    return jsonError(message, 400);
  }
}
