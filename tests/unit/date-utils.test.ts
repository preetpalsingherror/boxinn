import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calendarDaysBetween,
  addCalendarDays,
  isValidISODateString,
  toGymLocalDate,
} from '../../src/domain/common/date-utils.ts';

describe('Domain: date-utils', () => {
  it('validates YYYY-MM-DD date strings accurately', () => {
    assert.equal(isValidISODateString('2026-10-24'), true);
    assert.equal(isValidISODateString('2024-02-29'), true); // Leap year
    assert.equal(isValidISODateString('2025-02-29'), false); // Not a leap year
    assert.equal(isValidISODateString('2026-13-01'), false); // Invalid month
    assert.equal(isValidISODateString('2026-10-32'), false); // Invalid day
    assert.equal(isValidISODateString('not-a-date'), false);
  });

  it('calculates calendar days between dates across month and leap boundaries', () => {
    assert.equal(calendarDaysBetween('2026-10-01', '2026-10-02'), 1);
    assert.equal(calendarDaysBetween('2026-10-01', '2026-10-05'), 4);
    assert.equal(calendarDaysBetween('2026-09-30', '2026-10-01'), 1);
    assert.equal(calendarDaysBetween('2026-10-05', '2026-10-01'), -4);
    assert.equal(calendarDaysBetween('2024-02-28', '2024-03-01'), 2); // Leap year February
  });

  it('adds calendar days correctly', () => {
    assert.equal(addCalendarDays('2026-10-24', 1), '2026-10-25');
    assert.equal(addCalendarDays('2026-10-31', 1), '2026-11-01');
    assert.equal(addCalendarDays('2024-02-28', 1), '2024-02-29');
    assert.equal(addCalendarDays('2026-10-24', -4), '2026-10-20');
  });

  it('converts timestamps to Asia/Kolkata date', () => {
    // 2026-10-24 18:40:00 UTC is 2026-10-25 00:10:00 IST (+5:30)
    const lateUtc = new Date(Date.UTC(2026, 9, 24, 18, 40, 0));
    assert.equal(toGymLocalDate(lateUtc, 'Asia/Kolkata'), '2026-10-25');

    // 2026-10-24 18:20:00 UTC is 2026-10-24 23:50:00 IST
    const beforeMidnightUtc = new Date(Date.UTC(2026, 9, 24, 18, 20, 0));
    assert.equal(toGymLocalDate(beforeMidnightUtc, 'Asia/Kolkata'), '2026-10-24');
  });
});
