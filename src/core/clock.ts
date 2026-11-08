/**
 * Time source. Real by default. Demo and lab homes may simulate a December day; tests may pin "now"
 * through ADVENT_AGENT_FAKE_NOW, honoured only for a non-default home (never for ~/.advent-agent).
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
  return { now: () => fakeNow(opts.homeRoot) ?? new Date() };
}

function fakeNow(homeRoot: string): Date | undefined {
  const v = process.env.ADVENT_AGENT_FAKE_NOW;
  if (!v || isDefaultHome(homeRoot)) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}
