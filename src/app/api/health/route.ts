import { prisma } from '../../../infrastructure/db/client.ts';
import { jsonSuccess, jsonError } from '../../../presentation/http/response.ts';
import { toGymLocalDate } from '../../../domain/common/date-utils.ts';

export async function GET() {
  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1;`;
    const dbLatencyMs = Date.now() - start;

    const now = new Date();
    const gymDate = toGymLocalDate(now, 'Asia/Kolkata');

    return jsonSuccess({
      status: 'healthy',
      app: 'BOX INN Member Companion',
      version: '0.1.0',
      facility: 'Yelahanka, Bengaluru',
      timezone: 'Asia/Kolkata',
      gymDate,
      serverTime: now.toISOString(),
      database: {
        connected: true,
        latencyMs: dbLatencyMs,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Database health check failed';
    return jsonError(message, 503, { status: 'unhealthy', connected: false });
  }
}
