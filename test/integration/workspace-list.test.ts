import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { testCompanion, waitFor, type TestCompanion } from '../helpers/companion.js';
import type { PublicDoor } from '../../src/shared/index.js';
import type { List, Persona, PersonaCandidate } from '../../src/shared/list.js';

let t: TestCompanion;
let userHome: string;
beforeEach(() => {
  userHome = realpathSync(mkdtempSync(join(tmpdir(), 'aa-uh-')));
  process.env.ADVENT_AGENT_USER_HOME = userHome;
});
afterEach(async () => {
  await t?.close();
  delete process.env.ADVENT_AGENT_USER_HOME;
  delete process.env.FAKE_AGENT_LIST_FAIL;
  rmSync(userHome, { recursive: true, force: true });
});

const door = (day: number) => async () => (await t.api<PublicDoor>('GET', `/api/doors/${day}`)).data;
const settled = (d: PublicDoor) => d.jobState === 'ready' || d.jobState === 'failed';
const ws = () => t.companion.service.store.home.seasonWorkspaceDir(2026);

describe('one workspace per season (D28 §3)', () => {
  it('every run starts in the season workspace; doors are subfolders; a later door can read an earlier sealed gift', async () => {
    t = await testCompanion({ scenario: 'happy' });
    await t.api('POST', '/api/doors/3/open');
    expect((await waitFor(door(3), settled)).jobState).toBe('ready');
    await t.api('POST', '/api/doors/5/open');
    expect((await waitFor(door(5), settled)).jobState).toBe('ready');
    const seen3 = JSON.parse(readFileSync(join(ws(), 'seen-3.json'), 'utf8')) as { cwd: string };
    const seen5 = JSON.parse(readFileSync(join(ws(), 'seen-5.json'), 'utf8')) as { cwd: string; doors: string[]; earlierGifts: string[] };
    expect(realpathSync(seen3.cwd)).toBe(realpathSync(ws()));
    expect(realpathSync(seen5.cwd)).toBe(realpathSync(ws()));
    expect(seen5.earlierGifts).toContain('03');
    expect(existsSync(join(ws(), 'doors', '03', 'gift', 'gift.json'))).toBe(true);
    // The copy of the sealed gift never carries our internal folder.
    expect(existsSync(join(ws(), 'doors', '03', 'gift', '.advent'))).toBe(false);
    // Door 5's own files landed in its own subfolder and are cleaned up after sealing.
    expect(existsSync(join(ws(), 'doors', '05'))).toBe(false);
    // The shim lives in the workspace root, not in a door.
    expect(existsSync(join(ws(), '.bin'))).toBe(true);
  });
});

describe('checking the list (D28 §4)', () => {
  it('runs once before the first door, reads only the allowed copies, merges lines tagged with their source, and the brief carries them', async () => {
    t = await testCompanion({ scenario: 'happy', config: { debugKeepWorkspace: true } });
    // The custom fake agent reads sources/*.md, so use the pasted box as the allowed source.
    expect((await t.api<List>('PUT', '/api/list', { pasted: '- Rows on the lake every morning\n- Dog called Biscuit\n- sk-ant-api03-' + 'z'.repeat(40) })).status).toBe(200);
    const phases = new Set<string>();
    t.companion.service.events.onSse((e) => { if (e.type === 'door' && e.door.phase) phases.add(e.door.phase); });
    await t.api('POST', '/api/doors/1/prepare');
    expect((await waitFor(door(1), settled)).jobState).toBe('ready');
    const list = (await t.api<List & { checking: boolean }>('GET', '/api/list')).data;
    expect(list.lines.map((l) => l.text)).toEqual(['Rows on the lake every morning', 'Dog called Biscuit']);
    expect(list.lines.every((l) => l.source)).toBe(true);
    expect(list.pasted).toBe('');
    expect(list.checks).toHaveLength(1);
    expect(list.checks[0]!.kind).toBe('first');
    expect(phases.has('list')).toBe(true);
    // The agent saw only the copied sources; the copies are gone afterwards.
    const run = JSON.parse(readFileSync(join(ws(), 'list', 'list-run.json'), 'utf8')) as { sources: string[] };
    expect(run.sources.sort()).toEqual(['INDEX.md', 'pasted.md']);
    expect(existsSync(join(ws(), 'list', 'sources'))).toBe(false);
    // Day 1's brief carries the list and the "use a real detail" wording.
    const brief = readFileSync(join(ws(), 'doors', '01', 'BRIEF.md'), 'utf8');
    expect(brief).toMatch(/Dog called Biscuit/);
    expect(brief).toMatch(/at least one real detail from this list/);
    expect(brief).not.toMatch(/Never invent personal facts/);
    // A second door does not check again.
    await t.api('POST', '/api/doors/4/open');
    await waitFor(door(4), settled);
    expect((await t.api<List>('GET', '/api/list')).data.checks).toHaveLength(1);
  });

  it('with an empty list the brief keeps "never invent personal facts"', async () => {
    t = await testCompanion({ scenario: 'happy', config: { debugKeepWorkspace: true } });
    process.env.FAKE_AGENT_LIST_FAIL = '1';
    await t.api('POST', '/api/doors/2/open');
    await waitFor(door(2), settled);
    expect(readFileSync(join(ws(), 'doors', '02', 'BRIEF.md'), 'utf8')).toMatch(/Never invent personal facts/);
    // A failed check does not block the gift and is recorded once (no retry loop on every door).
    expect((await t.api<List>('GET', '/api/list')).data.checks).toHaveLength(1);
  });

  it('Settings edits: changed lines become the user\'s, deleted lines stay deleted, pasted text is merged on the next check', async () => {
    t = await testCompanion({ scenario: 'happy' });
    t.companion.service.saveList({ pasted: '- Plays the cello\n- Afraid of geese' });
    await t.companion.service.checkList('first');
    let list = (await t.api<List>('GET', '/api/list')).data;
    expect(list.lines).toHaveLength(2);
    const [cello, geese] = list.lines;
    const put = await t.api<List>('PUT', '/api/list', { lines: [{ id: cello!.id, text: 'Plays the cello badly' }] });
    list = put.data;
    expect(list.lines).toMatchObject([{ text: 'Plays the cello badly', origin: 'user' }]);
    // The next check brings back neither the deleted line nor the old wording.
    t.companion.service.saveList({ pasted: '- Plays the cello\n- Afraid of geese\n- Grows tomatoes' });
    await t.companion.service.checkList('refresh');
    list = (await t.api<List>('GET', '/api/list')).data;
    expect(list.lines.map((l) => l.text)).toEqual(['Plays the cello badly', 'Grows tomatoes']);
    expect(geese).toBeTruthy();
  });

  it('the list and the persona copies never leave with an export or a backup', async () => {
    t = await testCompanion({ scenario: 'happy' });
    t.companion.service.saveList({ lines: [{ text: 'Rows on the lake' }] });
    t.companion.service.setPersona({ fileName: 'p.md', text: 'Your name is Plum. You are calm.\n' });
    const files = [...t.companion.service.store.walkExportable()].map((f) => f.slice(t.home.length + 1));
    expect(files.some((f) => f === 'list.json' || f.startsWith('personas'))).toBe(false);
    expect(files).toContain('config.json');
  });

  it('refreshes on December 8 and 15 ("checking it twice"), once each', async () => {
    t = await testCompanion({ scenario: 'happy', now: '2026-12-02T12:00:00Z' });
    t.companion.service.saveList({ pasted: '- Likes tea' });
    await t.companion.service.checkList('first');
    const season = t.companion.service.requireSeason();
    const svc = t.companion.service;
    expect(svc.listCheckDue(season)).toBeUndefined();
    process.env.ADVENT_AGENT_FAKE_NOW = '2026-12-08T12:00:00Z';
    expect(svc.listCheckDue(season)).toBe('refresh');
    svc.saveList({ pasted: '- Likes tea\n- Started pottery' });
    svc.maybeRefreshList();
    await waitFor(() => svc.list(), (l) => l.checks.length === 2);
    expect(svc.list().checks[1]!.kind).toBe('refresh');
    expect(svc.list().lines.map((l) => l.text)).toContain('Started pottery');
    expect(svc.listCheckDue(season)).toBeUndefined();
    process.env.ADVENT_AGENT_FAKE_NOW = '2026-12-16T09:00:00Z';
    expect(svc.listCheckDue(season)).toBe('refresh');
  });
});

describe('persona (D28 §2)', () => {
  function seedPersonas() {
    const agents = join(userHome, '.claude', 'agents');
    mkdirSync(agents, { recursive: true });
    writeFileSync(join(agents, 'noodle.md'), '---\nname: Noodle\ndescription: a calm cat\n---\nYou are Noodle, a calm cat who signs everything with a paw print.\n');
  }

  it('lists candidates, copies the chosen persona into the season workspace as CLAUDE.md and AGENTS.md, and the brief says to sign with its name', async () => {
    seedPersonas();
    t = await testCompanion({ scenario: 'happy', config: { debugKeepWorkspace: true } });
    const cands = (await t.api<{ candidates: PersonaCandidate[] }>('GET', '/api/persona/candidates')).data.candidates;
    const noodle = cands.find((c) => c.name === 'Noodle')!;
    expect(noodle).toMatchObject({ kind: 'claude-agent' });
    expect(noodle.preview).toMatch(/calm cat/);
    const picked = await t.api<{ persona: Persona }>('PUT', '/api/persona', { candidateId: noodle.id });
    expect(picked.data.persona.name).toBe('Noodle');
    for (const f of ['CLAUDE.md', 'AGENTS.md']) expect(readFileSync(join(ws(), f), 'utf8')).toMatch(/calm cat who signs everything/);
    await t.api('POST', '/api/doors/6/open');
    await waitFor(door(6), settled);
    const brief = readFileSync(join(ws(), 'doors', '06', 'BRIEF.md'), 'utf8');
    expect(brief).toMatch(/You are \*\*Noodle\*\*/);
    expect(brief).toMatch(/sign it/);
    const ctx = JSON.parse(readFileSync(join(ws(), 'doors', '06', 'brief.json'), 'utf8')) as { persona?: { name: string; sourcePath: string } };
    expect(ctx.persona?.name).toBe('Noodle');
    // The agent was started with the persona file next to it.
    const seen = JSON.parse(readFileSync(join(ws(), 'seen-6.json'), 'utf8')) as { persona: string | null };
    expect(seen.persona).toMatch(/calm cat/);
    // Source changed → refreshed on the next run, and the persona's own file is never written.
    writeFileSync(noodle.sourcePath, '---\nname: Noodle\n---\nYou are Noodle. New: purr loudly.\n');
    await t.api('POST', '/api/doors/7/open');
    await waitFor(door(7), settled);
    expect(readFileSync(join(ws(), 'CLAUDE.md'), 'utf8')).toMatch(/purr loudly/);
    expect(readFileSync(noodle.sourcePath, 'utf8')).toMatch(/purr loudly/);
    // Back to "just my agent": our copies go away.
    await t.api('PUT', '/api/persona', null);
    expect(existsSync(join(ws(), 'CLAUDE.md'))).toBe(false);
    expect(t.companion.service.config().persona).toBeUndefined();
  });

  it('"Choose a file…" stores the text as the persona source; Refresh re-copies', async () => {
    t = await testCompanion({ scenario: 'happy' });
    const r = await t.api<{ persona: Persona }>('PUT', '/api/persona', { fileName: 'professor.md', text: 'Your name is Professor Plum. You are a stern but fair tutor.\n' });
    expect(r.data.persona.name).toBe('Professor Plum');
    expect(readFileSync(join(ws(), 'AGENTS.md'), 'utf8')).toMatch(/stern but fair/);
    writeFileSync(r.data.persona.sourcePath, 'Your name is Professor Plum. Now very lenient.\n');
    await t.api('POST', '/api/persona/refresh');
    expect(readFileSync(join(ws(), 'CLAUDE.md'), 'utf8')).toMatch(/very lenient/);
  });
});

describe('legacy data keeps working', () => {
  it('a season, config and door written by the chat modes still load', async () => {
    t = await testCompanion({ scenario: 'happy' });
    const store = t.companion.service.store;
    writeFileSync(store.home.configFile, JSON.stringify({ schemaVersion: 1, setupComplete: true, connection: { mode: 'connected', adapter: 'muse', mcpHost: 'claude-desktop' }, installedSkills: { x: 'y' } }));
    const cfg = store.config();
    expect(cfg.connection.mode).toBe('launched');
    expect(cfg.connection.adapter).toBeUndefined();
    writeFileSync(store.home.doorStateFile(2026, 9), JSON.stringify({ schemaVersion: 1, day: 9, jobState: 'waiting_for_drop', attempt: 1, attempts: [{ n: 1, mode: 'portable', startedAt: '2026-12-08T00:00:00Z' }], updatedAt: '2026-12-08T00:00:00Z' }));
    expect(store.doors(2026).read(9).attempts[0]!.mode).toBe('submit');
  });
});
