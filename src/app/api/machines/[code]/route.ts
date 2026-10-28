import { NextRequest } from 'next/server.js';
import { requireAuth, requireAdmin } from '../../../../presentation/security/auth-guard.ts';
import { prisma } from '../../../../infrastructure/db/client.ts';
import { jsonSuccess, jsonError } from '../../../../presentation/http/response.ts';
import { sanitizeString, normalizeVideoEmbedUrl } from '../../../../presentation/http/validation.ts';

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
    const videoUrl = body.videoUrl ? normalizeVideoEmbedUrl(sanitizeString(body.videoUrl, 512)) : null;
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

export async function PUT(
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

    // If exerciseId is provided, update that specific exercise on this machine
    if (body.exerciseId && typeof body.exerciseId === 'string') {
      const existingExercise = await prisma.exercise.findFirst({
        where: { id: body.exerciseId, machineId: machine.id },
      });

      if (!existingExercise) {
        return jsonError('Exercise not found for this machine.', 404);
      }

      const title = sanitizeString(body.title ?? existingExercise.title, 128);
      const targetMuscleGroup = sanitizeString(body.targetMuscleGroup ?? existingExercise.targetMuscleGroup, 128);
      const instructions = sanitizeString(body.instructions ?? existingExercise.instructions, 2048);
      const safetyPrecautions = sanitizeString(body.safetyPrecautions ?? existingExercise.safetyPrecautions, 1024);
      const videoUrl = body.videoUrl !== undefined
        ? (body.videoUrl ? normalizeVideoEmbedUrl(sanitizeString(body.videoUrl, 512)) : null)
        : existingExercise.videoUrl;
      const trainerName = sanitizeString(body.trainerName ?? existingExercise.trainerName ?? 'Coach Vikram', 64);
      const difficulty = body.difficulty || existingExercise.difficulty || 'ALL_LEVELS';

      let formCues = existingExercise.formCues;
      if (Array.isArray(body.formCues)) {
        formCues = JSON.stringify(body.formCues.map((c: unknown) => sanitizeString(c, 256)));
      } else if (typeof body.formCues === 'string') {
        formCues = body.formCues;
      }

      const updatedExercise = await prisma.exercise.update({
        where: { id: existingExercise.id },
        data: {
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

      return jsonSuccess(updatedExercise);
    }

    // Otherwise, update machine metadata
    const name = sanitizeString(body.name ?? machine.name, 128);
    const category = sanitizeString(body.category ?? machine.category, 64);
    const location = sanitizeString(body.location ?? machine.location, 128);
    const description = sanitizeString(body.description ?? machine.description, 1024);

    const updatedMachine = await prisma.machine.update({
      where: { id: machine.id },
      data: { name, category, location, description },
    });

    return jsonSuccess(updatedMachine);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update equipment.';
    return jsonError(message, 400);
  }
}

export async function DELETE(
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
    const url = new URL(req.url);
    const exerciseId = url.searchParams.get('exerciseId');

    // If exerciseId query param is present, delete only that exercise
    if (exerciseId) {
      const existingExercise = await prisma.exercise.findFirst({
        where: { id: exerciseId, machineId: machine.id },
      });

      if (!existingExercise) {
        return jsonError('Exercise guide not found on this machine.', 404);
      }

      await prisma.exercise.delete({
        where: { id: existingExercise.id },
      });

      return jsonSuccess({ deletedExerciseId: existingExercise.id, message: 'Exercise guide deleted.' });
    }

    // Otherwise, delete the machine and all its attached exercises atomically
    await prisma.$transaction([
      prisma.exercise.deleteMany({ where: { machineId: machine.id } }),
      prisma.machine.delete({ where: { id: machine.id } }),
    ]);

    return jsonSuccess({ deletedMachineCode: normalizedCode, message: `Machine ${normalizedCode} and its exercises deleted.` });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete equipment.';
    return jsonError(message, 400);
  }
}
