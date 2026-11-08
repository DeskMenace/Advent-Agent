import { describe, expect, it } from 'vitest';
import { buildReminderIcs } from '../../src/core/reminder.js';

describe('.ics reminder (D19)', () => {
  it('has 24 daily events at the unlock hour in the season timezone, written in UTC', () => {
    const ics = buildReminderIcs({ year: 2026, timeZone: 'Europe/Zurich', unlockHour: 7 }, new Date('2026-11-08T12:00:00Z'));
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(24);
    expect(ics).toContain('DTSTART:20261201T060000Z'); // 07:00 Zurich (UTC+1)
    expect(ics).toContain('DTSTART:20261224T060000Z');
    expect(ics).toContain('SUMMARY:Your door is open: December 9');
    expect(ics).not.toMatch(/http(s)?:\/\/(?!127\.0\.0\.1)/);
    for (const line of ics.split('\r\n')) expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75);
  });
  it('midnight in New York lands at 05:00 UTC', () => {
    const ics = buildReminderIcs({ year: 2026, timeZone: 'America/New_York', unlockHour: 0 });
    expect(ics).toContain('DTSTART:20261201T050000Z');
  });
});
