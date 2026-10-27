import { NextRequest } from 'next/server.js';
import { requireAuth, requireAdmin } from '../../../presentation/security/auth-guard.ts';
import { prisma } from '../../../infrastructure/db/client.ts';
import { jsonSuccess, jsonError } from '../../../presentation/http/response.ts';
import { sanitizeString } from '../../../presentation/http/validation.ts';

export async function GET(req: NextRequest) {
  const guard = await requireAuth(req);
  if (guard.errorResponse) {
    return guard.errorResponse;
  }

  const machines = await prisma.machine.findMany({
    orderBy: [{ category: 'asc' }, { code: 'asc' }],
    include: {
      _count: {
        select: { exercises: true },
      },
    },
  });

  return jsonSuccess(machines);
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (guard.errorResponse) {
    return guard.errorResponse;
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return jsonError('Invalid request payload.', 400);
    }

    const code = sanitizeString(body.code, 32).toUpperCase();
    const name = sanitizeString(body.name, 128);
    const category = sanitizeString(body.category, 64);
    const location = sanitizeString(body.location, 128);
    const description = sanitizeString(body.description, 1024);

    if (!code || !name || !category || !location || !description) {
      return jsonError('Machine code, name, category, location, and description are required.', 400);
    }

    const machine = await prisma.machine.create({
      data: { code, name, category, location, description },
    });

    return jsonSuccess(machine, 201);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to register machine.';
    return jsonError(message, 400);
  }
}
