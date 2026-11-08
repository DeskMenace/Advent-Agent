/** Per-type checks (ARCHITECTURE §7 step 3) and the D1 wording rule. */
import { readFileSync, statSync } from 'node:fs';
import { join, posix } from 'node:path';
import { spawnSync } from 'node:child_process';
import { FORBIDDEN_PURCHASE_CLAIMS, type GiftManifest } from '../shared/gift.js';
import type { GateProblem } from '../shared/api.js';
import { mimeFor, sniffImage, sniffMedia, wavDuration } from './mime.js';
import { fileExists, kindForFile, manifestPrimaryKind } from './manifest.js';
import type { UnpackedFile } from './unpack.js';

const MAX_HTML_BYTES = 8 * 1024 * 1024;

function p(code: string, message: string, path?: string, severity: 'error' | 'warning' = 'error'): GateProblem {
  return { code, message, path, severity };
}

export interface CheckOptions {
  /** Origins the gift may load from (manifest.network ∩ user policy). */
  allowedNetwork?: string[];
  /** Run ffprobe when available. */
  ffprobe?: boolean;
}

export function ffprobePath(): string | undefined {
  const candidates = process.platform === 'win32' ? ['ffprobe.exe', 'ffprobe'] : ['ffprobe'];
  for (const c of candidates) {
    const r = spawnSync(c, ['-version'], { encoding: 'utf8', shell: false, timeout: 5000 });
    if (r.status === 0) return c;
  }
  return undefined;
}

let ffprobeCache: string | undefined | null = null;
function ffprobe(): string | undefined {
  if (ffprobeCache === null) ffprobeCache = ffprobePath();
  return ffprobeCache;
}

export function checkManifest(root: string, files: UnpackedFile[], manifest: GiftManifest, opts: CheckOptions = {}): { problems: GateProblem[]; media: 'passed' | 'failed' | 'skipped' } {
  const problems: GateProblem[] = [];
  let media: 'passed' | 'failed' | 'skipped' = 'skipped';
  const byPath = new Map(files.map((f) => [f.path, f]));

  // Paths named in the manifest must exist.
  const named = new Set<string>();
  if (manifest.primary) named.add(manifest.primary);
  for (const a of manifest.artifacts) named.add(a.path);
  if (manifest.song) {
    named.add(manifest.song.score);
    if (manifest.song.renderSheet) named.add(manifest.song.renderSheet);
    if (manifest.song.wav) named.add(manifest.song.wav);
  }
  for (const path of named) {
    if (!byPath.has(path) && !fileExists(root, path)) problems.push(p('file_missing', `The manifest names ${path}, but the file is not in the package.`, path));
  }
  if (!manifest.primary && manifest.artifacts.length === 0 && !manifest.realWorld && !(manifest.links && manifest.links.length)) {
    problems.push(p('nothing_to_show', 'The gift has no primary file, no artifacts, no real-world proposal and no links. There is nothing to open.'));
  }
  const kind = manifestPrimaryKind(manifest);

  // D1: never claim a purchase or booking.
  const claimTexts = [manifest.title, manifest.subtitle ?? '', manifest.note, manifest.realWorld?.whatsLeft ?? '', ...(manifest.realWorld?.items.map((i) => i.notes ?? '') ?? [])];
  const strict = Boolean(manifest.realWorld) || kind === 'real-world' || kind === 'link';
  for (const text of claimTexts) {
    const claim = findPurchaseClaim(text, strict);
    if (claim) {
      problems.push(p('purchase_claim', `The text says "${claim}". The agent never purchases or books anything; say what you prepared and what is left for the recipient to do.`, undefined, strict ? 'error' : 'warning'));
    }
  }

  // Per-file checks.
  for (const file of files) {
    if (file.downloadOnly) continue;
    const full = join(root, ...file.path.split('/'));
    const fileKind = kindForFile(file.path);
    const mime = mimeFor(file.path);
    if (file.bytes === 0) {
      problems.push(p('file_empty', `${file.path} is empty.`, file.path, named.has(file.path) ? 'error' : 'warning'));
      continue;
    }
    if (mime === 'text/html') {
      if (file.bytes > MAX_HTML_BYTES) problems.push(p('html_too_large', `${file.path} is larger than 8 MB. Move media into separate files.`, file.path));
      const html = readFileSync(full, 'utf8');
      problems.push(...checkHtml(root, file.path, html, opts.allowedNetwork ?? manifest.network));
    } else if (fileKind === 'image') {
      const head = readFileSync(full).subarray(0, 64 * 1024);
      const info = sniffImage(head);
      if (info.format === 'unknown') problems.push(p('image_invalid', `${file.path} is not a recognisable image.`, file.path, named.has(file.path) ? 'error' : 'warning'));
      else if (info.format !== 'svg' && info.format !== 'avif' && (!info.width || !info.height)) problems.push(p('image_dimensions', `${file.path} has no readable dimensions.`, file.path, 'warning'));
    } else if (fileKind === 'audio' || fileKind === 'video') {
      const head = readFileSync(full).subarray(0, 64 * 1024);
      const container = sniffMedia(head);
      if (container === 'unknown') {
        problems.push(p('media_invalid', `${file.path} does not look like a valid audio/video container.`, file.path, named.has(file.path) ? 'error' : 'warning'));
        media = 'failed';
      } else if (container === 'wav') {
        const dur = wavDuration(readFileSync(full));
        if (!dur || dur <= 0) { problems.push(p('wav_invalid', `${file.path} has no decodable PCM data.`, file.path)); media = 'failed'; }
        else if (media !== 'failed') media = 'passed';
      } else if (opts.ffprobe !== false && ffprobe()) {
        const r = spawnSync(ffprobe()!, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', full], { encoding: 'utf8', shell: false, timeout: 20_000 });
        if (r.status !== 0 || !Number.isFinite(Number(r.stdout.trim())) || Number(r.stdout.trim()) <= 0) {
          problems.push(p('media_decode', `${file.path} could not be decoded (ffprobe): ${r.stderr.trim().split('\n')[0] ?? 'unknown error'}`, file.path));
          media = 'failed';
        } else if (media !== 'failed') media = 'passed';
      }
    } else if (mime === 'text/plain' || mime === 'text/markdown') {
      const buf = readFileSync(full);
      if (!isValidUtf8(buf)) problems.push(p('text_encoding', `${file.path} is not valid UTF-8.`, file.path));
      else if (buf.toString('utf8').trim().length === 0) problems.push(p('text_empty', `${file.path} contains no text.`, file.path));
    } else if (mime === 'application/pdf') {
      const head = readFileSync(full).subarray(0, 8).toString('latin1');
      if (!head.startsWith('%PDF-')) problems.push(p('pdf_invalid', `${file.path} is not a PDF.`, file.path));
    } else if (mime === 'application/json') {
      try { JSON.parse(readFileSync(full, 'utf8')); } catch { problems.push(p('json_invalid', `${file.path} is not valid JSON.`, file.path, named.has(file.path) ? 'error' : 'warning')); }
    }
  }

  // Song specifics.
  if (manifest.song) {
    const scorePath = join(root, ...manifest.song.score.split('/'));
    if (fileExists(root, manifest.song.score)) {
      try {
        const score = JSON.parse(readFileSync(scorePath, 'utf8')) as { tracks?: unknown[]; tempo?: number };
        if (!Array.isArray(score.tracks) || score.tracks.length === 0) problems.push(p('score_tracks', 'The score has no tracks.', manifest.song.score));
        if (typeof score.tempo !== 'number' || score.tempo <= 0) problems.push(p('score_tempo', 'The score needs a positive tempo (BPM).', manifest.song.score));
      } catch (e) {
        problems.push(p('score_json', `The score is not valid JSON: ${(e as Error).message}`, manifest.song.score));
      }
    }
    if (!manifest.song.renderSheet) problems.push(p('render_sheet_missing', 'A song gift should include a render-it-yourself sheet (lyrics, style tags, a ready-to-paste prompt).', undefined, 'warning'));
  }

  // Real-world: dates sane.
  if (manifest.realWorld) {
    for (const item of manifest.realWorld.items) {
      if (Number.isNaN(Date.parse(item.checkedAt))) problems.push(p('checked_at', `${item.name}: checkedAt is not a date.`));
      if (item.price !== undefined && !item.currency) problems.push(p('currency_missing', `${item.name}: a price needs a currency.`));
    }
  }

  // Incomplete list is fine but must be honest: warn when claimed complete gifts list incomplete items.
  if (manifest.incomplete.length > 0) problems.push(p('incomplete', `The gift declares unfinished parts: ${manifest.incomplete.join('; ')}`, undefined, 'warning'));

  return { problems, media };
}

/** Local references must exist; remote script/style are errors unless the origin is allowed; remote media is a warning. */
const NEGATION_RE = /\b(?:nothing|not|no|never|none|without|neither|nor|haven't|hasn't|isn't|wasn't|weren't|aren't|don't|didn't|won't|can't|cannot|unless|until|once you|when you|after you|if you|you'll|you can|you could|you decide|to be|yet to|still to|remains? to|left to|ready to)\b/i;

/**
 * Returns the offending claim when the text asserts that a purchase or booking happened.
 * Sentences that negate the claim ("nothing has been ordered", "not booked yet", "once you have paid") are fine.
 * In strict mode (real-world proposals) any un-negated use of the words counts; otherwise only first-person claims.
 */
export function findPurchaseClaim(text: string, strict: boolean): string | undefined {
  const sentences = text.split(/(?<=[.!?])\s+|\n+/);
  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    for (const claim of FORBIDDEN_PURCHASE_CLAIMS) {
      const word = claim.replace(/ /g, '\\s+');
      const firstPerson = new RegExp(`\\b(?:i|i've|i have|we|we've|your agent|it's been|has been|have been|was|were|is|are)\\s+(?:already\\s+|just\\s+|now\\s+)?${word}\\b`);
      const anywhere = new RegExp(`\\b${word}\\b`);
      if (!anywhere.test(lower)) continue;
      if (NEGATION_RE.test(lower)) continue;
      if (firstPerson.test(lower) || strict) return claim;
    }
  }
  return undefined;
}

export function checkHtml(root: string, htmlPath: string, html: string, allowedNetwork: string[] = []): GateProblem[] {
  const problems: GateProblem[] = [];
  const dir = posix.dirname(htmlPath);
  const allowed = allowedNetwork.map((u) => { try { return new URL(u).origin; } catch { return u; } });
  const refs = [...html.matchAll(/<(script|link|img|audio|video|source|iframe|embed|object|track|use)\b[^>]*?\s(?:src|href|data|xlink:href)\s*=\s*["']([^"'#]+)["']/gi)];
  for (const m of refs) {
    const tag = m[1]!.toLowerCase();
    const ref = m[2]!.trim();
    if (ref.startsWith('data:') || ref.startsWith('blob:') || ref.startsWith('about:') || ref.startsWith('javascript:') || ref.startsWith('mailto:')) continue;
    if (/^(https?:)?\/\//i.test(ref)) {
      let origin = ref;
      try { origin = new URL(ref.startsWith('//') ? 'https:' + ref : ref).origin; } catch { /* keep */ }
      const ok = allowed.includes(origin);
      if (tag === 'script' || (tag === 'link' && /rel\s*=\s*["'][^"']*stylesheet/i.test(m[0]!)) || tag === 'iframe' || tag === 'object' || tag === 'embed') {
        if (!ok) problems.push(p('remote_code', `${htmlPath} loads ${tag} from ${origin}. Inline it or declare the origin in "network" (the user must consent).`, htmlPath));
      } else if (!ok) {
        problems.push(p('remote_media', `${htmlPath} loads ${tag} from ${origin}. It will be blocked unless the origin is declared in "network" and the user consents.`, htmlPath, 'warning'));
      }
      continue;
    }
    if (tag === 'link' && !/rel\s*=\s*["'][^"']*(stylesheet|icon|manifest|preload|modulepreload)/i.test(m[0]!)) continue;
    if (tag === 'use' || /^[a-z]+:/i.test(ref)) continue;
    const target = ref.startsWith('/') ? ref.slice(1) : posix.normalize(posix.join(dir === '.' ? '' : dir, ref.split('?')[0]!));
    if (target.startsWith('..')) { problems.push(p('ref_outside', `${htmlPath} references ${ref}, which is outside the package.`, htmlPath)); continue; }
    if (!fileExists(root, target)) problems.push(p('ref_missing', `${htmlPath} references ${ref}, but ${target} is not in the package.`, htmlPath));
  }
  if (!/<html[\s>]/i.test(html) && !/<!doctype html/i.test(html) && !/<body[\s>]/i.test(html)) {
    problems.push(p('html_shape', `${htmlPath} does not look like an HTML document (no <html>, <body> or doctype).`, htmlPath, 'warning'));
  }
  return problems;
}

export function isValidUtf8(buf: Buffer): boolean {
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buf);
    return true;
  } catch {
    return false;
  }
}

export function totalBytes(root: string, files: UnpackedFile[]): number {
  return files.reduce((s, f) => s + statSync(join(root, ...f.path.split('/'))).size, 0);
}
