import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateStreakOnAttendance,
  evaluateActiveStreak,
  recalculateFullStreak,
  INITIAL_STREAK_STATE,
} from '../../src/domain/streak/streak-calculator.ts';
import type { StreakState } from '../../src/domain/streak/streak-calculator.ts';

describe('Domain: consistency streak engine & boundary matrix', () => {
  it('initializes a member on their first attendance', () => {
    const next = calculateStreakOnAttendance(INITIAL_STREAK_STATE, '2026-10-01');
    assert.equal(next.currentStreak, 1);
    assert.equal(next.longestStreak, 1);
    assert.equal(next.lastAttendanceDate, '2026-10-01');
    assert.equal(next.streakStartDate, '2026-10-01');
  });

  it('increments streak on consecutive days (0 absent days)', () => {
    let state = calculateStreakOnAttendance(INITIAL_STREAK_STATE, '2026-10-01');
    state = calculateStreakOnAttendance(state, '2026-10-02');
    state = calculateStreakOnAttendance(state, '2026-10-03');

    assert.equal(state.currentStreak, 3);
    assert.equal(state.longestStreak, 3);
    assert.equal(state.streakStartDate, '2026-10-01');
    assert.equal(state.lastAttendanceDate, '2026-10-03');
  });

  it('is idempotent on duplicate scans on the same gym date', () => {
    const s1 = calculateStreakOnAttendance(INITIAL_STREAK_STATE, '2026-10-01');
    const s2 = calculateStreakOnAttendance(s1, '2026-10-01');

    assert.deepEqual(s1, s2);
    assert.equal(s2.currentStreak, 1);
  });

  it('PRESERVES streak through 1 intervening absent day', () => {
    // Oct 1 (attended) -> Oct 2 (absent) -> Oct 3 (attended)
    let state = calculateStreakOnAttendance(INITIAL_STREAK_STATE, '2026-10-01');
    state = calculateStreakOnAttendance(state, '2026-10-03');

    assert.equal(state.currentStreak, 2);
    assert.equal(state.longestStreak, 2);
    assert.equal(state.lastAttendanceDate, '2026-10-03');
  });

  it('PRESERVES streak through 2 intervening absent days', () => {
    // Oct 3 (attended) -> Oct 4, Oct 5 (absent) -> Oct 6 (attended)
    let state: StreakState = {
      currentStreak: 2,
      longestStreak: 2,
      lastAttendanceDate: '2026-10-03',
      streakStartDate: '2026-10-01',
    };
    state = calculateStreakOnAttendance(state, '2026-10-06');

    assert.equal(state.currentStreak, 3);
    assert.equal(state.longestStreak, 3);
    assert.equal(state.lastAttendanceDate, '2026-10-06');
  });

  it('PRESERVES streak through 3 intervening absent days (EXACT BOUNDARY)', () => {
    // Oct 6 (attended) -> Oct 7, Oct 8, Oct 9 (3 absent days) -> Oct 10 (attended)
    // Calendar day diff = 10 - 6 = 4 days -> absent days = 4 - 1 = 3 days.
    let state: StreakState = {
      currentStreak: 3,
      longestStreak: 3,
      lastAttendanceDate: '2026-10-06',
      streakStartDate: '2026-10-01',
    };
    state = calculateStreakOnAttendance(state, '2026-10-10');

    assert.equal(state.currentStreak, 4);
    assert.equal(state.longestStreak, 4);
    assert.equal(state.lastAttendanceDate, '2026-10-10');
    assert.equal(state.streakStartDate, '2026-10-01');
  });

  it('RESETS streak after 4 intervening absent days (EXACT BOUNDARY)', () => {
    // Oct 10 (attended) -> Oct 11, Oct 12, Oct 13, Oct 14 (4 absent days) -> Oct 15 (attended)
    // Calendar day diff = 15 - 10 = 5 days -> absent days = 5 - 1 = 4 days.
    let state: StreakState = {
      currentStreak: 4,
      longestStreak: 4,
      lastAttendanceDate: '2026-10-10',
      streakStartDate: '2026-10-01',
    };
    state = calculateStreakOnAttendance(state, '2026-10-15');

    // Current streak resets to 1
    assert.equal(state.currentStreak, 1);
    // Longest streak of 4 is permanently preserved!
    assert.equal(state.longestStreak, 4);
    assert.equal(state.lastAttendanceDate, '2026-10-15');
    assert.equal(state.streakStartDate, '2026-10-15');
  });

  it('RESETS streak after extended absence (e.g. 10 absent days) while preserving longest', () => {
    let state: StreakState = {
      currentStreak: 1,
      longestStreak: 12,
      lastAttendanceDate: '2026-10-01',
      streakStartDate: '2026-10-01',
    };
    state = calculateStreakOnAttendance(state, '2026-10-15');

    assert.equal(state.currentStreak, 1);
    assert.equal(state.longestStreak, 12);
  });

  it('handles leap year boundaries correctly (2024)', () => {
    // Feb 28, 2024 -> Feb 29 (1 absent day) -> March 1 (attended)
    let state = calculateStreakOnAttendance(INITIAL_STREAK_STATE, '2024-02-28');
    state = calculateStreakOnAttendance(state, '2024-03-01');

    assert.equal(state.currentStreak, 2);
    assert.equal(state.longestStreak, 2);
  });

  it('evaluates active display streak as of today without check-in', () => {
    const lastAttendedState: StreakState = {
      currentStreak: 5,
      longestStreak: 8,
      lastAttendanceDate: '2026-10-19', // Monday
      streakStartDate: '2026-10-10',
    };

    // Tuesday: 0 absent days elapsed
    const tue = evaluateActiveStreak(lastAttendedState, '2026-10-20');
    assert.equal(tue.displayStreak, 5);
    assert.equal(tue.isStreakActive, true);
    assert.equal(tue.absentDaysElapsed, 0);
    assert.equal(tue.isGraceDay, false);

    // Friday: 3 absent days elapsed (Tue, Wed, Thu). Last chance to preserve!
    const fri = evaluateActiveStreak(lastAttendedState, '2026-10-23');
    assert.equal(fri.displayStreak, 5);
    assert.equal(fri.isStreakActive, true);
    assert.equal(fri.absentDaysElapsed, 3);
    assert.equal(fri.isGraceDay, true);

    // Saturday: 4 full absent days elapsed (Tue, Wed, Thu, Fri). Streak has expired!
    const sat = evaluateActiveStreak(lastAttendedState, '2026-10-24');
    assert.equal(sat.displayStreak, 0);
    assert.equal(sat.isStreakActive, false);
    assert.equal(sat.absentDaysElapsed, 4);
    assert.equal(sat.longestStreak, 8); // Longest streak remains 8
  });

  it('recalculates full streak deterministically from historical attendance records', () => {
    // Member attended Oct 1, 2, 4 (absent Oct 3 -> preserved -> streak 3)
    // Oct 9 (absent Oct 5, 6, 7, 8 -> 4 absent days -> reset -> streak 1)
    // Oct 10 (consecutive -> streak 2)
    const dates = ['2026-10-01', '2026-10-02', '2026-10-04', '2026-10-09', '2026-10-10'];

    const recalculated = recalculateFullStreak(dates);
    assert.equal(recalculated.currentStreak, 2);
    assert.equal(recalculated.longestStreak, 3);
    assert.equal(recalculated.lastAttendanceDate, '2026-10-10');
    assert.equal(recalculated.streakStartDate, '2026-10-09');
  });

  it('safe recalculation when admin retroactively adds a missing attendance date', () => {
    // Suppose member had: Oct 1, Oct 2, Oct 6
    // Between Oct 2 and Oct 6 is 3 absent days (Oct 3, 4, 5) -> preserved -> streak 3
    // If admin adds Oct 7 -> streak 4
    const datesWithCorrection = ['2026-10-01', '2026-10-02', '2026-10-06', '2026-10-07'];
    const result = recalculateFullStreak(datesWithCorrection);

    assert.equal(result.currentStreak, 4);
    assert.equal(result.longestStreak, 4);
    assert.equal(result.lastAttendanceDate, '2026-10-07');
  });
});
