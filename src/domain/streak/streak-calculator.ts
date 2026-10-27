/**
 * Pure domain logic for BOX INN Consistency Streak calculation.
 * 
 * Business Rules:
 * - Increases once per distinct attendance day.
 * - Up to three (3) intervening absent calendar days PRESERVE the streak.
 * - Four (4) or more intervening absent calendar days RESET the streak before the next qualifying check-in.
 * - Longest streak is permanently preserved.
 * - Supports safe, idempotent full recalculation after administrative attendance corrections.
 */

import { calendarDaysBetween, isValidISODateString } from '../common/date-utils.ts';

export interface StreakState {
  currentStreak: number;
  longestStreak: number;
  lastAttendanceDate: string | null; // YYYY-MM-DD
  streakStartDate: string | null;     // YYYY-MM-DD
}

export const INITIAL_STREAK_STATE: StreakState = {
  currentStreak: 0,
  longestStreak: 0,
  lastAttendanceDate: null,
  streakStartDate: null,
};

/**
 * Calculates the next streak state when a member attends on `newAttendanceDate` (YYYY-MM-DD).
 */
export function calculateStreakOnAttendance(
  previousState: StreakState,
  newAttendanceDate: string
): StreakState {
  if (!isValidISODateString(newAttendanceDate)) {
    throw new Error(`Invalid attendance date format: ${newAttendanceDate}`);
  }

  // Case 1: First ever attendance
  if (!previousState.lastAttendanceDate || previousState.currentStreak === 0) {
    const currentStreak = 1;
    return {
      currentStreak,
      longestStreak: Math.max(previousState.longestStreak, currentStreak),
      lastAttendanceDate: newAttendanceDate,
      streakStartDate: newAttendanceDate,
    };
  }

  const daysDiff = calendarDaysBetween(previousState.lastAttendanceDate, newAttendanceDate);

  // Case 2: Duplicate scan on the same gym calendar day
  if (daysDiff === 0) {
    return { ...previousState };
  }

  // Case 3: Attendance date in the past (out of chronological order)
  if (daysDiff < 0) {
    throw new Error(
      `Cannot apply historical attendance date (${newAttendanceDate}) directly to an existing state (${previousState.lastAttendanceDate}). Use recalculateFullStreak instead.`
    );
  }

  // Intervening absent days between previous visit and today
  // daysDiff = 1 -> absent days = 0 (consecutive days)
  // daysDiff = 2 -> absent days = 1
  // daysDiff = 3 -> absent days = 2
  // daysDiff = 4 -> absent days = 3 (preserved!)
  // daysDiff >= 5 -> absent days >= 4 (reset!)
  const absentDays = daysDiff - 1;

  let newCurrentStreak: number;
  let newStreakStartDate: string;

  if (absentDays <= 3) {
    // 0, 1, 2, or 3 absent days preserve and increment the streak
    newCurrentStreak = previousState.currentStreak + 1;
    newStreakStartDate = previousState.streakStartDate || newAttendanceDate;
  } else {
    // 4 or more absent days reset the streak
    newCurrentStreak = 1;
    newStreakStartDate = newAttendanceDate;
  }

  const newLongestStreak = Math.max(previousState.longestStreak, newCurrentStreak);

  return {
    currentStreak: newCurrentStreak,
    longestStreak: newLongestStreak,
    lastAttendanceDate: newAttendanceDate,
    streakStartDate: newStreakStartDate,
  };
}

/**
 * Evaluates the current active display streak for a member as of `asOfDate` (YYYY-MM-DD),
 * accounting for absent days elapsed since their last visit without requiring a check-in.
 */
export function evaluateActiveStreak(
  streakState: StreakState,
  asOfDate: string
): {
  displayStreak: number;
  longestStreak: number;
  isStreakActive: boolean;
  absentDaysElapsed: number;
  isGraceDay: boolean; // True on the 3rd absent day (last chance to preserve)
} {
  if (!streakState.lastAttendanceDate || streakState.currentStreak === 0) {
    return {
      displayStreak: 0,
      longestStreak: streakState.longestStreak,
      isStreakActive: false,
      absentDaysElapsed: 0,
      isGraceDay: false,
    };
  }

  const daysDiff = calendarDaysBetween(streakState.lastAttendanceDate, asOfDate);

  // If asOfDate is the same day or before last attendance
  if (daysDiff <= 0) {
    return {
      displayStreak: streakState.currentStreak,
      longestStreak: streakState.longestStreak,
      isStreakActive: true,
      absentDaysElapsed: 0,
      isGraceDay: false,
    };
  }

  const absentDaysElapsed = daysDiff - 1;

  if (absentDaysElapsed <= 3) {
    // Up to 3 absent days: streak is still active
    return {
      displayStreak: streakState.currentStreak,
      longestStreak: streakState.longestStreak,
      isStreakActive: true,
      absentDaysElapsed,
      isGraceDay: absentDaysElapsed === 3,
    };
  }

  // 4 or more full absent days have elapsed: streak has broken/reset
  return {
    displayStreak: 0,
    longestStreak: streakState.longestStreak,
    isStreakActive: false,
    absentDaysElapsed,
    isGraceDay: false,
  };
}

/**
 * Deterministically recalculates the entire streak state from a complete historical
 * ledger of attendance dates. Safe for administrative corrections.
 */
export function recalculateFullStreak(distinctAttendanceDates: string[]): StreakState {
  if (distinctAttendanceDates.length === 0) {
    return { ...INITIAL_STREAK_STATE };
  }

  // Deduplicate and sort chronologically in ascending order
  const uniqueSortedDates = Array.from(new Set(distinctAttendanceDates)).sort();

  let state: StreakState = { ...INITIAL_STREAK_STATE };

  for (const date of uniqueSortedDates) {
    state = calculateStreakOnAttendance(state, date);
  }

  return state;
}
