/**
 * "Checking the list" (D28): what the Secret Santa knows about the user.
 *
 * The app, not the agent, decides what may be read: it copies a short allow-list of files (global instructions, project
 * memory, project CLAUDE.md / AGENTS.md) into the list task's own folder, and the agent only reads those copies.
 * Session transcripts, source code, .env files, keys and credentials, and the calendar's own and lab folders are never copied.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { scanText } from '../intake/secrets.js';
import { ListSchema, MASCOT, MAX_LIST_LINES, type List, type ListLine, type Persona } from '../shared/list.js';
import { readJson, writeJsonAtomic } from './fsutil.js';
import { claudeProjects, codexProjects, encodeProjectDir, isOwnFolder, isOwnProject, userHome } from './persona.js';

// What the list check may read, in total. Every turn of the agent re-reads everything it has read so far, so this is the real cost
// lever: ~48 KB is about 12k tokens, read once from a single bundle.
const FILE_CAP = 6_000;
const TOTAL_CAP = 48_000;
const MAX_FILES = 40;
const REFUSED_NAME = /(^|[\\/])\.env|secret|credential|token|\.pem$|\.key$|id_rsa|\.p12$|keychain|password/i;

export interface ListSource {
  /** Path of the copy, relative to the task folder (`sources/…`). */
  copy: string;
  /** Where it came from, shown to the user as the line's source (`~/.claude/CLAUDE.md`). */
  label: string;
}

export interface GatherOptions {
  adapter?: string;
  persona?: Persona;
  home?: string;
  /** The calendar's data home and the lab: never read. */
  ownRoots: string[];
}

const tilde = (p: string, home: string) => (p.startsWith(home) ? '~' + p.slice(home.length) : p);

/** Remove lines that look like secrets; returns undefined when nothing is left worth reading. */
export function cleanSourceText(text: string): string {
  const hits = scanText(text).filter((h) => h.kind !== 'home_path');
  if (hits.length === 0) return text;
  const bad = new Set(hits.map((h) => h.line));
  return text.split(/\r?\n/).map((l, i) => (bad.has(i + 1) ? '[line removed: it looked like a secret]' : l)).join('\n');
}

function safeRead(file: string): string | undefined {
  try {
    const st = statSync(file);
    if (!st.isFile() || st.size === 0) return undefined;
    return readFileSync(file, 'utf8').slice(0, FILE_CAP);
  } catch { return undefined; }
}

function textFilesIn(dir: string, depth = 2): string[] {
  const out: string[] = [];
  const walk = (d: string, level: number) => {
    let entries: string[];
    try { entries = readdirSync(d).sort(); } catch { return; }
    for (const e of entries) {
      const full = join(d, e);
      if (REFUSED_NAME.test(e)) continue;
      let st;
      try { st = statSync(full); } catch { continue; }
      if (st.isDirectory()) { if (level < depth) walk(full, level + 1); }
      else if (/\.(md|txt)$/i.test(e)) out.push(full);
    }
  };
  walk(dir, 1);
  return out;
}

/** Copy the allowed files into `<taskDir>/sources/` and return what was copied. */
export function gatherSources(taskDir: string, opts: GatherOptions): ListSource[] {
  const home = opts.home ?? userHome();
  const dest = join(taskDir, 'sources');
  mkdirSync(dest, { recursive: true });
  const out: ListSource[] = [];
  const seen = new Set<string>();
  let total = 0;
  const take = (file: string, name: string) => {
    if (out.length >= MAX_FILES || total >= TOTAL_CAP) return;
    const key = resolve(file);
    if (seen.has(key) || REFUSED_NAME.test(file.split(/[\\/]/).pop() ?? '')) return;
    const raw = safeRead(file);
    if (raw === undefined) return;
    seen.add(key);
    const text = cleanSourceText(raw);
    total += text.length;
    const copy = `sources/${String(out.length + 1).padStart(2, '0')}-${name.replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 60)}`;
    writeFileSync(join(taskDir, copy), text);
    out.push({ copy, label: tilde(key, home) });
  };

  const adapter = opts.adapter ?? 'claude-code';
  const personaProject = opts.persona?.project;

  if (adapter === 'claude-code') {
    take(join(home, '.claude', 'CLAUDE.md'), 'global-CLAUDE.md');
    const projects = claudeProjects(home).filter((p) => !isOwnProject(p, opts.ownRoots));
    // The persona's own project comes first so its memory is never cut off by the caps.
    projects.sort((a, b) => Number(b.path === personaProject) - Number(a.path === personaProject));
    for (const p of projects) {
      for (const f of textFilesIn(join(p.dir, 'memory'))) take(f, `memory-${p.encoded.slice(-24)}-${f.split(/[\\/]/).pop()}`);
      if (p.path) take(join(p.path, 'CLAUDE.md'), `project-${p.encoded.slice(-24)}-CLAUDE.md`);
    }
    if (personaProject && !projects.some((p) => p.path === personaProject) && !isOwnFolder(personaProject, opts.ownRoots)) {
      const dir = join(home, '.claude', 'projects', encodeProjectDir(personaProject), 'memory');
      for (const f of textFilesIn(dir)) take(f, `persona-memory-${f.split(/[\\/]/).pop()}`);
    }
  } else if (adapter === 'codex') {
    take(join(home, '.codex', 'AGENTS.md'), 'global-AGENTS.md');
    for (const f of textFilesIn(join(home, '.codex', 'memories'))) take(f, `memory-${f.split(/[\\/]/).pop()}`);
    const cwds = codexProjects(home).filter((c) => !isOwnFolder(c, opts.ownRoots) && !/[\\/]\.advent-agent/.test(c));
    if (personaProject) cwds.sort((a, b) => Number(b === personaProject) - Number(a === personaProject));
    for (const cwd of cwds) take(join(cwd, 'AGENTS.md'), `project-${cwd.split(/[\\/]/).pop()}-AGENTS.md`);
  } else if (adapter === 'gemini') {
    take(join(home, '.gemini', 'GEMINI.md'), 'global-GEMINI.md');
  }
  return out;
}

// ---- the task the agent receives --------------------------------------------------------------

export function renderListTask(input: { sources: ListSource[]; hasPasted: boolean; existing: string[]; avoid: string[]; personaName?: string; tokens?: number }): string {
  const L: string[] = [];
  L.push('# Checking the list');
  L.push('');
  L.push(`You are the Secret Santa${input.personaName ? ` (${input.personaName})` : ''} behind a 24-door advent calendar. Before Door 1, you check your list: what you know about the person you are making gifts for, so the gifts can be specific to them.`);
  L.push('');
  L.push('## What to read');
  L.push('Read `sources/ALL.md` once, in a single Read: it has every file the calendar chose for you, each under a header with its file name' + (input.hasPasted ? ' (including `pasted.md`, which the person pasted themselves)' : '') + '. Do not open the other files in `sources/`. Add anything your own memory already tells you about them. Do **not** look anywhere else: no session transcripts, no source code, no `.env` files, no keys or credentials, no other folders, no web.');
  L.push('');
  L.push('## What to write');
  L.push('Write `list.md` in this folder: **10–20 short lines**, one per line, each starting with `- ` and ending with `[source: <where it came from>]`. Cover, as far as you actually know it:');
  L.push('interests and hobbies, sense of humour, people and pets by name, current projects, places, things to avoid, and what they seem to care about this year.');
  L.push('**Spread the list across several projects and areas of their life**: at most 5 lines from any one project or file. If the material really covers only one project, do not pad: make the first line `- Only one project was found (<its name>); nothing else about them is known. [source: <file>]` and list only what is true.');
  L.push('Each line is one plain fact or leaning in under 25 words, no quotes from private text. Never invent anything; fewer true lines beat many guesses.');
  L.push('');
  L.push('## Leave out');
  L.push('- secrets, credentials, API keys, customer or client names, anything confidential');
  L.push('- health, money, relationships in difficulty, and anything else sensitive');
  L.push('- Gary, gary.js and Desk Menace (the calendar\'s mascot and its makers: they are never a gift subject)');
  if (input.avoid.length) L.push(`- the person's own avoid list: ${input.avoid.join(', ')}`);
  L.push('');
  if (input.existing.length) {
    L.push('## Already on the list (do not repeat; add only what is new)');
    for (const e of input.existing) L.push(`- ${e}`);
    L.push('');
  }
  L.push('Keep it quick: one Read, one Write, then stop. Do not make a gift.');
  return L.join('\n') + '\n';
}

export function renderSourceIndex(sources: ListSource[]): string {
  return ['# Sources', '', ...sources.map((s) => `- \`${s.copy}\` ← ${s.label}`), ''].join('\n');
}

// ---- parsing and merging ----------------------------------------------------------------------

/** The agent tags lines with the copy it read (`sources/14-memory-….md`); the user should see where it really came from. */
/**
 * One file with every source under a header, so the agent reads once instead of making a call (and re-reading its whole context)
 * per file. The header carries the copy's file name, which the agent cites as the source of a line.
 */
export function bundleSources(taskDir: string, sources: ListSource[]): number {
  const parts: string[] = [];
  for (const s of sources) {
    let text = '';
    try { text = readFileSync(join(taskDir, s.copy), 'utf8'); } catch { continue; }
    parts.push(`===== ${s.copy.split('/').pop()} (${s.label}) =====\n${text.trim()}\n`);
  }
  const bundle = parts.join('\n');
  writeFileSync(join(taskDir, 'sources', 'ALL.md'), bundle);
  return Buffer.byteLength(bundle);
}

export function relabelSources(lines: ListLine[], sources: ListSource[]): ListLine[] {
  return lines.map((l) => {
    const base = (l.source.match(/[^\s/\\,;]+\.(?:md|txt)/i)?.[0] ?? l.source).trim();
    const hit = sources.find((s) => s.copy === l.source || s.copy.endsWith('/' + base) || base === s.copy.split('/').pop());
    return { ...l, source: hit ? hit.label : l.source.replace(/^sources\//, '') };
  });
}

export const normaliseLine = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const lineId = (t: string) => createHash('sha256').update(normaliseLine(t)).digest('hex').slice(0, 10);

/** At most this many agent lines from one source (one project must not fill the list). */
export const MAX_LINES_PER_SOURCE = 5;

/** Keep at most MAX_LINES_PER_SOURCE agent lines per source; user lines and the "only one project" note are never cut. */
export function limitPerSource(lines: ListLine[], max = MAX_LINES_PER_SOURCE): ListLine[] {
  const seen = new Map<string, number>();
  return lines.filter((l) => {
    if (l.origin !== 'agent' || /^only (one|a single) (project|area|source)/i.test(l.text)) return true;
    const n = (seen.get(l.source) ?? 0) + 1;
    seen.set(l.source, n);
    return n <= max;
  });
}

/** Parse the agent's list.md into lines. Lines that look like secrets or touch the avoid list are dropped. */
export function parseListMd(md: string, opts: { avoid?: string[]; origin?: ListLine['origin'] } = {}): ListLine[] {
  const avoid = (opts.avoid ?? []).map((a) => a.toLowerCase().trim()).filter(Boolean);
  const out: ListLine[] = [];
  for (const raw of md.split(/\r?\n/)) {
    const m = raw.match(/^\s*(?:[-*•]|\d+[.)])\s+(.+?)\s*$/);
    if (!m) continue;
    let text = m[1]!;
    let source = '';
    const src = text.match(/\s*[\[(]\s*source\s*:\s*([^\])]+)[\])]\s*\.?\s*$/i);
    if (src) { source = src[1]!.trim(); text = text.slice(0, src.index).trim(); }
    text = text.replace(/\*\*/g, '').trim();
    if (text.length < 3) continue;
    if (scanText(text).some((h) => h.kind !== 'home_path')) continue;
    const low = text.toLowerCase();
    if (avoid.some((a) => low.includes(a))) continue;
    // The calendar's mascot and its makers are never a gift subject (D10), so they never reach the list.
    if ((opts.origin ?? 'agent') === 'agent' && MASCOT.test(text)) continue;
    out.push({ id: lineId(text), text: text.slice(0, 400), source: source.slice(0, 200), origin: opts.origin ?? 'agent' });
    if (out.length >= 30) break;
  }
  return out;
}

/** Add new lines to the list: no duplicates, nothing the user deleted, never more than MAX_LIST_LINES (oldest agent lines go first). */
export function mergeLines(list: List, fresh: ListLine[]): List {
  const deleted = new Set(list.deleted);
  const have = new Set(list.lines.map((l) => normaliseLine(l.text)));
  const lines = list.lines.slice();
  for (const l of fresh) {
    const n = normaliseLine(l.text);
    if (!n || deleted.has(n) || have.has(n)) continue;
    have.add(n);
    lines.push(l);
  }
  while (lines.length > MAX_LIST_LINES) {
    const i = lines.findIndex((l) => l.origin !== 'user');
    lines.splice(i === -1 ? 0 : i, 1);
  }
  return { ...list, lines };
}

// ---- storage ----------------------------------------------------------------------------------

export function readList(file: string): List {
  try { return readJson(file, ListSchema) ?? ListSchema.parse({}); } catch { return ListSchema.parse({}); }
}

export function writeList(file: string, list: List): List {
  const parsed = ListSchema.parse(list);
  writeJsonAtomic(file, parsed);
  return parsed;
}

/** Apply the user's edits from Settings: edited text becomes the user's own line, removed lines are remembered as deleted. */
export function applyUserEdit(list: List, edit: { lines?: Array<{ id?: string; text: string }>; pasted?: string }): List {
  let next = list;
  if (edit.lines) {
    const byId = new Map(list.lines.map((l) => [l.id, l]));
    const kept: ListLine[] = [];
    const deleted = new Set(list.deleted);
    for (const e of edit.lines) {
      const text = e.text.trim().slice(0, 400);
      if (!text) continue;
      const old = e.id ? byId.get(e.id) : undefined;
      if (old && old.text === text) kept.push(old);
      else kept.push({ id: lineId(text), text, source: old ? old.source : 'you', origin: 'user' });
      if (old && old.text !== text) deleted.add(normaliseLine(old.text));
      deleted.delete(normaliseLine(text));
    }
    for (const old of list.lines) if (!kept.some((k) => k.id === old.id)) deleted.add(normaliseLine(old.text));
    next = { ...next, lines: kept.slice(0, MAX_LIST_LINES), deleted: [...deleted].slice(-200) };
  }
  if (edit.pasted !== undefined) next = { ...next, pasted: edit.pasted.slice(0, 20_000) };
  return next;
}
