/**
 * Timezone-aware calendar rules (DESIGN_SPEC §9, D4). No dependencies: Intl does the zone work.
 */

export interface ZonedParts {
  year: number;
  month: number; // 1–12
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const partCache = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = partCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    partCache.set(timeZone, f);
  }
  return f;
}

export function isValidTimeZone(tz: string): boolean {
  try {
    formatter(tz);
    return true;
  } catch {
    return false;
  }
}

export function deviceTimeZone(): string {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return tz && isValidTimeZone(tz) ? tz : 'UTC';
}

/** Wall-clock parts of an instant in a zone. */
export function zonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = formatter(timeZone).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0');
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour') % 24, minute: get('minute'), second: get('second') };
}

function partsToUtcMs(p: ZonedParts): number {
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
}

/**
 * The instant at which a wall-clock time occurs in a zone. Handles DST by iterating on the offset.
 * For a non-existent local time (spring forward) the instant after the gap is returned;
 * for an ambiguous one (fall back) the earlier instant is returned.
 */
export function zonedTimeToUtc(timeZone: string, year: number, month: number, day: number, hour = 0, minute = 0, second = 0): Date {
  const wanted = Date.UTC(year, month - 1, day, hour, minute, second);
  let guess = wanted;
  for (let i = 0; i < 3; i++) {
    const offset = partsToUtcMs(zonedParts(new Date(guess), timeZone)) - guess;
    const next = wanted - offset;
    if (next === guess) break;
    guess = next;
  }
  // Prefer the earlier of two candidates when ambiguous.
  const earlier = guess - 3_600_000;
  if (partsToUtcMs(zonedParts(new Date(earlier), timeZone)) === wanted) return new Date(earlier);
  return new Date(guess);
}

export interface SeasonClockInput {
  year: number;
  timeZone: string;
  unlockHour: number;
}

export interface Eligibility {
  /** Highest eligible door, 0 before the first unlock. */
  eligibleThrough: number;
  /** The door whose calendar day it is right now (gold outline), 0 when none. */
  todayDay: number;
  nextUnlockAt?: string;
  countdownDays?: number;
  /** True once December 24 has unlocked. */
  seasonComplete: boolean;
  /** True when the current zoned date is after December 31 of the season year. */
  seasonEnded: boolean;
}

export function unlockInstant(season: SeasonClockInput, day: number): Date {
  return zonedTimeToUtc(season.timeZone, season.year, 12, day, season.unlockHour, 0, 0);
}

export function computeEligibility(now: Date, season: SeasonClockInput): Eligibility {
  let eligibleThrough = 0;
  for (let day = 1; day <= 24; day++) {
    if (unlockInstant(season, day).getTime() <= now.getTime()) eligibleThrough = day;
    else break;
  }
  const parts = zonedParts(now, season.timeZone);
  const seasonEnded = parts.year > season.year;
  let todayDay = 0;
  if (parts.year === season.year && parts.month === 12 && parts.day >= 1 && parts.day <= 24 && eligibleThrough >= 1) {
    // The gold "today" door is the most recently unlocked door while its calendar day lasts.
    todayDay = Math.min(parts.day, eligibleThrough);
    if (todayDay !== eligibleThrough) todayDay = eligibleThrough; // unlockHour > current hour: yesterday's door stays "today"
  }
  const result: Eligibility = { eligibleThrough, todayDay, seasonComplete: eligibleThrough === 24, seasonEnded };
  if (eligibleThrough < 24) {
    const next = unlockInstant(season, eligibleThrough + 1);
    result.nextUnlockAt = next.toISOString();
    if (eligibleThrough === 0) result.countdownDays = Math.max(0, Math.ceil((next.getTime() - now.getTime()) / 86_400_000));
  }
  return result;
}

export function isDoorEligible(now: Date, season: SeasonClockInput, day: number): boolean {
  if (day < 1 || day > 24) return false;
  return unlockInstant(season, day).getTime() <= now.getTime();
}

/** ISO date (YYYY-MM-DD) of an instant in a zone. */
export function zonedDateString(date: Date, timeZone: string): string {
  const p = zonedParts(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/** The season year a given instant belongs to: December → that year; January → previous year; otherwise this year (upcoming). */
export function seasonYearFor(now: Date, timeZone: string): number {
  const p = zonedParts(now, timeZone);
  return p.month === 1 ? p.year - 1 : p.year;
}

/** Scheduled preparation instant for a door: `scheduleTime` on the day before (or the day itself). */
export function scheduledPreparationInstant(
  season: SeasonClockInput & { scheduleTime?: string; prepareDayBefore?: boolean },
  day: number,
): Date {
  const [h, m] = (season.scheduleTime ?? '03:00').split(':').map(Number);
  const dayBefore = season.prepareDayBefore ?? true;
  const base = zonedTimeToUtc(season.timeZone, season.year, 12, day, 0, 0, 0);
  const dateParts = zonedParts(new Date(base.getTime() - (dayBefore ? 86_400_000 : 0) + 12 * 3_600_000), season.timeZone);
  return zonedTimeToUtc(season.timeZone, dateParts.year, dateParts.month, dateParts.day, h ?? 3, m ?? 0, 0);
}
