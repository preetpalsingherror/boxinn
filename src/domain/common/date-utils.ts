/**
 * Pure date and calendar utility functions for BOX INN Companion domain logic.
 * Enforces gym-local calendar boundaries (Asia/Kolkata timezone: UTC+5:30).
 */

export const GYM_TIMEZONE = 'Asia/Kolkata';

/**
 * Validates whether a string matches strict YYYY-MM-DD format.
 */
export function isValidISODateString(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * Returns the calendar date string (YYYY-MM-DD) for a given timestamp in Asia/Kolkata.
 */
export function toGymLocalDate(date: Date, timeZone: string = GYM_TIMEZONE): string {
  // Using Intl.DateTimeFormat for accurate timezone conversion
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

/**
 * Calculates the exact integer difference in calendar days between two YYYY-MM-DD date strings.
 * Result is positive if `toDateStr` is chronologically after `fromDateStr`.
 * Example:
 *   calendarDaysBetween('2026-10-01', '2026-10-02') === 1
 *   calendarDaysBetween('2026-10-01', '2026-10-05') === 4
 */
export function calendarDaysBetween(fromDateStr: string, toDateStr: string): number {
  if (!isValidISODateString(fromDateStr) || !isValidISODateString(toDateStr)) {
    throw new Error(`Invalid calendar date format. Expected YYYY-MM-DD. Received: ${fromDateStr}, ${toDateStr}`);
  }

  const [fromY, fromM, fromD] = fromDateStr.split('-').map(Number);
  const [toY, toM, toD] = toDateStr.split('-').map(Number);

  const fromUtc = Date.UTC(fromY, fromM - 1, fromD);
  const toUtc = Date.UTC(toY, toM - 1, toD);

  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  return Math.round((toUtc - fromUtc) / MS_PER_DAY);
}

/**
 * Adds an integer number of calendar days to a YYYY-MM-DD date string.
 */
export function addCalendarDays(dateStr: string, days: number): string {
  if (!isValidISODateString(dateStr)) {
    throw new Error(`Invalid calendar date format. Expected YYYY-MM-DD. Received: ${dateStr}`);
  }

  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));

  const newY = date.getUTCFullYear();
  const newM = String(date.getUTCMonth() + 1).padStart(2, '0');
  const newD = String(date.getUTCDate()).padStart(2, '0');

  return `${newY}-${newM}-${newD}`;
}
