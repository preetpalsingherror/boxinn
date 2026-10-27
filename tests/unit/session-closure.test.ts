import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateSessionClosure,
  handleDuplicateScan,
  SESSION_DURATION_MS,
} from '../../src/domain/attendance/session-closure.policy.ts';
import type { AttendanceSession } from '../../src/domain/attendance/session-closure.policy.ts';

describe('Domain: attendance session closure & duplicate scan', () => {
  const checkIn = new Date('2026-10-24T06:00:00.000Z');

  it('keeps session open immediately after check-in (0 minutes elapsed)', () => {
    const evaluation = evaluateSessionClosure(checkIn, null, checkIn);
    assert.equal(evaluation.isClosed, false);
    assert.equal(evaluation.isAutoClosed, false);
    assert.equal(evaluation.effectiveCheckOutTime, null);
    assert.equal(evaluation.remainingMs, SESSION_DURATION_MS);
  });

  it('keeps session open at 1 hour 30 minutes elapsed', () => {
    const current = new Date(checkIn.getTime() + 90 * 60 * 1000);
    const evaluation = evaluateSessionClosure(checkIn, null, current);
    assert.equal(evaluation.isClosed, false);
    assert.equal(evaluation.isAutoClosed, false);
    assert.equal(evaluation.remainingMs, 90 * 60 * 1000);
    assert.equal(evaluation.durationMs, 90 * 60 * 1000);
  });

  it('automatically closes session at exact 3-hour boundary', () => {
    const exact3Hours = new Date(checkIn.getTime() + 3 * 60 * 60 * 1000);
    const evaluation = evaluateSessionClosure(checkIn, null, exact3Hours);
    assert.equal(evaluation.isClosed, true);
    assert.equal(evaluation.isAutoClosed, true);
    assert.equal(evaluation.effectiveCheckOutTime?.toISOString(), exact3Hours.toISOString());
    assert.equal(evaluation.remainingMs, 0);
  });

  it('automatically closes session when queried 6 hours later', () => {
    const sixHoursLater = new Date(checkIn.getTime() + 6 * 60 * 60 * 1000);
    const expectedAutoClose = new Date(checkIn.getTime() + 3 * 60 * 60 * 1000);
    const evaluation = evaluateSessionClosure(checkIn, null, sixHoursLater);
    assert.equal(evaluation.isClosed, true);
    assert.equal(evaluation.isAutoClosed, true);
    assert.equal(evaluation.effectiveCheckOutTime?.toISOString(), expectedAutoClose.toISOString());
    assert.equal(evaluation.remainingMs, 0);
  });

  it('honors manual check-out time if checked out early (e.g. 75 minutes)', () => {
    const earlyCheckOut = new Date(checkIn.getTime() + 75 * 60 * 1000);
    const evaluation = evaluateSessionClosure(checkIn, earlyCheckOut, new Date(checkIn.getTime() + 120 * 60 * 1000));
    assert.equal(evaluation.isClosed, true);
    assert.equal(evaluation.isAutoClosed, false);
    assert.equal(evaluation.effectiveCheckOutTime?.toISOString(), earlyCheckOut.toISOString());
    assert.equal(evaluation.durationMs, 75 * 60 * 1000);
  });

  it('provides friendly feedback when a duplicate scan occurs during active session', () => {
    const existing: AttendanceSession = {
      id: 'att-1',
      userId: 'user-1',
      gymDate: '2026-10-24',
      checkInTime: checkIn,
      checkOutTime: null,
      isAutoClosed: false,
    };

    const duplicateCheckTime = new Date(checkIn.getTime() + 45 * 60 * 1000);
    const feedback = handleDuplicateScan(existing, duplicateCheckTime);
    assert.equal(feedback.isDuplicate, true);
    assert.match(feedback.message, /Workout in progress/i);
  });

  it('provides friendly completion feedback when a duplicate scan occurs after session auto-closed', () => {
    const existing: AttendanceSession = {
      id: 'att-1',
      userId: 'user-1',
      gymDate: '2026-10-24',
      checkInTime: checkIn,
      checkOutTime: null,
      isAutoClosed: true,
    };

    const eveningCheckTime = new Date(checkIn.getTime() + 5 * 60 * 60 * 1000);
    const feedback = handleDuplicateScan(existing, eveningCheckTime);
    assert.equal(feedback.isDuplicate, true);
    assert.match(feedback.message, /already completed your workout for today.*See you tomorrow/i);
  });
});
