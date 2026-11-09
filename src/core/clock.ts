/**
 * Time source. Real by default. Demo and lab homes may simulate a December day; tests may pin "now"
 * through ADVENT_AGENT_FAKE_NOW, honoured only for a non-default home (never for ~/.advent-agent).
 * Developers can pretend a date on any home with ADVENT_PRETEND_DATE (or `--pretend-date`), never from the UI.
 */
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { zonedTimeToUtc } from './time.js';

export interface Clock {
  now(): Date;
}

export const realClock: Clock = { now: () => new Date() };

export interface DemoState {
  simulatedDay?: number; // 0 = before December, 1–24
}

export function readDemoState(homeRoot: string): DemoState {
  const file = join(homeRoot, 'demo.json');
  if (!existsSync(file)) return {};
  try {
    const raw = JSON.parse(readFileSync(file, 'utf8')) as DemoState;
    return typeof raw.simulatedDay === 'number' ? { simulatedDay: Math.max(0, Math.min(24, Math.floor(raw.simulatedDay))) } : {};
  } catch {
    return {};
  }
}

export function isDefaultHome(root: string): boolean {
  return root === join(homedir(), '.advent-agent');
}

/**
 * Build the clock for a home. Simulation sources, in order: demo.json (demo/lab homes), ADVENT_AGENT_FAKE_NOW (non-default homes).
 */
export function makeClock(opts: { homeRoot: string; seasonYear: number; timeZone: string; unlockHour: number; kind: 'live' | 'demo' | 'lab' }): Clock {
  if (opts.kind !== 'live') {
    return {
      now: () => {
        const demo = readDemoState(opts.homeRoot);
        if (demo.simulatedDay !== undefined) {
          if (demo.simulatedDay === 0) return zonedTimeToUtc(opts.timeZone, opts.seasonYear, 11, 20, 12, 0);
          // Noon on the simulated day, after the unlock hour whatever it is.
          return zonedTimeToUtc(opts.timeZone, opts.seasonYear, 12, demo.simulatedDay, Math.max(12, opts.unlockHour), 1);
        }
        return fakeNow(opts.homeRoot) ?? new Date();
      },
    };
  }
  return { now: () => pretendNow(opts.timeZone) ?? fakeNow(opts.homeRoot) ?? new Date() };
}

/**
 * Developer-only date pretending (handoff §Principles). `2026-12-08` keeps the real time of day in the season's
 * timezone, so the clock still moves; a full ISO timestamp (`2026-12-08T07:30:00Z`) pins an exact instant.
 */
export function pretendNow(timeZone: string, value = process.env.ADVENT_PRETEND_DATE, real = new Date()): Date | undefined {
  if (!value) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (m) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23' }).formatToParts(real).map((p) => [p.type, p.value]));
    const at = zonedTimeToUtc(timeZone, Number(m[1]), Number(m[2]), Number(m[3]), Number(parts.hour), Number(parts.minute), Number(parts.second));
    return new Date(at.getTime() + real.getMilliseconds());
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function fakeNow(homeRoot: string): Date | undefined {
  const v = process.env.ADVENT_AGENT_FAKE_NOW;
  if (!v || isDefaultHome(homeRoot)) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}
