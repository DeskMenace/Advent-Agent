/**
 * TEST_PLAN §4: real-agent smoke tests. Opt-in (ADVENT_REAL_AGENTS=1), costs tokens, runs locally only.
 * For each installed CLI: a lab season, one small gift with a ~10k-token budget, assert progress reported,
 * gate passed, gift rendered. Results are appended to docs/AGENT_COMPAT.md.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { appendFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { detectAll } from '../../src/adapters/index.js';
import { startCompanion, type Companion } from '../../src/server/companion.js';
import { freePort, waitFor } from '../helpers/companion.js';
import type { LaunchedAdapterId } from '../../src/shared/config.js';

const enabled = process.env.ADVENT_REAL_AGENTS === '1';
const only = process.env.ADVENT_REAL_AGENTS_ONLY?.split(',').map((s) => s.trim()).filter(Boolean);
const compatFile = join(process.cwd(), 'docs', 'AGENT_COMPAT.md');

describe.skipIf(!enabled)('real agents (opt-in)', () => {
  let home: string;
  let companion: Companion;
  let installed: Array<{ id: LaunchedAdapterId; label: string; version?: string }> = [];

  beforeAll(async () => {
    home = mkdtempSync(join(tmpdir(), 'aa-real-'));
    const detected = await detectAll();
    installed = detected.filter((d) => d.detection.installed && d.capabilities.headless && (!only || only.includes(d.id))).map((d) => ({ id: d.id, label: d.label, version: d.detection.version }));
    const appPort = await freePort();
    const giftPort = await freePort();
    companion = await startCompanion({ homeRoot: home, appPort, giftPort, allowRealAgents: true, schedulerIntervalMs: 3_600_000 });
    companion.service.store.saveConfig({
      setupComplete: true,
      timeZone: 'Europe/Zurich',
      budgets: { generosity: 'light', tokenTarget: 10_000, realWorldSuggestions: true, usdCapPerGift: 0.5 },
      permissions: { webResearch: false, inspirationFolders: [], giftNetwork: false },
      timeoutMinutes: 12,
      connection: { mode: 'launched', permissive: false },
    });
    companion.service.store.saveProfile({ hobbies: ['winter walks', 'crossword puzzles'], humour: 'dry', language: 'English' });
    companion.service.ensureSeason('lab', 2026);
    writeFileSync(companion.service.store.home.demoFile, JSON.stringify({ simulatedDay: 24 }));
    if (!existsSync(compatFile)) writeFileSync(compatFile, '# Agent compatibility\n\n## Smoke-test results\n');
  }, 60_000);

  afterAll(async () => {
    await companion?.close();
    rmSync(home, { recursive: true, force: true });
  });

  it('found at least one agent to test (set ADVENT_REAL_AGENTS_ONLY to narrow)', () => {
    expect(installed.length).toBeGreaterThan(0);
  });

  for (const id of ['claude-code', 'codex', 'gemini', 'opencode', 'cursor', 'copilot', 'goose', 'amp', 'muse'] as LaunchedAdapterId[]) {
    it(`${id}: prepares one small gift through the launched path`, async (ctx) => {
      const agent = installed.find((a) => a.id === id);
      if (!agent) { ctx.skip(); return; }
      const day = (['claude-code', 'codex', 'gemini', 'opencode', 'cursor', 'copilot', 'goose', 'amp', 'muse'] as string[]).indexOf(id) + 1;
      companion.service.store.saveConfig((c) => ({ ...c, connection: { ...c.connection, mode: 'launched', adapter: id } }));
      companion.service.updateSeasonFromConfig();
      writeFileSync(join(companion.service.store.home.doorDir(2026, day), 'lab.json'), JSON.stringify({ idea: 'jelly-fruit', agent: id }));
      const phases = new Set<string>();
      companion.service.events.onSse((e) => { if (e.type === 'door' && e.door.day === day && e.door.phase) phases.add(e.door.phase); });
      const started = Date.now();
      companion.service.open(day);
      const final = await waitFor(() => companion.service.store.doors(2026).read(day), (s) => s.jobState === 'ready' || s.jobState === 'failed', 14 * 60_000, 1000);
      const duration = Math.round((Date.now() - started) / 1000);
      const usage = final.attempts.at(-1)?.usage;
      const log = existsSync(companion.service.store.home.logFile(2026, day)) ? readFileSync(companion.service.store.home.logFile(2026, day), 'utf8') : '';
      const flags = log.match(/^\$ (.*)$/m)?.[1] ?? '';
      const line = `| ${agent.label} | ${agent.version ?? '?'} | ${new Date().toISOString().slice(0, 10)} | ${final.jobState}${final.failure ? ` (${final.failure.code})` : ''} | ${[...phases].join(', ') || 'none'} | ${final.gift?.kind ?? '-'} | ${duration}s | ${usage?.tokens ?? '?'} tokens${usage?.usd ? `, $${usage.usd.toFixed(3)}` : ''} | \`${flags.replace(/\|/g, '\\|').slice(0, 160)}\` |\n`;
      appendFileSync(compatFile, line);
      expect(final.jobState, final.failure?.userMessage).toBe('ready');
      expect(final.gift).toBeDefined();
      // The gift renders: the primary file exists in the sealed folder.
      const sealedDir = companion.service.store.home.giftDir(2026, day);
      expect(existsSync(join(sealedDir, '.advent', 'manifest.sealed.json'))).toBe(true);
      if (final.gift?.manifest.primary) expect(existsSync(join(sealedDir, ...final.gift.manifest.primary.split('/')))).toBe(true);
      // Launched agents that can run commands reported at least one phase.
      if (id !== 'gemini') expect(phases.size).toBeGreaterThan(0);
    }, 15 * 60_000);
  }
});
