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

  const announcements = await prisma.announcement.findMany({
    orderBy: [{ isUrgent: 'desc' }, { publishedAt: 'desc' }],
    include: {
      createdBy: {
        select: { fullName: true, role: true },
      },
    },
  });

  return jsonSuccess(announcements);
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (guard.errorResponse) {
    return guard.errorResponse;
  }

  const { user } = guard.auth;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return jsonError('Invalid request payload.', 400);
    }

    const title = sanitizeString(body.title, 128);
    const content = sanitizeString(body.content, 2048);
    const isUrgent = Boolean(body.isUrgent);

    if (!title || !content) {
      return jsonError('Announcement title and content are required.', 400);
    }

    const created = await prisma.announcement.create({
      data: {
        title,
        content,
        isUrgent,
        createdById: user.id,
      },
    });

    return jsonSuccess(created, 201);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to publish announcement.';
    return jsonError(message, 400);
  }
}
