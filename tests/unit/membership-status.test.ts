import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateMembershipStatus,
  checkMembershipAccess,
  isExpiringSoon,
} from '../../src/domain/membership/membership-status.ts';
import type { MembershipRecord } from '../../src/domain/membership/membership-status.ts';

describe('Domain: membership-status & validity rules', () => {
  const baseMembership: MembershipRecord = {
    id: 'mem-101',
    userId: 'user-202',
    planName: 'General Training (CrossFit)',
    startDate: '2026-10-01',
    expiryDate: '2026-10-24',
    adminStatus: 'ACTIVE',
  };

  it('allows access on the start date', () => {
    const result = checkMembershipAccess(baseMembership, '2026-10-01');
    assert.equal(result.allowed, true);
    assert.equal(result.derivedStatus, 'ACTIVE');
    assert.equal(result.daysRemaining, 23);
  });

  it('allows access in the middle of the membership period', () => {
    const result = checkMembershipAccess(baseMembership, '2026-10-15');
    assert.equal(result.allowed, true);
    assert.equal(result.derivedStatus, 'ACTIVE');
    assert.equal(result.daysRemaining, 9);
  });

  it('INCLUSIVE EXPIRY: allows access on the exact recorded expiry date', () => {
    // Membership is valid through the recorded expiry date, inclusive
    const result = checkMembershipAccess(baseMembership, '2026-10-24');
    assert.equal(result.allowed, true);
    assert.equal(result.derivedStatus, 'ACTIVE');
    assert.equal(result.daysRemaining, 0);
  });

  it('STRICT CUTOFF: blocks access starting at 00:00 on the day after expiry', () => {
    // Expiry date was 2026-10-24; 2026-10-25 is the day after
    const result = checkMembershipAccess(baseMembership, '2026-10-25');
    assert.equal(result.allowed, false);
    assert.equal(result.derivedStatus, 'EXPIRED');
    assert.match(result.reason || '', /expired on 2026-10-24/i);
  });

  it('NO AUTOMATIC GRACE PERIOD: subsequent days remain strictly blocked', () => {
    const day2After = checkMembershipAccess(baseMembership, '2026-10-26');
    const day3After = checkMembershipAccess(baseMembership, '2026-10-27');
    assert.equal(day2After.allowed, false);
    assert.equal(day2After.derivedStatus, 'EXPIRED');
    assert.equal(day3After.allowed, false);
    assert.equal(day3After.derivedStatus, 'EXPIRED');
  });

  it('blocks access if the membership has not started yet', () => {
    const result = checkMembershipAccess(baseMembership, '2026-09-30');
    assert.equal(result.allowed, false);
    assert.equal(result.derivedStatus, 'NOT_STARTED');
    assert.match(result.reason || '', /starts on 2026-10-01/i);
  });

  it('ADMIN OVERRIDE: frozen status blocks access even during valid dates', () => {
    const frozenMembership: MembershipRecord = {
      ...baseMembership,
      adminStatus: 'FROZEN',
    };
    const result = checkMembershipAccess(frozenMembership, '2026-10-15');
    assert.equal(result.allowed, false);
    assert.equal(result.derivedStatus, 'FROZEN');
  });

  it('ADMIN EXTENSION: extending expiry date immediately restores active access', () => {
    // Member was expired as of 2026-10-25
    assert.equal(checkMembershipAccess(baseMembership, '2026-10-25').allowed, false);

    // Admin extends membership by 1 month to 2026-11-24
    const extendedMembership: MembershipRecord = {
      ...baseMembership,
      expiryDate: '2026-11-24',
    };
    const afterExtension = checkMembershipAccess(extendedMembership, '2026-10-25');
    assert.equal(afterExtension.allowed, true);
    assert.equal(afterExtension.derivedStatus, 'ACTIVE');
    assert.equal(afterExtension.daysRemaining, 30);
  });

  it('MANUAL SUSPENSION: overrides valid dates and blocks check-in with reason', () => {
    const suspendedMembership: MembershipRecord = {
      ...baseMembership,
      adminStatus: 'SUSPENDED',
      suspensionReason: 'Payment dispute under investigation',
    };
    // Middle of membership period (2026-10-15), which would otherwise be active
    const result = checkMembershipAccess(suspendedMembership, '2026-10-15');
    assert.equal(result.allowed, false);
    assert.equal(result.derivedStatus, 'SUSPENDED');
    assert.match(result.reason || '', /Membership is suspended: Payment dispute under investigation/i);
  });

  it('SUSPENDED vs EXPIRED: provides distinct status and messaging', () => {
    // 1. Expired membership: temporal natural expiry
    const expiredResult = checkMembershipAccess(baseMembership, '2026-10-25');
    assert.equal(expiredResult.derivedStatus, 'EXPIRED');
    assert.match(expiredResult.reason || '', /Membership expired on 2026-10-24\. Please renew/i);

    // 2. Suspended membership: administrative action requiring staff intervention
    const suspendedMembership: MembershipRecord = {
      ...baseMembership,
      adminStatus: 'SUSPENDED',
      suspensionReason: 'Disciplinary hold',
    };
    const suspendedResult = checkMembershipAccess(suspendedMembership, '2026-10-15');
    assert.equal(suspendedResult.derivedStatus, 'SUSPENDED');
    assert.match(suspendedResult.reason || '', /Membership is suspended: Disciplinary hold\. Please contact gym administration/i);
  });

  it('LIFTING SUSPENSION: restoring admin status to ACTIVE immediately restores access', () => {
    const suspendedMembership: MembershipRecord = {
      ...baseMembership,
      adminStatus: 'SUSPENDED',
      suspensionReason: 'Medical freeze',
    };
    assert.equal(checkMembershipAccess(suspendedMembership, '2026-10-15').allowed, false);

    // Admin lifts the suspension
    const reactivated: MembershipRecord = {
      ...suspendedMembership,
      adminStatus: 'ACTIVE',
      suspensionReason: undefined,
    };
    const activeResult = checkMembershipAccess(reactivated, '2026-10-15');
    assert.equal(activeResult.allowed, true);
    assert.equal(activeResult.derivedStatus, 'ACTIVE');
  });

  it('calculates expiring-soon threshold properly', () => {
    assert.equal(isExpiringSoon(baseMembership, '2026-10-10', 7), false); // 14 days left
    assert.equal(isExpiringSoon(baseMembership, '2026-10-17', 7), true);  // 7 days left
    assert.equal(isExpiringSoon(baseMembership, '2026-10-24', 7), true);  // 0 days left
    assert.equal(isExpiringSoon(baseMembership, '2026-10-25', 7), false); // Already expired
  });
});
