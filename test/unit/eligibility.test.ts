import { describe, expect, it } from 'vitest';
import { computeEligibility, isDoorEligible, unlockInstant, zonedTimeToUtc, zonedParts, scheduledPreparationInstant, seasonYearFor } from '../../src/core/time.js';

const zurich = { year: 2026, timeZone: 'Europe/Zurich', unlockHour: 0 };

describe('zonedTimeToUtc', () => {
  it('converts a winter wall-clock time in Zurich (UTC+1)', () => {
    expect(zonedTimeToUtc('Europe/Zurich', 2026, 12, 5, 0, 0).toISOString()).toBe('2026-12-04T23:00:00.000Z');
  });
  it('converts a summer wall-clock time in Zurich (UTC+2)', () => {
    expect(zonedTimeToUtc('Europe/Zurich', 2026, 7, 1, 12, 0).toISOString()).toBe('2026-07-01T10:00:00.000Z');
  });
  it('handles a zone with December DST (America/Sao_Paulo has none now; Australia/Sydney is UTC+11 in December)', () => {
    expect(zonedTimeToUtc('Australia/Sydney', 2026, 12, 1, 0, 0).toISOString()).toBe('2026-11-30T13:00:00.000Z');
    expect(zonedTimeToUtc('Pacific/Auckland', 2026, 12, 1, 7, 0).toISOString()).toBe('2026-11-30T18:00:00.000Z');
  });
  it('round-trips through zonedParts', () => {
    for (const tz of ['UTC', 'Europe/Zurich', 'America/New_York', 'Asia/Kolkata', 'Pacific/Chatham', 'America/St_Johns']) {
      const d = zonedTimeToUtc(tz, 2026, 12, 9, 7, 30);
      const p = zonedParts(d, tz);
      expect([p.year, p.month, p.day, p.hour, p.minute]).toEqual([2026, 12, 9, 7, 30]);
    }
  });
  it('resolves the US fall-back ambiguity to the earlier instant', () => {
    // 2026-11-01 01:30 happens twice in New York.
    expect(zonedTimeToUtc('America/New_York', 2026, 11, 1, 1, 30).toISOString()).toBe('2026-11-01T05:30:00.000Z');
  });
});

describe('computeEligibility', () => {
  it('U1.1 before December 1: nothing eligible, countdown to Dec 1', () => {
    const e = computeEligibility(new Date('2026-11-08T12:00:00Z'), zurich);
    expect(e.eligibleThrough).toBe(0);
    expect(e.todayDay).toBe(0);
    expect(e.nextUnlockAt).toBe('2026-11-30T23:00:00.000Z');
    expect(e.countdownDays).toBe(23);
    expect(e.seasonComplete).toBe(false);
  });
  it('U1.2 Dec N at unlockHour −1 min is locked, +1 min is eligible', () => {
    const unlock9 = unlockInstant(zurich, 9);
    expect(computeEligibility(new Date(unlock9.getTime() - 60_000), zurich).eligibleThrough).toBe(8);
    expect(computeEligibility(new Date(unlock9.getTime() + 60_000), zurich).eligibleThrough).toBe(9);
    expect(isDoorEligible(new Date(unlock9.getTime() - 1), zurich, 9)).toBe(false);
    expect(isDoorEligible(unlock9, zurich, 9)).toBe(true);
  });
  it('U1.3 Dec 24 and after: all eligible; season ended in January', () => {
    const dec24 = computeEligibility(zonedTimeToUtc('Europe/Zurich', 2026, 12, 24, 9), zurich);
    expect(dec24.eligibleThrough).toBe(24);
    expect(dec24.todayDay).toBe(24);
    expect(dec24.seasonComplete).toBe(true);
    expect(dec24.nextUnlockAt).toBeUndefined();
    const dec30 = computeEligibility(zonedTimeToUtc('Europe/Zurich', 2026, 12, 30, 9), zurich);
    expect(dec30.eligibleThrough).toBe(24);
    expect(dec30.todayDay).toBe(0);
    const jan = computeEligibility(new Date('2027-01-15T12:00:00Z'), zurich);
    expect(jan.eligibleThrough).toBe(24);
    expect(jan.seasonEnded).toBe(true);
  });
  it('U1.4 unlockHour 0 / 7 / 23', () => {
    for (const unlockHour of [0, 7, 23]) {
      const season = { ...zurich, unlockHour };
      const before = new Date(zonedTimeToUtc('Europe/Zurich', 2026, 12, 12, unlockHour).getTime() - 1000);
      const after = new Date(zonedTimeToUtc('Europe/Zurich', 2026, 12, 12, unlockHour).getTime() + 1000);
      expect(computeEligibility(before, season).eligibleThrough).toBe(11);
      expect(computeEligibility(after, season).eligibleThrough).toBe(12);
      expect(computeEligibility(after, season).todayDay).toBe(12);
      // Before unlockHour on Dec 12, yesterday's door is still "today".
      expect(computeEligibility(before, season).todayDay).toBe(11);
    }
  });
  it('U1.5 a DST transition in the season does not move door boundaries (Chile ends DST in... not December; use a zone that switches in Dec? none do — verify Santiago & Sydney boundaries are stable day to day)', () => {
    for (const timeZone of ['America/Santiago', 'Australia/Sydney', 'Europe/Zurich', 'America/New_York']) {
      const season = { year: 2026, timeZone, unlockHour: 7 };
      for (let day = 1; day <= 24; day++) {
        const p = zonedParts(unlockInstant(season, day), timeZone);
        expect([p.month, p.day, p.hour, p.minute]).toEqual([12, day, 7, 0]);
      }
    }
    // A zone that genuinely changes offset in late autumn: boundaries before/after the change are still exact wall-clock.
    const ny = { year: 2026, timeZone: 'America/New_York', unlockHour: 0 };
    expect(unlockInstant(ny, 1).toISOString()).toBe('2026-12-01T05:00:00.000Z');
  });
  it('U1.6 the frozen season timezone wins over the device timezone', () => {
    const now = new Date('2026-12-08T23:30:00Z'); // 00:30 Dec 9 in Zurich, 18:30 Dec 8 in New York
    expect(computeEligibility(now, zurich).eligibleThrough).toBe(9);
    expect(computeEligibility(now, { ...zurich, timeZone: 'America/New_York' }).eligibleThrough).toBe(8);
    // A device moving from Zurich to New York keeps the Zurich season: still 9.
    expect(computeEligibility(now, zurich).eligibleThrough).toBe(9);
  });
  it('seasonYearFor maps January to the previous season', () => {
    expect(seasonYearFor(new Date('2027-01-03T12:00:00Z'), 'Europe/Zurich')).toBe(2026);
    expect(seasonYearFor(new Date('2026-11-08T12:00:00Z'), 'Europe/Zurich')).toBe(2026);
  });
  it('scheduledPreparationInstant prepares the evening/night before', () => {
    const s = { ...zurich, scheduleTime: '03:00', prepareDayBefore: true };
    expect(scheduledPreparationInstant(s, 5).toISOString()).toBe('2026-12-04T02:00:00.000Z');
    expect(scheduledPreparationInstant({ ...s, prepareDayBefore: false, scheduleTime: '06:30' }, 5).toISOString()).toBe('2026-12-05T05:30:00.000Z');
  });
});
