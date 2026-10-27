import { NextRequest } from 'next/server.js';
import { requireAdmin } from '../../../../presentation/security/auth-guard.ts';
import { prisma } from '../../../../infrastructure/db/client.ts';
import { jsonSuccess } from '../../../../presentation/http/response.ts';
import { toGymLocalDate } from '../../../../domain/common/date-utils.ts';

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (guard.errorResponse) {
    return guard.errorResponse;
  }

  const { searchParams } = new URL(req.url);
  const dateParam = searchParams.get('date')?.trim();
  const gymDate = dateParam || toGymLocalDate(new Date(), 'Asia/Kolkata');
  const userId = searchParams.get('userId')?.trim();

  const records = await prisma.attendanceRecord.findMany({
    where: {
      AND: [
        dateParam ? { gymDate } : {},
        userId ? { userId } : {},
      ],
    },
    orderBy: [{ gymDate: 'desc' }, { checkInTime: 'desc' }],
    take: 100,
    include: {
      user: {
        select: { id: true, fullName: true, email: true },
      },
      corrections: {
        include: {
          admin: { select: { fullName: true } },
        },
      },
    },
  });

  return jsonSuccess({
    gymDate,
    count: records.length,
    records,
  });
}
