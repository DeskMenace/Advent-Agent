/**
 * Demo season: isolated home, fixture gifts for every renderer kind, a simulated day. Never runs an agent.
 * Fixture gift folders live in fixtures/gifts/<NN>-<kind>/ (built by scripts/build-fixtures.ts, shipped in the package).
 */
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PACKAGE_ROOT } from '../core/package-paths.js';
import type { CalendarService } from '../jobs/service.js';

export const FIXTURES_DIR = join(PACKAGE_ROOT, 'fixtures', 'gifts');

export function listFixtures(): Array<{ day: number; folder: string; name: string }> {
  if (!existsSync(FIXTURES_DIR)) return [];
  return readdirSync(FIXTURES_DIR)
    .filter((d) => /^\d{2}-/.test(d))
    .map((d) => ({ day: Number(d.slice(0, 2)), folder: join(FIXTURES_DIR, d), name: d.slice(3) }))
    .sort((a, b) => a.day - b.day);
}

export interface DemoOptions {
  simulatedDay?: number;
  /** Doors ≤ this number are pre-revealed so the shelf has content (default: none). */
  revealThrough?: number;
}

export async function installDemoFixtures(service: CalendarService, opts: DemoOptions = {}): Promise<void> {
  const store = service.store;
  if (!store.config().setupComplete) store.saveConfig({ setupComplete: true, connection: { mode: 'submit', permissive: false }, gary: { show: true } });
  service.ensureSeason('demo');
  writeFileSync(store.home.demoFile, JSON.stringify({ simulatedDay: opts.simulatedDay ?? 8 }));
  const season = service.season()!;
  const doors = store.doors(season.year);
  for (const f of listFixtures()) {
    const current = doors.read(f.day);
    if (current.jobState === 'ready' && current.gift?.adapter === 'fixture') continue;
    await service.installFixture(f.day, f.folder, (opts.revealThrough ?? 0) >= f.day);
  }
}
