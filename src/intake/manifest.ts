/**
 * Build a manifest from any accepted submission form (AGENT_CONNECTIONS §5 A–D).
 */
import { existsSync, readFileSync } from 'node:fs';
import { extname, join, posix } from 'node:path';
import { GIFT_KINDS, GIFT_SCHEMA_V1, GiftManifestSchema, type GiftKind, type GiftManifest } from '../shared/gift.js';
import type { GateProblem } from '../shared/api.js';
import { mimeFor } from './mime.js';
import type { UnpackedFile } from './unpack.js';

export const EMBEDDED_MANIFEST_RE = /<script\b[^>]*type\s*=\s*["']application\/advent-gift\+json["'][^>]*>([\s\S]*?)<\/script>/i;

export interface ManifestBuild {
  manifest?: GiftManifest;
  /** Which submission form was recognised. */
  form: 'A' | 'B' | 'C' | 'D' | 'unknown';
  problems: GateProblem[];
  /** True when the submission carried no day and one must be supplied by the caller. */
  needsDay: boolean;
}

export function kindForFile(path: string): GiftKind {
  const mime = mimeFor(path);
  const ext = extname(path).toLowerCase();
  if (mime === 'text/html') return 'interactive-html';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('video/')) return 'video';
  if (mime === 'application/pdf' || mime === 'text/plain' || mime === 'text/markdown' || ext === '.txt' || ext === '.md') return 'document';
  return 'download';
}

export function isKnownKind(kind: string): kind is GiftKind {
  return (GIFT_KINDS as readonly string[]).includes(kind);
}

function problem(code: string, message: string, path?: string, severity: 'error' | 'warning' = 'error'): GateProblem {
  return { code, message, path, severity };
}

/** Parse and validate a gift.json object into a manifest. */
export function parseManifestObject(raw: unknown, fallbackDay?: number): { manifest?: GiftManifest; problems: GateProblem[] } {
  // A manifest without "schema" (or one the calendar builds from loose files or text) follows the lenient gift@1 rules.
  if (raw && typeof raw === 'object' && !('schema' in raw)) (raw as Record<string, unknown>).schema = GIFT_SCHEMA_V1;
  if (raw && typeof raw === 'object' && !('day' in raw) && fallbackDay) (raw as Record<string, unknown>).day = fallbackDay;
  const result = GiftManifestSchema.safeParse(raw);
  if (result.success) return { manifest: result.data, problems: [] };
  return {
    problems: result.error.issues.map((i) => problem('manifest_invalid', `${i.path.join('.') || 'manifest'}: ${i.message}`, i.path.join('.'))),
  };
}

/**
 * Build the manifest for an unpacked quarantine folder.
 * - A: gift.json present (possibly nested one level, e.g. zip of a folder)
 * - B: a single .html file with an embedded manifest (or none → title from <title>)
 * - C: a single .txt/.md file → document
 * - D: loose media files → minimal manifest
 */
export function buildManifest(root: string, files: UnpackedFile[], opts: { day?: number; pastedTitle?: string } = {}): ManifestBuild {
  const problems: GateProblem[] = [];
  if (files.length === 0) return { form: 'unknown', problems: [problem('empty', 'The submission contains no files.')], needsDay: false };

  // Form A: gift.json at the root, or inside a single top-level folder.
  const manifestFile = files.find((f) => f.path === 'gift.json') ?? findNestedManifest(files);
  if (manifestFile) {
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(join(root, ...manifestFile.path.split('/')), 'utf8'));
    } catch (e) {
      return { form: 'A', problems: [problem('manifest_json', `gift.json is not valid JSON: ${(e as Error).message}`, manifestFile.path)], needsDay: false };
    }
    const prefix = manifestFile.path === 'gift.json' ? '' : posix.dirname(manifestFile.path) + '/';
    const parsed = parseManifestObject(raw, opts.day);
    if (!parsed.manifest) return { form: 'A', problems: parsed.problems, needsDay: false };
    const manifest = prefix ? rebase(parsed.manifest, prefix) : parsed.manifest;
    return { form: 'A', manifest, problems, needsDay: false };
  }

  const nonDir = files.filter((f) => !f.path.startsWith('__MACOSX/') && !f.path.endsWith('.DS_Store'));
  const htmlFiles = nonDir.filter((f) => mimeFor(f.path) === 'text/html');

  // Form B: single HTML (other files may be assets it references).
  if (htmlFiles.length === 1 && (nonDir.length === 1 || nonDir.every((f) => f === htmlFiles[0] || !['text/html', 'text/plain', 'text/markdown'].includes(mimeFor(f.path))))) {
    const html = htmlFiles[0]!;
    const text = readFileSync(join(root, ...html.path.split('/')), 'utf8');
    const m = text.match(EMBEDDED_MANIFEST_RE);
    if (m) {
      let raw: unknown;
      try {
        raw = JSON.parse(m[1]!.trim());
      } catch (e) {
        return { form: 'B', problems: [problem('manifest_json', `Embedded manifest is not valid JSON: ${(e as Error).message}`, html.path)], needsDay: false };
      }
      const obj = raw as Record<string, unknown>;
      if (!obj.primary) obj.primary = html.path;
      if (!Array.isArray(obj.artifacts) || obj.artifacts.length === 0) obj.artifacts = [{ path: html.path, kind: 'interactive-html', role: 'primary' }];
      const parsed = parseManifestObject(obj, opts.day);
      return { form: 'B', manifest: parsed.manifest, problems: parsed.problems, needsDay: !parsed.manifest && !obj.day && !opts.day };
    }
    const title = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, ' ').trim() || opts.pastedTitle || 'A little something';
    if (!opts.day) return { form: 'B', problems: [], needsDay: true };
    const parsed = parseManifestObject(
      {
        day: opts.day,
        title: decodeEntities(title).slice(0, 160),
        note: 'Your Secret Santa dropped this one straight into the envelope, without a card. Open it and see.',
        primary: html.path,
        artifacts: nonDir.map((f) => ({ path: f.path, kind: f === html ? 'interactive-html' : kindForFile(f.path), role: f === html ? 'primary' : 'asset' })),
      },
      opts.day,
    );
    return { form: 'B', manifest: parsed.manifest, problems: parsed.problems, needsDay: false };
  }

  // Form C: a single text or markdown file.
  if (nonDir.length === 1 && ['text/plain', 'text/markdown'].includes(mimeFor(nonDir[0]!.path))) {
    const file = nonDir[0]!;
    const text = readFileSync(join(root, ...file.path.split('/')), 'utf8');
    if (!opts.day) return { form: 'C', problems: [], needsDay: true };
    const parsed = parseManifestObject(manifestFromText(text, opts.day, file.path, opts.pastedTitle), opts.day);
    return { form: 'C', manifest: parsed.manifest, problems: parsed.problems, needsDay: false };
  }

  // Form D: loose media (image, audio, video, PDF), possibly several.
  const mediaKinds = new Set(['image', 'audio', 'video', 'document']);
  if (nonDir.length >= 1 && nonDir.every((f) => mediaKinds.has(kindForFile(f.path)) || f.downloadOnly)) {
    if (!opts.day) return { form: 'D', problems: [], needsDay: true };
    const primary = nonDir.find((f) => ['video', 'audio', 'image', 'document'].includes(kindForFile(f.path))) ?? nonDir[0]!;
    const parsed = parseManifestObject(
      {
        day: opts.day,
        title: opts.pastedTitle ?? titleFromFilename(primary.path),
        note: 'Your Secret Santa dropped this one straight into the envelope, without a card. Open it and see.',
        primary: primary.path,
        artifacts: nonDir.map((f) => ({ path: f.path, kind: f.downloadOnly ? 'download' : kindForFile(f.path), role: f === primary ? 'primary' : 'download' })),
      },
      opts.day,
    );
    return { form: 'D', manifest: parsed.manifest, problems: parsed.problems, needsDay: false };
  }

  return {
    form: 'unknown',
    problems: [problem('manifest_missing', 'No gift.json found. Add a gift.json manifest (see AGENT_GUIDE.md), or submit a single HTML file, a text file, or media files.')],
    needsDay: false,
  };
}

export function manifestFromText(text: string, day: number, path = 'gift.md', fallbackTitle?: string): Record<string, unknown> {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  let title = fallbackTitle ?? 'A letter for you';
  const first = lines.findIndex((l) => l.trim().length > 0);
  if (first >= 0 && /^#\s+/.test(lines[first]!)) {
    title = lines[first]!.replace(/^#\s+/, '').trim().slice(0, 160) || title;
  }
  return {
    day,
    title,
    category: 'A little letter',
    note: 'Your Secret Santa wrote this one by hand, so to speak. Read it slowly.',
    primary: path,
    artifacts: [{ path, kind: 'document', role: 'primary' }],
  };
}

function findNestedManifest(files: UnpackedFile[]): UnpackedFile | undefined {
  const tops = new Set(files.map((f) => f.path.split('/')[0]));
  const real = [...tops].filter((t) => t !== '__MACOSX');
  if (real.length !== 1) return undefined;
  return files.find((f) => f.path === `${real[0]}/gift.json`);
}

function rebase(m: GiftManifest, prefix: string): GiftManifest {
  const fix = (p: string) => (p.startsWith(prefix) ? p : prefix + p);
  return {
    ...m,
    primary: m.primary ? fix(m.primary) : undefined,
    artifacts: m.artifacts.map((a) => ({ ...a, path: fix(a.path) })),
    song: m.song ? { score: fix(m.song.score), renderSheet: m.song.renderSheet ? fix(m.song.renderSheet) : undefined, wav: m.song.wav ? fix(m.song.wav) : undefined } : undefined,
  };
}

function titleFromFilename(p: string): string {
  const base = posix.basename(p).replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : 'A little something';
}

function decodeEntities(s: string): string {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

export function manifestPrimaryKind(m: GiftManifest): GiftKind {
  if (m.song) return 'song';
  if (m.realWorld && !m.primary) return 'real-world';
  if (m.primary) {
    const a = m.artifacts.find((x) => x.path === m.primary);
    if (a && isKnownKind(a.kind)) return a.kind;
    if (a) return kindForFile(a.path) === 'download' ? 'download' : kindForFile(a.path);
    return kindForFile(m.primary);
  }
  const primaryArtifact = m.artifacts.find((a) => a.role === 'primary') ?? m.artifacts[0];
  if (primaryArtifact) return isKnownKind(primaryArtifact.kind) ? primaryArtifact.kind : kindForFile(primaryArtifact.path);
  if (m.realWorld) return 'real-world';
  if (m.links && m.links.length) return 'link';
  return 'download';
}

export function fileExists(root: string, rel: string): boolean {
  return existsSync(join(root, ...rel.split('/')));
}
