/**
 * Personas (D28): "Who is your Secret Santa?". A file scan by the app finds candidate personas in the user's agent setup;
 * the one they pick is copied into the season workspace as CLAUDE.md and AGENTS.md so the agent loads it natively.
 * Nothing here runs an agent, and nothing writes to the persona's own project.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync, rmSync, openSync, readSync, closeSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join, resolve, sep } from 'node:path';
import type { Persona, PersonaCandidate } from '../shared/list.js';

/** The user's home folder; tests point it somewhere else with ADVENT_AGENT_USER_HOME. */
export function userHome(): string {
  return process.env.ADVENT_AGENT_USER_HOME ? resolve(process.env.ADVENT_AGENT_USER_HOME) : homedir();
}

const MARKER = '<!-- advent-agent persona';

/** Claude Code names a project folder after its path, with every non-alphanumeric character turned into "-". */
export function encodeProjectDir(path: string): string {
  return path.replace(/[^A-Za-z0-9]/g, '-');
}

/**
 * Reverse of `encodeProjectDir`, guided by the file system (the encoding is lossy: "-" may be "/", "-", "." or "_").
 * Returns the folder only if it exists.
 */
export function decodeProjectDir(name: string, root: string = sep): string | undefined {
  if (!name.startsWith('-')) return undefined;
  const walk = (dir: string, rest: string): string | undefined => {
    if (rest === '') return dir;
    let entries: string[];
    try { entries = readdirSync(dir); } catch { return undefined; }
    const matches = entries
      .map((e) => ({ e, enc: encodeProjectDir(e) }))
      .filter(({ enc }) => rest === enc || rest.startsWith(enc + '-'))
      .sort((a, b) => b.enc.length - a.enc.length);
    for (const { e, enc } of matches) {
      const next = join(dir, e);
      try { if (!statSync(next).isDirectory()) continue; } catch { continue; }
      const found = walk(next, rest === enc ? '' : rest.slice(enc.length + 1));
      if (found) return found;
    }
    return undefined;
  };
  return walk(root, name.slice(1));
}

/** Project folders Claude Code knows about (`~/.claude/projects`), decoded. Most recently used first. */
export function claudeProjects(home = userHome()): Array<{ dir: string; encoded: string; path?: string }> {
  const base = join(home, '.claude', 'projects');
  if (!existsSync(base)) return [];
  const out: Array<{ dir: string; encoded: string; path?: string; mtime: number }> = [];
  for (const encoded of readdirSync(base)) {
    const dir = join(base, encoded);
    let mtime = 0;
    try { const st = statSync(dir); if (!st.isDirectory()) continue; mtime = st.mtimeMs; } catch { continue; }
    out.push({ dir, encoded, path: decodeProjectDir(encoded), mtime });
  }
  return out.sort((a, b) => b.mtime - a.mtime).map(({ dir, encoded, path }) => ({ dir, encoded, path }));
}

/** Folders that belong to the calendar itself (its data home and the lab): never candidates, never read for the list. */
export function isOwnFolder(path: string | undefined, ownRoots: string[]): boolean {
  if (!path) return false;
  const p = resolve(path);
  return ownRoots.some((r) => { const root = resolve(r); return p === root || p.startsWith(root + sep); });
}

/**
 * A Claude Code project folder that belongs to the calendar: its data home, the lab homes (`~/.advent-agent-lab/…`), or a folder
 * that no longer exists but was named after one (the encoded name keeps the "/." of ".advent-agent" as "--advent-agent").
 */
export function isOwnProject(p: { encoded: string; path?: string }, ownRoots: string[]): boolean {
  if (isOwnFolder(p.path, ownRoots)) return true;
  if (p.path && /(^|[\\/])\.advent-agent[^\\/]*([\\/]|$)/.test(p.path)) return true;
  return /--advent-agent/.test(p.encoded) || ownRoots.some((r) => p.encoded.startsWith(encodeProjectDir(r)));
}

// ---- reading persona files ------------------------------------------------------------------

export function splitFrontmatter(text: string): { meta: Record<string, string>; body: string } {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { meta: {}, body: text };
  const meta: Record<string, string> = {};
  for (const line of m[1]!.split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_-]+):\s*(.*)$/);
    if (kv) meta[kv[1]!.toLowerCase()] = kv[2]!.trim().replace(/^["']|["']$/g, '');
  }
  return { meta, body: text.slice(m[0].length) };
}

/** A simple heuristic: does this CLAUDE.md / AGENTS.md define who the agent *is*, not just how a repo works? */
export function definesPersona(text: string): boolean {
  const head = text.split(/\r?\n/).slice(0, 60).join('\n');
  return /\byour name is\b/i.test(head) || /^\s*(?:#+\s*)?(?:you are|act as|i am)\s+(?:a |an |the )?[A-Za-z]/im.test(head) || /^#+\s*persona\b/im.test(head)
    || /\bI am (?:the |a |an )?[A-Z][\w'’ -]{1,40}? agent\b/.test(head);
}

/**
 * Skill-style persona files (`.claude/<name>.md`, `~/.claude/skills/<name>/SKILL.md`): frontmatter with a description such as
 * "Load Mabel, bilingual copy editor" or a body that opens with "You are …". Helper skills ("Format a precise handoff") do not match.
 */
export function isPersonaSkill(text: string): boolean {
  const { meta, body } = splitFrontmatter(text);
  if (/^(?:[Ll]oad|[Aa]ctivate|[Bb]ecome|[Pp]lay|[Aa]ct as)\s+[A-Z]/.test(meta.description ?? '')) return true;
  const first = body.split(/\r?\n/).map((l) => l.trim()).find((l) => l && !l.startsWith('#') && !l.startsWith('<!--'));
  return !!first && /^(?:you are|your name is)\s+(?!(?:a|an|the)\s+(?:helper|tool)\b)[A-Za-z]/i.test(first);
}

function firstHeading(body: string): string | undefined {
  return body.match(/^#{1,3}\s+(.+?)\s*$/m)?.[1]?.replace(/[*_`]/g, '').trim();
}

function oneLine(s: string, max = 120): string {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max - 1) + '…' : t;
}

function previewOf(body: string, fallback = ''): string {
  for (const line of body.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#') || t.startsWith('<!--') || t === '---') continue;
    return oneLine(t.replace(/^[-*>\s]+/, ''));
  }
  return oneLine(fallback);
}

function personaNameFromText(text: string, fallback: string): string {
  const named = text.match(/\b[Yy]our name is\s+\**([A-Z][\w'’-]*(?:\s+[A-Z][\w'’-]*){0,2})/);
  if (named) return named[1]!;
  const youAre = text.match(/^\s*(?:#+\s*)?[Yy]ou are\s+(?!(?:a|an|the|my|our|working|an?)\b)([A-Z][\w'’-]*(?:\s+[A-Z][\w'’-]*){0,2})/m);
  if (youAre) return youAre[1]!;
  const { meta, body } = splitFrontmatter(text);
  // A heading like "Trailbot — instructions for Claude Code working in this repo" names the persona by its first part.
  const heading = firstHeading(body)?.split(/\s+[—–]\s+|:\s+/)[0]?.trim();
  return meta.name || heading || fallback;
}

const candidateId = (path: string) => createHash('sha256').update(path).digest('hex').slice(0, 12);

function readText(file: string, max = 200_000): string | undefined {
  try {
    if (!statSync(file).isFile()) return undefined;
    return readFileSync(file, 'utf8').slice(0, max);
  } catch { return undefined; }
}

function mdFiles(dir: string): string[] {
  try { return readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.md')).sort().map((f) => join(dir, f)); } catch { return []; }
}

/** What is inlined into the season CLAUDE.md / AGENTS.md. Codex reads about 32 KiB of AGENTS.md by default, so stay well under. */
export const PERSONA_CORE_MAX = 8 * 1024;
const MAX_SUPPORT_TOTAL = 60_000;

export interface PersonaMaterial {
  /** The persona's core text, capped. */
  core: string;
  /** Files the persona points at (`@path`), read from its own project; copied as plain files under `persona/`. */
  support: Array<{ rel: string; text: string }>;
}

function capText(text: string, max: number, source: string): string {
  if (Buffer.byteLength(text) <= max) return text;
  let out = '';
  for (const line of text.split('\n')) {
    if (Buffer.byteLength(out + line + '\n') > max - 200) break;
    out += line + '\n';
  }
  return `${out.trimEnd()}\n\n[Trimmed to fit. The full text is at ${source}.]\n`;
}

/**
 * Persona skills often say "Read @content-engine/persona.md first": the identity lives in those files. They are read from the
 * persona's own project (the folder holding `.claude/`), only Markdown, one level deep, inside that folder, never dot-files or
 * credentials, and capped. The persona's project is only read, never written.
 */
function supportFiles(body: string, file: string): Array<{ rel: string; text: string }> {
  const parts = resolve(file).split(sep);
  const at = parts.lastIndexOf('.claude');
  if (at < 1) return [];
  const root = parts.slice(0, at).join(sep) || sep;
  const done = new Set<string>();
  const out: Array<{ rel: string; text: string }> = [];
  let total = 0;
  for (const m of body.matchAll(/(?:^|[\s(])@([\w./-]+\.md)\b/g)) {
    const target = resolve(root, m[1]!);
    if (done.has(target) || !target.startsWith(root + sep)) continue;
    const rel = target.slice(root.length + 1);
    if (rel.split(sep).some((seg) => seg.startsWith('.') || /^(credentials?|secrets?|node_modules)$/i.test(seg))) continue;
    done.add(target);
    const text = readText(target, MAX_SUPPORT_TOTAL);
    if (!text?.trim() || total + text.length > MAX_SUPPORT_TOTAL) continue;
    total += text.length;
    out.push({ rel, text });
  }
  return out;
}

/** The persona material for a source file: core text (capped, `@` imports defused) and the files it points at. */
export function personaMaterial(kind: Persona['kind'], file: string): PersonaMaterial | undefined {
  const raw = readText(file);
  if (raw === undefined) return undefined;
  let core: string;
  let support: PersonaMaterial['support'] = [];
  if (kind === 'claude-agent' || kind === 'claude-output-style') {
    const { meta, body } = splitFrontmatter(raw);
    support = supportFiles(body, file);
    const title = meta.name ? `# ${meta.name}\n\n` : '';
    core = `${title}${body.trim()}\n`;
  } else {
    core = raw;
  }
  // "@file" would make Claude Code import the file on every run. Point at the plain copy instead, to be read only if useful.
  for (const f of support) core = core.split('@' + f.rel).join(`persona/${f.rel}`);
  return { core: capText(core, PERSONA_CORE_MAX, file), support };
}

/** Everything that decides what the workspace copy looks like (used to notice a changed source). */
export function personaText(kind: Persona['kind'], file: string): string | undefined {
  const m = personaMaterial(kind, file);
  return m ? m.core + m.support.map((f) => `\n\u0000${f.rel}\u0000${f.text}`).join('') : undefined;
}

// ---- the scan ---------------------------------------------------------------------------------

export interface ScanOptions {
  home?: string;
  /** Folders to skip entirely (the calendar's data home, the lab). */
  ownRoots?: string[];
  maxProjects?: number;
}

export function scanPersonas(opts: ScanOptions = {}): PersonaCandidate[] {
  const home = opts.home ?? userHome();
  const own = opts.ownRoots ?? [];
  const out: PersonaCandidate[] = [];
  const seen = new Set<string>();
  const add = (kind: Persona['kind'], file: string, project: string | undefined, fallbackName: string) => {
    const key = resolve(file);
    if (seen.has(key)) return;
    const raw = readText(file);
    if (raw === undefined || !raw.trim()) return;
    seen.add(key);
    const { meta, body } = splitFrontmatter(raw);
    out.push({
      id: candidateId(key),
      name: oneLine(personaNameFromText(raw, fallbackName), 60),
      kind,
      sourcePath: key,
      project,
      preview: previewOf(body, meta.description ?? ''),
    });
  };

  // User-level custom agents and output styles.
  for (const f of mdFiles(join(home, '.claude', 'agents'))) add('claude-agent', f, undefined, basename(f, '.md'));
  for (const f of mdFiles(join(home, '.claude', 'output-styles'))) add('claude-output-style', f, undefined, basename(f, '.md'));

  // Skill-style personas ("Load Mabel, …").
  const skillDirs = (dir: string) => { try { return readdirSync(dir).sort().map((d) => join(dir, d, 'SKILL.md')); } catch { return []; } };
  const addSkill = (file: string, project: string | undefined, fallback: string) => {
    const text = readText(file);
    if (text && isPersonaSkill(text)) add('claude-agent', file, project, fallback);
  };
  for (const f of skillDirs(join(home, '.claude', 'skills'))) addSkill(f, undefined, basename(join(f, '..')));

  // Projects Claude Code knows about.
  const projects = claudeProjects(home).filter((p) => p.path && !isOwnProject(p, own)).slice(0, opts.maxProjects ?? 80);
  for (const p of projects) {
    const path = p.path!;
    for (const f of mdFiles(join(path, '.claude', 'agents'))) add('claude-agent', f, path, basename(f, '.md'));
    for (const f of mdFiles(join(path, '.claude', 'output-styles'))) add('claude-output-style', f, path, basename(f, '.md'));
    for (const f of mdFiles(join(path, '.claude')).filter((x) => basename(x).toLowerCase() !== 'readme.md')) addSkill(f, path, basename(f, '.md'));
    for (const f of skillDirs(join(path, '.claude', 'skills'))) addSkill(f, path, basename(join(f, '..')));
    const claudeMd = join(path, 'CLAUDE.md');
    const text = readText(claudeMd);
    if (text && definesPersona(text)) add('claude-md', claudeMd, path, basename(path));
  }

  // Codex: AGENTS.md files of projects named in its session metadata.
  for (const cwd of codexProjects(home)) {
    if (isOwnFolder(cwd, own)) continue;
    const agents = join(cwd, 'AGENTS.md');
    const text = readText(agents);
    if (text && definesPersona(text)) add('codex-agents', agents, cwd, basename(cwd));
  }
  const globalAgents = join(home, '.codex', 'AGENTS.md');
  const globalText = readText(globalAgents);
  if (globalText && definesPersona(globalText)) add('codex-agents', globalAgents, undefined, 'Codex');
  return out;
}

/** Project folders named in Codex session metadata (the first line of each rollout file only), newest first. */
export function codexProjects(home = userHome(), limit = 300): string[] {
  const base = join(home, '.codex', 'sessions');
  if (!existsSync(base)) return [];
  const files: string[] = [];
  const walk = (dir: string, depth: number) => {
    let entries: string[];
    try { entries = readdirSync(dir).sort().reverse(); } catch { return; }
    for (const e of entries) {
      if (files.length >= limit) return;
      const full = join(dir, e);
      if (depth < 3) { try { if (statSync(full).isDirectory()) walk(full, depth + 1); } catch { /* skip */ } }
      else if (e.endsWith('.jsonl')) files.push(full);
    }
  };
  walk(base, 0);
  const cwds: string[] = [];
  for (const f of files) {
    const cwd = firstLineCwd(f);
    if (cwd && !cwds.includes(cwd) && existsSync(cwd)) cwds.push(cwd);
  }
  return cwds;
}

function firstLineCwd(file: string): string | undefined {
  try {
    const fd = openSync(file, 'r');
    try {
      const buf = Buffer.alloc(16_384);
      const n = readSync(fd, buf, 0, buf.length, 0);
      const line = buf.subarray(0, n).toString('utf8').split('\n')[0] ?? '';
      const obj = JSON.parse(line) as { cwd?: string; payload?: { cwd?: string } };
      return obj.payload?.cwd ?? obj.cwd;
    } finally { closeSync(fd); }
  } catch { return undefined; }
}

// ---- picking, copying, refreshing -------------------------------------------------------------

const sha = (s: string) => createHash('sha256').update(s).digest('hex');

export function personaFromCandidate(c: Pick<PersonaCandidate, 'id' | 'name' | 'kind' | 'sourcePath' | 'project'>, now = new Date()): Persona | undefined {
  const text = personaText(c.kind, c.sourcePath);
  if (text === undefined) return undefined;
  return { id: c.id, name: c.name, kind: c.kind, sourcePath: c.sourcePath, project: c.project, sourceHash: sha(text), copiedAt: now.toISOString() };
}

/** A file the user chose with "Choose a file…". */
export function personaFromFile(file: string, now = new Date()): Persona | undefined {
  const path = resolve(file);
  const raw = readText(path);
  if (raw === undefined || !raw.trim()) return undefined;
  const lower = path.toLowerCase();
  const kind: Persona['kind'] = lower.includes(`${sep}.claude${sep}agents${sep}`) || (lower.includes(`${sep}.claude${sep}`) && /^---\r?\n/.test(raw)) ? 'claude-agent'
    : lower.includes(`${sep}output-styles${sep}`) ? 'claude-output-style'
    : basename(lower) === 'agents.md' ? 'codex-agents'
    : 'claude-md';
  const name = oneLine(personaNameFromText(raw, basename(path).replace(/\.md$/i, '')), 60);
  return personaFromCandidate({ id: candidateId(path), name, kind, sourcePath: path, project: undefined }, now);
}

/**
 * Make the season workspace match the chosen persona: CLAUDE.md and AGENTS.md carry its text so the agent loads it natively.
 * When the source changed, the copy and the stored hash are refreshed (returns the updated persona).
 * When the source has disappeared the old copy stays. With no persona, only files this app wrote are removed.
 */
export function syncPersona(workspace: string, persona: Persona | undefined, opts: { force?: boolean } = {}): Persona | undefined {
  const files = [join(workspace, 'CLAUDE.md'), join(workspace, 'AGENTS.md')];
  const supportDir = join(workspace, 'persona');
  if (!persona) {
    for (const f of files) {
      const t = readText(f, 400);
      if (t?.startsWith(MARKER)) rmSync(f, { force: true });
    }
    rmSync(supportDir, { recursive: true, force: true });
    return undefined;
  }
  const material = personaMaterial(persona.kind, persona.sourcePath);
  const missing = files.some((f) => !existsSync(f));
  if (!material) {
    if (missing) writeCopies(workspace, persona, { core: `# ${persona.name}\n`, support: [] });
    return persona;
  }
  const hash = sha(personaText(persona.kind, persona.sourcePath)!);
  if (missing || opts.force || hash !== persona.sourceHash) {
    writeCopies(workspace, persona, material);
    return { ...persona, sourceHash: hash, copiedAt: new Date().toISOString() };
  }
  return persona;
}

/** The short frame at the top of the season CLAUDE.md / AGENTS.md: keep the identity, drop the usual job. */
export function personaFrame(name: string, support: string[] = []): string {
  const more = support.length
    ? `\nMore of your background is in plain files in this folder. Read them only if they help: ${support.map((f) => `persona/${f}`).join(', ')}.\n`
    : '';
  return `For this Advent calendar you are ${name}, acting as the user's Secret Santa. Keep your name, voice and personality; ignore work procedures, tools and tasks from your usual role.\n${more}\n`;
}

function writeCopies(workspace: string, persona: Persona, m: PersonaMaterial): void {
  const text = header(persona) + personaFrame(persona.name, m.support.map((f) => f.rel)) + m.core;
  for (const name of ['CLAUDE.md', 'AGENTS.md']) writeFileSync(join(workspace, name), text);
  const dir = join(workspace, 'persona');
  rmSync(dir, { recursive: true, force: true });
  for (const f of m.support) {
    const target = join(dir, f.rel);
    mkdirSync(join(target, '..'), { recursive: true });
    writeFileSync(target, f.text);
  }
}

function header(p: Persona): string {
  return `${MARKER}: ${p.name} · refreshed from ${p.sourcePath} · edit the source, not this copy -->\n\n`;
}
