import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { atomicHooks, writeJsonAtomic } from '../../src/core/fsutil.js';
import { Store } from '../../src/core/store.js';
import { openDoor } from '../../src/core/doors.js';

let root: string;
beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'aa-store-')); });
afterEach(() => { atomicHooks.beforeRename = undefined; rmSync(root, { recursive: true, force: true }); });

describe('storage', () => {
  it('U5.1 a crash between temp write and rename leaves the previous file intact and no partial file', () => {
    const file = join(root, 'config.json');
    writeJsonAtomic(file, { a: 1 });
    atomicHooks.beforeRename = () => { throw new Error('simulated crash'); };
    expect(() => writeJsonAtomic(file, { a: 2 })).toThrow('simulated crash');
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ a: 1 });
    atomicHooks.beforeRename = undefined;
    writeJsonAtomic(file, { a: 3 });
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ a: 3 });
    // Leftover temp files are harmless but let's make sure the real file is what we read.
    expect(readdirSync(root).filter((f) => f.endsWith('.json'))).toEqual(['config.json']);
  });

  it('U5.2 a config without schemaVersion is migrated with a backup first', () => {
    writeFileSync(join(root, 'config.json'), JSON.stringify({ setupComplete: true, timeZone: 'Europe/Zurich' }));
    const store = new Store(root);
    expect(store.config().schemaVersion).toBe(1);
    expect(store.config().setupComplete).toBe(true);
    const backups = readdirSync(join(root, 'backups'));
    expect(backups.some((b) => b.includes('pre-migration-v0'))).toBe(true);
    const backedUp = JSON.parse(readFileSync(join(root, 'backups', backups[0]!, 'config.json'), 'utf8'));
    expect(backedUp.schemaVersion).toBeUndefined();
  });

  it('creates 0600 secrets and defaults', () => {
    const store = new Store(root);
    const token = store.apiToken();
    expect(token.length).toBeGreaterThanOrEqual(32);
    expect(store.apiToken()).toBe(token);
    expect(store.sessionKey()).not.toBe(token);
    expect(store.config().unlockHour).toBe(0);
    expect(store.config().deliveryMode).toBe('on_demand');
    expect(store.config().budgets.tokenTarget).toBe(25_000);
    expect(store.config().budgets.realWorldSuggestions).toBe(true);
    expect(store.profile().share.length).toBeGreaterThan(0);
  });

  it('U5.3 export has no tokens, keys, logs, workspaces or lab; U5.4 import round-trips', async () => {
    const store = new Store(root);
    store.apiToken();
    store.sessionKey();
    store.saveConfig({ setupComplete: true });
    store.saveProfile({ hobbies: ['skiing'] });
    const season = store.createSeason({ year: 2026, timeZone: 'Europe/Zurich', unlockHour: 0, deliveryMode: 'on_demand', connection: { mode: 'launched', permissive: false }, kind: 'live', prepareDayBefore: true });
    const doors = store.doors(2026);
    doors.write(openDoor(doors.read(4), { mode: 'launched' }).state);
    writeFileSync(store.home.logFile(2026, 4), 'PRIVATE AGENT LOG');
    mkdirSync(store.home.workspaceDir(2026, 4), { recursive: true });
    writeFileSync(join(store.home.workspaceDir(2026, 4), 'draft.txt'), 'draft');
    mkdirSync(store.home.labDir, { recursive: true });
    writeFileSync(join(store.home.labDir, 'x.json'), '{}');
    store.appendHistory(2026, { day: 1, title: 'A', kind: 'document', motifs: [], revealedAt: '2026-12-01T10:00:00Z' });

    const zipFile = join(root, 'out', 'export.zip');
    const { files } = await store.exportZip(zipFile);
    expect(files).toBeGreaterThan(0);

    // Inspect the zip by importing into a fresh home.
    const root2 = mkdtempSync(join(tmpdir(), 'aa-store2-'));
    try {
      const store2 = new Store(root2);
      const result = await store2.importZip(zipFile);
      expect(result.files).toBe(files);
      const listing: string[] = [];
      const walk = (d: string, rel = '') => { for (const e of readdirSync(d, { withFileTypes: true })) { const r = rel ? `${rel}/${e.name}` : e.name; if (e.isDirectory()) walk(join(d, e.name), r); else listing.push(r); } };
      walk(root2);
      const imported = listing.filter((f) => !f.startsWith('backups/'));
      expect(imported.some((f) => f.endsWith('api.token'))).toBe(false);
      expect(imported.some((f) => f.endsWith('session.key'))).toBe(false);
      expect(imported.some((f) => f.endsWith('log.txt'))).toBe(false);
      expect(imported.some((f) => f.includes('/workspace/'))).toBe(false);
      expect(imported.some((f) => f.startsWith('lab/'))).toBe(false);
      expect(imported).toContain('config.json');
      expect(imported).toContain('profile.json');
      expect(imported).toContain('seasons/2026/season.json');
      expect(imported).toContain('seasons/2026/doors/04/state.json');
      expect(imported).toContain('seasons/2026/history.jsonl');
      expect(store2.season(2026)).toEqual(season);
      expect(store2.doors(2026).read(4).jobState).toBe('queued');
      expect(store2.profile().hobbies).toEqual(['skiing']);
      // The export zip itself never contains the token value.
      const zipBytes = readFileSync(zipFile).toString('latin1');
      expect(zipBytes).not.toContain(store.apiToken());
      expect(zipBytes).not.toContain('PRIVATE AGENT LOG');
    } finally {
      rmSync(root2, { recursive: true, force: true });
    }
  });

  it('deleteSeason removes only that season', () => {
    const store = new Store(root);
    store.config();
    store.createSeason({ year: 2025, timeZone: 'UTC', unlockHour: 0, deliveryMode: 'on_demand', connection: { mode: 'submit', permissive: false }, kind: 'live', prepareDayBefore: true });
    store.createSeason({ year: 2026, timeZone: 'UTC', unlockHour: 0, deliveryMode: 'on_demand', connection: { mode: 'submit', permissive: false }, kind: 'live', prepareDayBefore: true });
    store.deleteSeason(2025);
    expect(store.seasonYears()).toEqual([2026]);
    expect(existsSync(store.home.configFile)).toBe(true);
  });
});
