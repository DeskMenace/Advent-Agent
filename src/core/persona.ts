/**
 * Personas (D28): "Who is your Secret Santa?". A file scan by the app finds candidate personas in the user's agent setup;
 * the one they pick is copied into the season workspace as CLAUDE.md and AGENTS.md so the agent loads it natively.
 * Nothing here runs an agent, and nothing writes to the persona's own project.
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync, rmSync, openSync, readSync, closeSync } from 'node:fs';
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
  return /\byour name is\b/i.test(head) || /^\s*(?:#+\s*)?(?:you are|act as|i am)\s+(?:a |an |the )?[A-Za-z]/im.test(head) || /^#+\s*persona\b/im.test(head);
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

/** The persona text that is copied into the workspace for a source file. */
export function personaTextFor(kind: Persona['kind'], file: string): string | undefined {
  const raw = readText(file);
  if (raw === undefined) return undefined;
  if (kind === 'claude-agent' || kind === 'claude-output-style') {
    const { meta, body } = splitFrontmatter(raw);
    const title = meta.name ? `# ${meta.name}\n\n` : '';
    return `${title}${body.trim()}\n`;
  }
  return raw;
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

  // Projects Claude Code knows about.
  const projects = claudeProjects(home).filter((p) => p.path && !isOwnProject(p, own)).slice(0, opts.maxProjects ?? 80);
  for (const p of projects) {
    const path = p.path!;
    for (const f of mdFiles(join(path, '.claude', 'agents'))) add('claude-agent', f, path, basename(f, '.md'));
    for (const f of mdFiles(join(path, '.claude', 'output-styles'))) add('claude-output-style', f, path, basename(f, '.md'));
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
  const text = personaTextFor(c.kind, c.sourcePath);
  if (text === undefined) return undefined;
  return { id: c.id, name: c.name, kind: c.kind, sourcePath: c.sourcePath, project: c.project, sourceHash: sha(text), copiedAt: now.toISOString() };
}

/** A file the user chose with "Choose a file…". */
export function personaFromFile(file: string, now = new Date()): Persona | undefined {
  const path = resolve(file);
  const raw = readText(path);
  if (raw === undefined || !raw.trim()) return undefined;
  const lower = path.toLowerCase();
  const kind: Persona['kind'] = lower.includes(`${sep}.claude${sep}agents${sep}`) ? 'claude-agent'
    : lower.includes(`${sep}output-styles${sep}`) ? 'claude-output-style'
    : basename(lower) === 'agents.md' ? 'codex-agents'
    : 'claude-md';
  const name = oneLine(personaNameFromText(raw, basename(path).replace(/\.md$/i, '')), 60);
  return personaFromCandidate({ id: candidateId(path), name, kind, sourcePath: path, project: undefined }, now);
}

function header(p: Persona): string {
  return `${MARKER}: ${p.name} · refreshed from ${p.sourcePath} · edit the source, not this copy -->\n\n`;
}

/**
 * Make the season workspace match the chosen persona: CLAUDE.md and AGENTS.md carry its text so the agent loads it natively.
 * When the source changed, the copy and the stored hash are refreshed (returns the updated persona).
 * When the source has disappeared the old copy stays. With no persona, only files this app wrote are removed.
 */
export function syncPersona(workspace: string, persona: Persona | undefined, opts: { force?: boolean } = {}): Persona | undefined {
  const files = [join(workspace, 'CLAUDE.md'), join(workspace, 'AGENTS.md')];
  if (!persona) {
    for (const f of files) {
      const t = readText(f, 400);
      if (t?.startsWith(MARKER)) rmSync(f, { force: true });
    }
    return undefined;
  }
  const text = personaTextFor(persona.kind, persona.sourcePath);
  const missing = files.some((f) => !existsSync(f));
  if (text === undefined) {
    if (missing) writeCopies(files, persona, undefined);
    return persona;
  }
  const hash = sha(text);
  if (missing || opts.force || hash !== persona.sourceHash) {
    writeCopies(files, persona, text);
    return { ...persona, sourceHash: hash, copiedAt: new Date().toISOString() };
  }
  return persona;
}

function writeCopies(files: string[], persona: Persona, text: string | undefined): void {
  const body = text ?? `# ${persona.name}\n`;
  for (const f of files) writeFileSync(f, header(persona) + body);
}
