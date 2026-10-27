import { NextRequest } from 'next/server.js';
import { requireAuth, requireAdmin } from '../../../../presentation/security/auth-guard.ts';
import { prisma } from '../../../../infrastructure/db/client.ts';
import { jsonSuccess, jsonError } from '../../../../presentation/http/response.ts';
import { sanitizeString } from '../../../../presentation/http/validation.ts';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  const guard = await requireAuth(req);
  if (guard.errorResponse) {
    return guard.errorResponse;
  }

  const { code } = await context.params;
  const normalizedCode = code.trim().toUpperCase();

  const machine = await prisma.machine.findUnique({
    where: { code: normalizedCode },
    include: {
      exercises: {
        orderBy: { title: 'asc' },
      },
    },
  });

  if (!machine) {
    return jsonError(`Machine with code "${normalizedCode}" not found.`, 404);
  }

  return jsonSuccess(machine);
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  const guard = await requireAdmin(req);
  if (guard.errorResponse) {
    return guard.errorResponse;
  }

  const { code } = await context.params;
  const normalizedCode = code.trim().toUpperCase();

  const machine = await prisma.machine.findUnique({
    where: { code: normalizedCode },
  });

  if (!machine) {
    return jsonError(`Machine with code "${normalizedCode}" not found.`, 404);
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return jsonError('Invalid request payload.', 400);
    }

    const title = sanitizeString(body.title, 128);
    const targetMuscleGroup = sanitizeString(body.targetMuscleGroup, 128);
    const instructions = sanitizeString(body.instructions, 2048);
    const safetyPrecautions = sanitizeString(body.safetyPrecautions, 1024);
    const videoUrl = body.videoUrl ? sanitizeString(body.videoUrl, 512) : null;
    const trainerName = sanitizeString(body.trainerName || 'Coach Vikram', 64);
    const difficulty = body.difficulty || 'ALL_LEVELS';

    let formCues = '[]';
    if (Array.isArray(body.formCues)) {
      formCues = JSON.stringify(body.formCues.map((c: unknown) => sanitizeString(c, 256)));
    } else if (typeof body.formCues === 'string') {
      formCues = body.formCues;
    }

    if (!title || !targetMuscleGroup || !instructions || !safetyPrecautions) {
      return jsonError('Title, target muscle group, instructions, and safety precautions are required.', 400);
    }

    const exercise = await prisma.exercise.create({
      data: {
        machineId: machine.id,
        title,
        targetMuscleGroup,
        instructions,
        formCues,
        safetyPrecautions,
        videoUrl,
        trainerName,
        difficulty,
      },
    });

    return jsonSuccess(exercise, 201);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to add exercise guide.';
    return jsonError(message, 400);
  }
}
