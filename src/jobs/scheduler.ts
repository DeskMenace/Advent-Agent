/**
 * Scheduler (ARCHITECTURE §3): day rollover events, scheduled preparation, catch-up after sleep or downtime.
 * Never pretends a run happened on time: late runs carry a reason.
 */
import { computeEligibility, scheduledPreparationInstant } from '../core/time.js';
import type { CalendarService } from './service.js';

export interface SchedulerOptions {
  intervalMs?: number;
  /** A gap between ticks longer than this means the process slept or was suspended. */
  sleepThresholdMs?: number;
  /** A run more than this late is marked late. */
  lateThresholdMs?: number;
}

export class Scheduler {
  private timer?: NodeJS.Timeout;
  private lastTick?: number;
  private lastEligible?: number;
  private readonly intervalMs: number;
  private readonly sleepThresholdMs: number;
  private readonly lateThresholdMs: number;
  private started = false;

  constructor(private readonly service: CalendarService, opts: SchedulerOptions = {}) {
    this.intervalMs = opts.intervalMs ?? 30_000;
    this.sleepThresholdMs = opts.sleepThresholdMs ?? Math.max(90_000, this.intervalMs * 3);
    this.lateThresholdMs = opts.lateThresholdMs ?? 10 * 60_000;
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.tick('startup');
    this.timer = setInterval(() => this.tick('interval'), this.intervalMs);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    this.started = false;
  }

  /** One pass. Exposed for tests. */
  tick(reason: 'startup' | 'interval' | 'wake' | 'manual' = 'manual'): void {
    const season = this.service.season();
    if (!season) return;
    const now = this.service.clock(season).now();
    const wallNow = Date.now();
    let woke = reason === 'wake';
    if (this.lastTick !== undefined && wallNow - this.lastTick > this.sleepThresholdMs) woke = true;
    this.lastTick = wallNow;

    const elig = computeEligibility(now, season);
    if (this.lastEligible !== undefined && elig.eligibleThrough !== this.lastEligible) {
      this.service.events.emitSse({ type: 'rollover', eligibleThrough: elig.eligibleThrough, todayDay: elig.todayDay });
    }
    this.lastEligible = elig.eligibleThrough;

    if (season.deliveryMode !== 'scheduled' || season.connection.mode !== 'launched' || season.kind === 'demo') return;
    const doors = this.service.store.doors(season.year).readAll();
    for (const door of doors) {
      if (door.jobState !== 'not_requested') continue;
      const due = scheduledPreparationInstant(season, door.day);
      if (due.getTime() > now.getTime()) continue;
      const lateBy = now.getTime() - due.getTime();
      const late = lateBy > this.lateThresholdMs
        ? { scheduledFor: due.toISOString(), reason: reason === 'startup' ? 'the calendar was not running' : woke ? 'your computer was asleep' : 'the preparation was delayed' }
        : undefined;
      try {
        this.service.openScheduled(door.day, late);
      } catch {
        /* a door that cannot be opened now is retried on the next tick */
      }
    }
  }
}
