import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { decodeProjectDir, definesPersona, isPersonaSkill, encodeProjectDir, personaFromCandidate, personaFromFile, scanPersonas, syncPersona } from '../../src/core/persona.js';
import { applyUserEdit, limitPerSource, bundleSources, cleanSourceText, gatherSources, mergeLines, parseListMd, relabelSources, renderListTask } from '../../src/core/list.js';
import { ListSchema } from '../../src/shared/list.js';

const dirs: string[] = [];
const tmp = () => { const d = realpathSync(mkdtempSync(join(tmpdir(), 'aa-pl-'))); dirs.push(d); return d; };
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

function write(file: string, text: string) { mkdirSync(join(file, '..'), { recursive: true }); writeFileSync(file, text); }

/** A pretend user home with two projects, a persona agent, a transcript, an .env and a secret. */
function fakeHome() {
  const root = tmp();
  const home = join(root, 'home');
  const proj = join(root, 'work', 'my-proj');
  const own = join(root, 'home', '.advent-agent', 'seasons', '2026', 'workspace');
  for (const d of [proj, own]) mkdirSync(d, { recursive: true });
  write(join(home, '.claude', 'CLAUDE.md'), '# About me\n- I row on the lake every morning\n- My dog is called Biscuit\n- api key: sk-ant-api03-' + 'x'.repeat(40) + '\n');
  write(join(home, '.claude', 'agents', 'captain.md'), '---\nname: Captain Pepper\ndescription: a pirate\n---\nYou are Captain Pepper, a gruff but kind pirate. Speak in nautical terms.\n');
  write(join(home, '.claude', 'output-styles', 'terse.md'), '---\nname: Terse\n---\nAnswer in as few words as possible.\n');
  write(join(proj, 'CLAUDE.md'), '# Project\nYour name is Ada. You are a meticulous archivist.\n');
  write(join(proj, '.claude', 'agents', 'helper.md'), '# Helper\nA helper agent.\n');
  write(join(proj, '.env'), 'SECRET_TOKEN=abcdefghijklmnop\n');
  const enc = join(home, '.claude', 'projects', encodeProjectDir(proj));
  write(join(enc, 'memory', 'MEMORY.md'), '- Project is a podcast about lakes\n');
  write(join(enc, 'session-1.jsonl'), '{"type":"user","message":"TRANSCRIPT-CONTENT"}\n');
  const encOwn = join(home, '.claude', 'projects', encodeProjectDir(own));
  write(join(encOwn, 'memory', 'MEMORY.md'), '- OWN-FOLDER-MEMORY\n');
  write(join(own, 'CLAUDE.md'), 'You are the calendar itself.\n');
  return { root, home, proj, own, enc };
}

describe('project folder names', () => {
  it('decodes the lossy encoding by looking at the file system', () => {
    const { proj } = fakeHome();
    expect(decodeProjectDir(encodeProjectDir(proj))).toBe(proj);
    expect(decodeProjectDir('-no-such-place-anywhere')).toBeUndefined();
  });
});

describe('skill-style personas in .claude/*.md (a team-of-agents project layout)', () => {
  function team() {
    const root = tmp();
    const home = join(root, 'home');
    const proj = join(root, 'Studio-projects', 'team-agents');
    write(join(proj, 'CLAUDE.md'), '# Team\n\n## What this is\nThis is the operations folder. I am the Chief of Staff agent, the coordinator.\n');
    write(join(proj, '.claude', 'mabel.md'), '---\nname: mabel\ndescription: Load Mabel, bilingual content writer. Use at the start of any writing session.\n---\n\nYou are Mabel, a writer.\n\n1. @content-engine/persona.md — your identity\n2. @../outside.md — must not be read\n3. @credentials/key.md — must not be read\n');
    write(join(proj, '.claude', 'handoff.md'), '---\nname: handoff\ndescription: Format a precise handoff for a coding session.\n---\nWrite the handoff as a list.\n');
    write(join(proj, '.claude', 'README.md'), '# Skills\nThis folder holds skill files.\n');
    write(join(proj, '.claude', 'commands', 'run.md'), 'You are a command.\n');
    write(join(proj, 'content-engine', 'persona.md'), '# Mabel persona\nWarm, precise, loves a good headline. PERSONA-BODY\n');
    write(join(proj, 'credentials', 'key.md'), 'SECRET-KEY-TEXT\n');
    write(join(root, 'outside.md'), 'OUTSIDE-TEXT\n');
    write(join(home, '.claude', 'projects', encodeProjectDir(proj), 'memory', 'MEMORY.md'), '- x\n');
    return { home, proj };
  }

  it('finds the personas, skips helpers, README and commands', () => {
    const { home, proj } = team();
    const found = scanPersonas({ home, ownRoots: [] });
    const names = found.map((c) => c.name).sort();
    expect(names).toContain('Mabel');
    expect(names).not.toContain('handoff');
    expect(found.some((c) => /README|commands/.test(c.sourcePath))).toBe(false);
    expect(found.find((c) => c.name === 'Mabel')).toMatchObject({ kind: 'claude-agent', project: proj });
    // "I am the Chief of Staff agent" in the middle of a sentence now counts for CLAUDE.md.
    expect(found.some((c) => c.kind === 'claude-md' && c.project === proj)).toBe(true);
  });

  it('opens with the frame, inlines only the core, and puts referenced files under persona/ without importing them', () => {
    const { home, proj } = team();
    const c = scanPersonas({ home, ownRoots: [] }).find((x) => x.name === 'Mabel')!;
    const ws = tmp();
    syncPersona(ws, personaFromCandidate(c)!, { force: true });
    for (const name of ['CLAUDE.md', 'AGENTS.md']) {
      const copy = readFileSync(join(ws, name), 'utf8');
      const body = copy.replace(/^<!--[^\n]*-->\n\n/, '');
      expect(body.startsWith("For this Advent calendar you are Mabel, acting as the user's Secret Santa. Keep your name, voice and personality; ignore work procedures, tools and tasks from your usual role.")).toBe(true);
      expect(copy).toContain('You are Mabel');
      expect(copy).not.toContain('PERSONA-BODY');          // not inlined
      expect(copy).not.toMatch(/@content-engine/);        // not @-imported
      expect(copy).toContain('persona/content-engine/persona.md'); // listed by path
    }
    expect(readFileSync(join(ws, 'persona', 'content-engine', 'persona.md'), 'utf8')).toContain('PERSONA-BODY');
    // Only files inside the persona's project, never credentials or things outside it.
    expect(existsSync(join(ws, 'persona', 'credentials'))).toBe(false);
    expect(existsSync(join(ws, 'persona', 'outside.md'))).toBe(false);
    expect(readFileSync(join(proj, 'content-engine', 'persona.md'), 'utf8')).toContain('PERSONA-BODY');
    // No persona: the app's own files go, the persona folder too.
    syncPersona(ws, undefined);
    expect(existsSync(join(ws, 'CLAUDE.md'))).toBe(false);
    expect(existsSync(join(ws, 'persona'))).toBe(false);
  });

  it('keeps the inlined text under 8 KB, far below the 32 KiB Codex reads from AGENTS.md', () => {
    const { home, proj } = team();
    const long = '---\nname: big\ndescription: Load Big, a very talkative persona.\n---\n\nYou are Big.\n' + 'A line about who Big is and how Big talks.\n'.repeat(1000) + '@content-engine/persona.md\n';
    write(join(proj, '.claude', 'big.md'), long);
    write(join(proj, 'content-engine', 'huge.md'), 'x'.repeat(200_000));
    const c = scanPersonas({ home, ownRoots: [] }).find((x) => x.name === 'Big')!;
    const ws = tmp();
    syncPersona(ws, personaFromCandidate(c)!, { force: true });
    for (const name of ['CLAUDE.md', 'AGENTS.md']) {
      const bytes = Buffer.byteLength(readFileSync(join(ws, name), 'utf8'));
      expect(bytes).toBeLessThan(9 * 1024);
      expect(bytes).toBeLessThan(32 * 1024 / 3);
      expect(readFileSync(join(ws, name), 'utf8')).toContain('The full text is at');
    }
  });

  it('a change in a referenced file refreshes the copy', () => {
    const { home, proj } = team();
    const c = scanPersonas({ home, ownRoots: [] }).find((x) => x.name === 'Mabel')!;
    const ws = tmp();
    let persona = syncPersona(ws, personaFromCandidate(c)!, { force: true })!;
    write(join(proj, 'content-engine', 'persona.md'), '# Mabel persona\nNEW-VOICE\n');
    persona = syncPersona(ws, persona)!;
    expect(readFileSync(join(ws, 'persona', 'content-engine', 'persona.md'), 'utf8')).toContain('NEW-VOICE');
  });

  it('isPersonaSkill wants an identity', () => {
    expect(isPersonaSkill('---\ndescription: Load Otto, SEO lead\n---\nx')).toBe(true);
    expect(isPersonaSkill('You are Pia, a researcher.')).toBe(true);
    expect(isPersonaSkill('---\ndescription: Format a precise handoff\n---\nDo it.')).toBe(false);
  });
});

describe('a balanced list without the mascot (D32)', () => {
  it('drops lines about the mascot and its makers, and keeps at most five lines from one source', () => {
    const md = ['- Works on Gary, a plaid character [source: a]', '- Desk Menace is their studio [source: a]', '- Rows on the lake [source: a]', ...Array.from({ length: 9 }, (_, i) => `- Fact ${i} about project one [source: p1]`), '- Plays the cello [source: p2]'].join('\n');
    const lines = parseListMd(md);
    expect(lines.some((l) => /gary|desk menace/i.test(l.text))).toBe(false);
    const limited = limitPerSource(lines);
    expect(limited.filter((l) => l.source === 'p1')).toHaveLength(5);
    expect(limited.map((l) => l.text)).toContain('Plays the cello');
  });

  it('the honest "only one project" line is never cut, and the user\'s own lines are never cut', () => {
    const agent = Array.from({ length: 7 }, (_, i) => ({ id: `a${i}`, text: i === 6 ? 'Only one project was found (Foo); nothing else is known.' : `Foo fact ${i}`, source: 'foo', origin: 'agent' as const }));
    const user = Array.from({ length: 7 }, (_, i) => ({ id: `u${i}`, text: `mine ${i}`, source: 'foo', origin: 'user' as const }));
    const out = limitPerSource([...agent, ...user]);
    expect(out.filter((l) => l.origin === 'user')).toHaveLength(7);
    expect(out.some((l) => /^Only one project/.test(l.text))).toBe(true);
    expect(out.filter((l) => l.origin === 'agent' && !/^Only/.test(l.text))).toHaveLength(5);
  });

  it('the list task asks for several projects and an honest note when there is only one', () => {
    const md = renderListTask({ sources: [], hasPasted: false, existing: [], avoid: [] });
    expect(md).toMatch(/at most 5 lines from any one project/);
    expect(md).toMatch(/Only one project was found/);
    expect(md).toMatch(/never a gift subject/);
  });
});

describe('the list check reads a small, single bundle (cost cap)', () => {
  it('caps each file and the total, and puts everything in one ALL.md under file-name headers', () => {
    const { home, proj, enc } = fakeHome();
    for (let i = 0; i < 30; i++) write(join(enc, 'memory', `topic-${i}.md`), '- fact number ' + i + ' ' + 'word '.repeat(2000));
    const task = tmp();
    const sources = gatherSources(task, { home, adapter: 'claude-code', ownRoots: [] });
    const bytes = bundleSources(task, sources);
    expect(bytes).toBeLessThan(60_000);
    const all = readFileSync(join(task, 'sources', 'ALL.md'), 'utf8');
    expect(all).toMatch(/^===== 01-global-CLAUDE\.md \(/);
    expect(all).toContain('I row on the lake');
    expect(all).not.toContain('TRANSCRIPT-CONTENT');
    for (const s of sources) expect(readFileSync(join(task, s.copy), 'utf8').length).toBeLessThanOrEqual(6_000);
    void proj;
  });

  it('the task asks for one Read and one Write', () => {
    const md = renderListTask({ sources: [], hasPasted: false, existing: [], avoid: [] });
    expect(md).toContain('sources/ALL.md');
    expect(md).toContain('one Read, one Write');
  });
});

describe('persona candidates (D28 §2)', () => {
  it('finds custom agents, output styles and persona-defining CLAUDE.md files, with name, project and preview', () => {
    const { home, proj, own, root } = fakeHome();
    const found = scanPersonas({ home, ownRoots: [join(home, '.advent-agent')] });
    const byName = Object.fromEntries(found.map((c) => [c.name, c]));
    expect(byName['Captain Pepper']).toMatchObject({ kind: 'claude-agent', project: undefined });
    expect(byName['Captain Pepper']!.preview).toMatch(/gruff but kind pirate/);
    expect(byName['Terse']!.kind).toBe('claude-output-style');
    expect(byName['Ada']).toMatchObject({ kind: 'claude-md', project: proj });
    expect(byName['Helper']?.project).toBe(proj);
    // The calendar's own folder is never a candidate.
    expect(found.some((c) => c.sourcePath.startsWith(own))).toBe(false);
    void root;
  });

  it('the CLAUDE.md heuristic wants an identity, not just repo instructions', () => {
    expect(definesPersona('# Repo\nRun npm test before committing.')).toBe(false);
    expect(definesPersona('You are Gary, an annoying coworker.')).toBe(true);
    expect(definesPersona('# Notes\nYour name is Mo.')).toBe(true);
  });

  it('finds Codex AGENTS.md of projects named in session metadata', () => {
    const root = tmp();
    const home = join(root, 'home');
    const proj = join(root, 'code', 'owl');
    write(join(proj, 'AGENTS.md'), 'You are Professor Owl, a patient tutor.\n');
    write(join(home, '.codex', 'sessions', '2026', '11', '08', 'rollout-1.jsonl'), JSON.stringify({ type: 'session_meta', payload: { cwd: proj } }) + '\n{"type":"message","text":"SECRET TRANSCRIPT"}\n');
    const found = scanPersonas({ home, ownRoots: [] });
    expect(found.find((c) => c.name === 'Professor Owl')).toMatchObject({ kind: 'codex-agents', project: proj });
  });
});

describe('persona copy in the season workspace', () => {
  it('writes CLAUDE.md and AGENTS.md, refreshes when the source changes, and removes only its own files', () => {
    const { home } = fakeHome();
    const ws = tmp();
    const c = scanPersonas({ home, ownRoots: [] }).find((x) => x.name === 'Captain Pepper')!;
    const persona = personaFromCandidate(c)!;
    expect(syncPersona(ws, persona)?.sourceHash).toBe(persona.sourceHash); // first copy, nothing changed
    for (const f of ['CLAUDE.md', 'AGENTS.md']) expect(readFileSync(join(ws, f), 'utf8')).toMatch(/gruff but kind pirate/);
    expect(readFileSync(join(ws, 'CLAUDE.md'), 'utf8')).not.toMatch(/^---/m);
    // Source changes → copy and hash are refreshed on the next sync.
    writeFileSync(c.sourcePath, '---\nname: Captain Pepper\n---\nYou are Captain Pepper. New orders: speak softly.\n');
    const refreshed = syncPersona(ws, persona)!;
    expect(refreshed.sourceHash).not.toBe(persona.sourceHash);
    expect(readFileSync(join(ws, 'AGENTS.md'), 'utf8')).toMatch(/speak softly/);
    // Never writes to the persona's own project or file.
    expect(readFileSync(c.sourcePath, 'utf8')).toMatch(/New orders/);
    // A file we did not write stays; ours goes when the persona is cleared.
    write(join(ws, 'AGENTS.md'), 'the user wrote this\n');
    syncPersona(ws, undefined);
    expect(existsSync(join(ws, 'CLAUDE.md'))).toBe(false);
    expect(readFileSync(join(ws, 'AGENTS.md'), 'utf8')).toBe('the user wrote this\n');
  });

  it('a chosen file becomes a persona named after its identity line', () => {
    const root = tmp();
    write(join(root, 'me.md'), 'Your name is Noodle. You are a calm cat.\n');
    expect(personaFromFile(join(root, 'me.md'))).toMatchObject({ name: 'Noodle' });
    write(join(root, 'bb.md'), '# Trailbot — instructions for Claude Code working in this repo\n\nYou are building Trailbot.\n');
    expect(personaFromFile(join(root, 'bb.md'))).toMatchObject({ name: 'Trailbot' });
    expect(personaFromFile(join(root, 'missing.md'))).toBeUndefined();
  });
});

describe('what the list may read (D28 §4)', () => {
  it('copies global instructions, project memory and project CLAUDE.md; never transcripts, .env, secrets or the calendar\'s own folders', () => {
    const { home, own } = fakeHome();
    const task = tmp();
    const sources = gatherSources(task, { adapter: 'claude-code', home, ownRoots: [join(home, '.advent-agent')] });
    const labels = sources.map((s) => s.label);
    expect(labels).toContain('~/.claude/CLAUDE.md');
    expect(labels.some((l) => l.endsWith('MEMORY.md') && l.includes('.claude/projects'))).toBe(true);
    expect(labels.some((l) => l.endsWith('my-proj/CLAUDE.md'))).toBe(true);
    const all = sources.map((s) => readFileSync(join(task, s.copy), 'utf8')).join('\n');
    expect(all).toMatch(/Biscuit/);
    expect(all).not.toMatch(/TRANSCRIPT-CONTENT|SECRET_TOKEN|OWN-FOLDER-MEMORY|sk-ant-/);
    expect(labels.some((l) => l.includes('.env') || l.endsWith('.jsonl') || l.startsWith(own))).toBe(false);
    expect(all).toMatch(/line removed/);
  });

  it('Codex: global AGENTS.md, memories and project AGENTS.md from session metadata', () => {
    const root = tmp();
    const home = join(root, 'home');
    const proj = join(root, 'code', 'owl');
    write(join(proj, 'AGENTS.md'), '- Owl project is about tutoring\n');
    write(join(home, '.codex', 'AGENTS.md'), '- Prefers tea\n');
    write(join(home, '.codex', 'memories', 'm.md'), '- Lives near a lake\n');
    write(join(home, '.codex', 'sessions', '2026', '11', '08', 'rollout-1.jsonl'), JSON.stringify({ payload: { cwd: proj } }) + '\n');
    const task = tmp();
    const labels = gatherSources(task, { adapter: 'codex', home, ownRoots: [] }).map((s) => s.label);
    expect(labels).toEqual(expect.arrayContaining(['~/.codex/AGENTS.md', '~/.codex/memories/m.md']));
    expect(labels.some((l) => l.endsWith('owl/AGENTS.md'))).toBe(true);
  });

  it('the persona\'s project memory is read too', () => {
    const { home, proj } = fakeHome();
    const c = scanPersonas({ home, ownRoots: [] }).find((x) => x.name === 'Ada')!;
    const persona = personaFromCandidate(c)!;
    const sources = gatherSources(tmp(), { adapter: 'claude-code', persona, home, ownRoots: [] });
    expect(sources.some((s) => s.label.includes(encodeProjectDir(proj)) && s.label.endsWith('MEMORY.md'))).toBe(true);
  });

  it('the task tells the agent what to leave out, including the avoid list', () => {
    const text = renderListTask({ sources: [], hasPasted: false, existing: [], avoid: ['politics'], tokens: 30000 });
    expect(text).toMatch(/10–20 short lines/);
    expect(text).toMatch(/no session transcripts, no source code, no `.env` files/);
    expect(text).toMatch(/health, money, relationships/);
    expect(text).toMatch(/politics/);
  });

  it('cleanSourceText removes secret-looking lines but keeps home paths', () => {
    expect(cleanSourceText('hello\nexport OPENAI_API_KEY=abcdef123456789\nnotes in /Users/me/notes')).toBe('hello\n[line removed: it looked like a secret]\nnotes in /Users/me/notes');
  });
});

describe('the calendar\'s own and lab folders', () => {
  it('are never read for the list, even when the folder is gone and only its encoded name is left', () => {
    const { home } = fakeHome();
    // A deleted lab home: only Claude's project folder remains.
    write(join(home, '.claude', 'projects', '-Users-someone--advent-agent-lab-plan-x-seasons-2026-doors-01-workspace', 'memory', 'MEMORY.md'), '- LAB-MEMORY\n');
    const sources = gatherSources(tmp(), { adapter: 'claude-code', home, ownRoots: [] });
    const all = sources.map((s) => s.label).join('\n');
    expect(all).not.toMatch(/advent-agent/);
    expect(sources.length).toBeGreaterThan(0);
  });
});

describe('list parsing and merging', () => {
  it('parses tagged bullet lines, drops secrets and the avoid list', () => {
    const lines = parseListMd('# List\n- Rows every morning [source: ~/.claude/CLAUDE.md]\n- Dog called Biscuit (source: memory)\n- Votes for politics-party [source: x]\n- key sk-ant-api03-' + 'y'.repeat(40) + '\nnot a bullet\n', { avoid: ['politics'] });
    expect(lines.map((l) => l.text)).toEqual(['Rows every morning', 'Dog called Biscuit']);
    expect(lines[0]!.source).toBe('~/.claude/CLAUDE.md');
  });

  it('shows the real origin of a line, not the name of the copy the agent read', () => {
    const lines = relabelSources(parseListMd('- Rows daily [source: sources/03-memory-lake-MEMORY.md]\n- Has a dog [source: pasted]\n'), [{ copy: 'sources/03-memory-lake-MEMORY.md', label: '~/.claude/projects/lake/memory/MEMORY.md' }]);
    expect(lines.map((l) => l.source)).toEqual(['~/.claude/projects/lake/memory/MEMORY.md', 'pasted']);
  });

  it('merges new lines without duplicates and never brings back a deleted line', () => {
    let list = ListSchema.parse({});
    list = mergeLines(list, parseListMd('- Rows every morning\n- Dog called Biscuit\n'));
    list = applyUserEdit(list, { lines: [{ id: list.lines[1]!.id, text: 'Dog called Biscuit' }] }); // deletes "Rows…", keeps the dog
    expect(list.lines.map((l) => l.text)).toEqual(['Dog called Biscuit']);
    list = mergeLines(list, parseListMd('- rows every morning!\n- Dog called biscuit\n- Loves lakes\n'));
    expect(list.lines.map((l) => l.text)).toEqual(['Dog called Biscuit', 'Loves lakes']);
  });

  it('an edited line becomes the user\'s own', () => {
    let list = mergeLines(ListSchema.parse({}), parseListMd('- Rows every morning [source: a]\n'));
    list = applyUserEdit(list, { lines: [{ id: list.lines[0]!.id, text: 'Rows at dawn' }] });
    expect(list.lines[0]).toMatchObject({ text: 'Rows at dawn', origin: 'user' });
  });
});
