/**
 * Pure domain logic for membership evaluation and access rules.
 * Adheres strictly to the BOX INN business decisions:
 * - Inclusive expiry: Valid through 23:59:59 on the recorded expiry date in Asia/Kolkata.
 * - Access is blocked starting at 00:00 on the day after expiry.
 * - No automatic grace period.
 * - Status is derived deterministically from authoritative dates and administrative status.
 */

import { calendarDaysBetween, isValidISODateString } from '../common/date-utils.ts';

export type MembershipAdminStatus = 'ACTIVE' | 'SUSPENDED' | 'FROZEN' | 'CANCELLED';

export type DerivedMembershipStatus = 
  | 'ACTIVE'
  | 'NOT_STARTED'
  | 'EXPIRED'
  | 'SUSPENDED'
  | 'FROZEN'
  | 'CANCELLED';

export interface MembershipRecord {
  id: string;
  userId: string;
  planName: string;
  startDate: string; // YYYY-MM-DD
  expiryDate: string; // YYYY-MM-DD
  adminStatus: MembershipAdminStatus;
  suspensionReason?: string;
}

export interface AccessCheckResult {
  allowed: boolean;
  derivedStatus: DerivedMembershipStatus;
  reason?: string;
  daysRemaining?: number;
}

/**
 * Evaluates the derived membership status for a given gym calendar date (YYYY-MM-DD).
 */
export function evaluateMembershipStatus(
  membership: MembershipRecord,
  gymDate: string
): DerivedMembershipStatus {
  if (!isValidISODateString(gymDate)) {
    throw new Error(`Invalid gym date: ${gymDate}`);
  }

  // Administrative suspension, freeze or cancellation takes immediate precedence over calendar dates
  if (membership.adminStatus === 'SUSPENDED') {
    return 'SUSPENDED';
  }
  if (membership.adminStatus === 'FROZEN') {
    return 'FROZEN';
  }
  if (membership.adminStatus === 'CANCELLED') {
    return 'CANCELLED';
  }

  if (gymDate < membership.startDate) {
    return 'NOT_STARTED';
  }

  // Inclusive expiry: gymDate <= expiryDate is ACTIVE.
  // Starting at 00:00 on the day after expiry (gymDate > expiryDate), status is EXPIRED.
  if (gymDate > membership.expiryDate) {
    return 'EXPIRED';
  }

  return 'ACTIVE';
}

/**
 * Checks whether the member is authorized to check in or access member-only features on a gym date.
 */
export function checkMembershipAccess(
  membership: MembershipRecord | null,
  gymDate: string
): AccessCheckResult {
  if (!membership) {
    return {
      allowed: false,
      derivedStatus: 'EXPIRED',
      reason: 'No membership record found.',
    };
  }

  const derivedStatus = evaluateMembershipStatus(membership, gymDate);

  if (derivedStatus === 'ACTIVE') {
    const daysRemaining = calendarDaysBetween(gymDate, membership.expiryDate);
    return {
      allowed: true,
      derivedStatus: 'ACTIVE',
      daysRemaining,
    };
  }

  let reason = 'Membership is not active.';
  if (derivedStatus === 'SUSPENDED') {
    reason = membership.suspensionReason
      ? `Membership is suspended: ${membership.suspensionReason}. Please contact gym administration.`
      : 'Membership has been suspended by administration. Please contact staff.';
  } else if (derivedStatus === 'EXPIRED') {
    reason = `Membership expired on ${membership.expiryDate}. Please renew to access the gym.`;
  } else if (derivedStatus === 'NOT_STARTED') {
    reason = `Membership starts on ${membership.startDate}.`;
  } else if (derivedStatus === 'FROZEN') {
    reason = 'Membership is currently frozen by administration.';
  } else if (derivedStatus === 'CANCELLED') {
    reason = 'Membership has been cancelled.';
  }

  return {
    allowed: false,
    derivedStatus,
    reason,
  };
}

/**
 * Determines whether a membership is expiring soon (within threshold calendar days).
 */
export function isExpiringSoon(
  membership: MembershipRecord,
  gymDate: string,
  thresholdDays: number = 7
): boolean {
  const status = evaluateMembershipStatus(membership, gymDate);
  if (status !== 'ACTIVE') return false;

  const daysRemaining = calendarDaysBetween(gymDate, membership.expiryDate);
  return daysRemaining >= 0 && daysRemaining <= thresholdDays;
}
