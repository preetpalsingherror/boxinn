/**
 * Pure domain logic for attendance session lifecycle and 3-hour automatic closure.
 * Business rules:
 * - A session automatically closes three hours after check-in.
 * - If the member manually checked out before 3 hours, the manual check-out time is honored.
 * - Closed state is deterministically computed from server-authoritative timestamps.
 */

export const SESSION_DURATION_HOURS = 3;
export const SESSION_DURATION_MS = SESSION_DURATION_HOURS * 60 * 60 * 1000; // 10,800,000 ms

export interface AttendanceSession {
  id: string;
  userId: string;
  gymDate: string; // YYYY-MM-DD
  checkInTime: Date;
  checkOutTime: Date | null;
  isAutoClosed: boolean;
}

export interface SessionEvaluation {
  isClosed: boolean;
  isAutoClosed: boolean;
  effectiveCheckOutTime: Date | null;
  autoCloseTime: Date;
  durationMs: number;
  remainingMs: number; // 0 if already closed
}

/**
 * Evaluates the status of an attendance session relative to the authoritative current server time.
 */
export function evaluateSessionClosure(
  checkInTime: Date,
  manualCheckOutTime: Date | null,
  currentTime: Date
): SessionEvaluation {
  const checkInMs = checkInTime.getTime();
  const autoCloseMs = checkInMs + SESSION_DURATION_MS;
  const autoCloseTime = new Date(autoCloseMs);
  const currentMs = currentTime.getTime();

  // Scenario 1: Manual checkout was already recorded
  if (manualCheckOutTime !== null) {
    const manualMs = manualCheckOutTime.getTime();
    return {
      isClosed: true,
      isAutoClosed: false,
      effectiveCheckOutTime: manualCheckOutTime,
      autoCloseTime,
      durationMs: Math.max(0, manualMs - checkInMs),
      remainingMs: 0,
    };
  }

  // Scenario 2: Current time is at or beyond the 3-hour automatic closure threshold
  if (currentMs >= autoCloseMs) {
    return {
      isClosed: true,
      isAutoClosed: true,
      effectiveCheckOutTime: autoCloseTime,
      autoCloseTime,
      durationMs: SESSION_DURATION_MS,
      remainingMs: 0,
    };
  }

  // Scenario 3: Session is currently active (within the 3-hour window)
  return {
    isClosed: false,
    isAutoClosed: false,
    effectiveCheckOutTime: null,
    autoCloseTime,
    durationMs: Math.max(0, currentMs - checkInMs),
    remainingMs: autoCloseMs - currentMs,
  };
}

/**
 * Handles duplicate scan detection for the same member on the same gym date.
 */
export interface DuplicateScanFeedback {
  isDuplicate: boolean;
  message: string;
  existingCheckInTime?: Date;
  sessionStatus?: SessionEvaluation;
}

export function handleDuplicateScan(
  existingAttendance: AttendanceSession | null,
  currentTime: Date
): DuplicateScanFeedback {
  if (!existingAttendance) {
    return {
      isDuplicate: false,
      message: 'New check-in permitted.',
    };
  }

  const sessionStatus = evaluateSessionClosure(
    existingAttendance.checkInTime,
    existingAttendance.checkOutTime,
    currentTime
  );

  const checkInFormatted = existingAttendance.checkInTime.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const message = sessionStatus.isClosed
    ? `You already completed your workout for today (checked in at ${checkInFormatted}). See you tomorrow!`
    : `You are already checked in today at ${checkInFormatted}. Workout in progress!`;

  return {
    isDuplicate: true,
    message,
    existingCheckInTime: existingAttendance.checkInTime,
    sessionStatus,
  };
}
