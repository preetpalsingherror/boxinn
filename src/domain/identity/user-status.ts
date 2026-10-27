/**
 * Pure domain logic for User account status and access permissions.
 * Invariants:
 * - A member cannot access any protected member features, check-in, or machine guides
 *   unless their account status is strictly 'ACTIVE'.
 * - 'PENDING_VERIFICATION' requires email verification before account activation.
 * - 'SUSPENDED' immediately revokes all access privileges.
 */

export type UserStatus = 'INVITED' | 'PENDING_VERIFICATION' | 'ACTIVE' | 'SUSPENDED';

export type UserRole = 'MEMBER' | 'ADMIN';

export interface UserAccessEvaluation {
  canAccess: boolean;
  status: UserStatus;
  reason?: string;
}

export function evaluateUserAccountAccess(status: UserStatus): UserAccessEvaluation {
  switch (status) {
    case 'ACTIVE':
      return { canAccess: true, status: 'ACTIVE' };
    case 'PENDING_VERIFICATION':
      return {
        canAccess: false,
        status: 'PENDING_VERIFICATION',
        reason: 'Email address is pending verification. Please check your inbox and verify your email to activate your account.',
      };
    case 'INVITED':
      return {
        canAccess: false,
        status: 'INVITED',
        reason: 'Invitation has not yet been claimed.',
      };
    case 'SUSPENDED':
      return {
        canAccess: false,
        status: 'SUSPENDED',
        reason: 'Account has been suspended by administration. Please contact gym staff.',
      };
  }
}
