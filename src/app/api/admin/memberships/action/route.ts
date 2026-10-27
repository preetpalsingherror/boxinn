import { NextRequest } from 'next/server.js';
import { requireAdmin } from '../../../../../presentation/security/auth-guard.ts';
import { prisma } from '../../../../../infrastructure/db/client.ts';
import { jsonSuccess, jsonError } from '../../../../../presentation/http/response.ts';
import { sanitizeString } from '../../../../../presentation/http/validation.ts';
import { isValidISODateString } from '../../../../../domain/common/date-utils.ts';

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

    const membershipId = sanitizeString(body.membershipId);
    const action = sanitizeString(body.action).toUpperCase();
    const reason = sanitizeString(body.reason, 1024);

    if (!membershipId) {
      return jsonError('Membership ID is required.', 400);
    }
    if (!reason) {
      return jsonError('A valid administrative reason is required for the audit trail.', 400);
    }

    const currentMembership = await prisma.membership.findUnique({
      where: { id: membershipId },
    });
    if (!currentMembership) {
      return jsonError('Membership record not found.', 404);
    }

    const beforeState = JSON.stringify({
      status: currentMembership.status,
      startDate: currentMembership.startDate,
      expiryDate: currentMembership.expiryDate,
      suspensionReason: currentMembership.suspensionReason,
    });

    let updateData: {
      status?: 'ACTIVE' | 'SUSPENDED' | 'FROZEN';
      expiryDate?: string;
      suspensionReason?: string | null;
    } = {};

    switch (action) {
      case 'RENEW': {
        const newExpiryDate = sanitizeString(body.newExpiryDate, 10);
        if (!isValidISODateString(newExpiryDate)) {
          return jsonError('Valid new YYYY-MM-DD expiry date is required for renewal.', 400);
        }
        if (newExpiryDate < currentMembership.startDate) {
          return jsonError('New expiry date cannot precede membership start date.', 400);
        }
        updateData = {
          status: 'ACTIVE',
          expiryDate: newExpiryDate,
          suspensionReason: null,
        };
        break;
      }
      case 'SUSPEND': {
        updateData = {
          status: 'SUSPENDED',
          suspensionReason: reason,
        };
        break;
      }
      case 'FREEZE': {
        updateData = {
          status: 'FROZEN',
          suspensionReason: reason,
        };
        break;
      }
      case 'ACTIVATE': {
        updateData = {
          status: 'ACTIVE',
          suspensionReason: null,
        };
        break;
      }
      default:
        return jsonError(`Invalid action "${action}". Allowed: RENEW, SUSPEND, FREEZE, ACTIVATE.`, 400);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const membership = await tx.membership.update({
        where: { id: membershipId },
        data: updateData,
      });

      const afterState = JSON.stringify({
        status: membership.status,
        startDate: membership.startDate,
        expiryDate: membership.expiryDate,
        suspensionReason: membership.suspensionReason,
      });

      // Write non-cascading audit log
      await tx.membershipAudit.create({
        data: {
          membershipId,
          adminId: admin.id,
          action,
          beforeState,
          afterState,
          reason,
        },
      });

      // If suspended, revoke all active sessions for this member immediately
      if (action === 'SUSPEND') {
        await tx.session.updateMany({
          where: { userId: currentMembership.userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }

      return membership;
    });

    return jsonSuccess({
      message: `Membership ${action.toLowerCase()} completed successfully.`,
      membership: updated,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Membership update failed.';
    return jsonError(message, 400);
  }
}
