/** Per-type checks (ARCHITECTURE §7 step 3) and the D1 wording rule. */
import { readFileSync, statSync } from 'node:fs';
import { join, posix } from 'node:path';
import { spawnSync } from 'node:child_process';
import { ALLOWED_CREDIT_LICENSES, FORBIDDEN_PURCHASE_CLAIMS, GIFT_SCHEMA_ID, TIERS, type GiftManifest } from '../shared/gift.js';
import { LIBRARY_DIR } from '../core/package-paths.js';
import { existsSync } from 'node:fs';
import type { GateProblem } from '../shared/api.js';
import { mimeFor, sniffImage, sniffMedia, wavDuration } from './mime.js';
import { fileExists, kindForFile, manifestPrimaryKind } from './manifest.js';
import type { UnpackedFile } from './unpack.js';
import { isToolGift, toolFiles } from '../shared/tool.js';

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
  if (manifest.save && !files.some((f) => f.path === manifest.save!.file)) problems.push(p('save_missing', `save.file "${manifest.save.file}" is not in the package. Point it at the gift's primary file.`, manifest.save.file));
  if (!manifest.primary && manifest.artifacts.length === 0 && !manifest.realWorld && !(manifest.links && manifest.links.length)) {
    problems.push(p('nothing_to_show', 'The gift has no primary file, no artifacts, no real-world proposal and no links. There is nothing to open.'));
  }
  const kind = manifestPrimaryKind(manifest);

  const v2 = manifest.schema === GIFT_SCHEMA_ID;
  if (v2) problems.push(...checkV2(root, manifest, byPath));
  else problems.push(p('schema_v1', 'This gift uses the older gift@1 manifest. Use "schema": "advent-agent/gift@2" with emotion, interaction and a share frame (see the gift-director skill).', undefined, 'warning'));

  // D1: never claim a purchase or booking.
  const claimTexts = [manifest.title, manifest.subtitle ?? '', manifest.note ?? '', manifest.realWorld?.whatsLeft ?? '', manifest.signature ?? '', manifest.followUp?.offer ?? '', manifest.followUp?.prompt ?? '', ...(manifest.realWorld?.items.map((i) => i.notes ?? '') ?? []), manifest.share?.caption ?? '', ...manifest.downloads.map((d) => d.label), ...manifest.print.map((x) => x.product ?? '')];
  if (v2) {
    // gift@2: the words may not appear at all, not even negated (SPEC_CHANGES "check_gift additionally fails on").
    const all = claimTexts.join('\n').toLowerCase();
    const hit = FORBIDDEN_PURCHASE_CLAIMS.find((w) => new RegExp(`\\b${w.replace(/ /g, '\\s+')}\\b`).test(all));
    if (hit) problems.push(p('purchase_claim', `The text contains "${hit}". The agent never purchases or books, and gift text never uses that word, even negated. Say what is left for them to do instead.`));
  }
  const strict = Boolean(manifest.realWorld) || kind === 'real-world' || kind === 'link';
  for (const text of v2 ? [] : claimTexts) {
    const claim = findPurchaseClaim(text, strict);
    if (claim) {
      problems.push(p('purchase_claim', `The text says "${claim}". The agent never purchases or books anything; say what you prepared and what is left for the recipient to do.`, undefined, strict ? 'error' : 'warning'));
    }
  }

  // Small tools (D27): their own rules; their files are never run by the calendar.
  const tool = new Set(toolFiles(manifest, files.map((f) => f.path)));
  if (isToolGift(manifest)) problems.push(...checkTool(root, manifest, [...tool]));

  // Per-file checks.
  for (const file of files) {
    if (file.downloadOnly || tool.has(file.path)) continue;
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
      const htmlProblems = checkHtml(root, file.path, html, opts.allowedNetwork ?? manifest.network);
      // gift@2: remote media is an error too (no network, no CDN), unless the origin was declared and allowed.
      problems.push(...(v2 ? htmlProblems.map((x) => (x.code === 'remote_media' ? { ...x, severity: 'error' as const } : x)) : htmlProblems));
      if (v2) problems.push(...checkNetworkCalls(file.path, html));
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
    } else if (v2 && mime === 'text/javascript') {
      problems.push(...checkNetworkCalls(file.path, readFileSync(full, 'utf8')));
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

const DELETE_CALLS: Array<[RegExp, string]> = [
  [/\brm\s+-[a-zA-Z]*(?:r[a-zA-Z]*f|f[a-zA-Z]*r)\b/, 'rm -rf'],
  [/\bshutil\.rmtree\b/, 'shutil.rmtree'],
  [/\bos\.remove\b/, 'os.remove'],
  [/\bunlink(?:Sync)?\s*\(|\.unlink\b|\bos\.unlink\b|\bunlink\s+\S/, 'unlink'],
  [/\b(?:fs\.)?rmSync\s*\(|\bfs\.rm\s*\(/, 'fs.rm'],
  [/\bRemove-Item\b/i, 'Remove-Item'],
];
const DRY_RUN = /dry[\s_-]?run/i;
const NETWORK_IMPORTS: Array<[RegExp, string]> = [
  [/^\s*(?:import|from)\s+(?:requests|urllib\.request|urllib3|http\.client|httpx|aiohttp|socket)\b/m, 'a Python network module'],
  [/\brequire\(\s*['"](?:node:)?(?:https?|net|dgram)['"]\s*\)|\bfrom\s+['"](?:node:)?(?:https?|net|dgram)['"]|\bfetch\s*\(/, 'a network call'],
  [/(?:^|[\s;|&(])(?:curl|wget)\s/m, 'curl or wget'],
  [/\bInvoke-WebRequest\b|\bInvoke-RestMethod\b/i, 'Invoke-WebRequest'],
];

/**
 * Small tools (gift-director §6): a README, an uninstall path, no deleting without a dry-run guard.
 * Network use is a warning: tools should work offline, but the calendar never runs them.
 */
export function checkTool(root: string, m: GiftManifest, paths: string[]): GateProblem[] {
  const out: GateProblem[] = [];
  if (paths.length === 0) return [p('tool_files_missing', 'A tool gift keeps its files in a tool/ folder (the script, README.md, and install and uninstall steps). The folder is missing or empty.')];
  if (!m.primary) out.push(p('tool_display_missing', 'A tool gift needs something to show: a terminal screenshot you rendered (an image) or an index.html with real output, as "entry".'));
  const read = (rel: string) => { try { return readFileSync(join(root, ...rel.split('/')), 'utf8'); } catch { return ''; } };
  const readme = paths.find((x) => /^readme(\.[a-z]+)?$/i.test(posix.basename(x)));
  if (!readme) out.push(p('tool_readme_missing', 'The tool has no README in tool/. Say what it does, which systems and shells it supports, and how to install and uninstall it in one line each.'));
  const hasUninstallFile = paths.some((x) => /uninstall/i.test(posix.basename(x)));
  if (!hasUninstallFile && !(readme && /uninstall/i.test(read(readme)))) out.push(p('tool_uninstall_missing', 'The tool has no uninstall instruction. Add an uninstall script or an "Uninstall" line in the README that restores what was there before.', readme));
  for (const rel of paths) {
    if (rel === readme || /\.(md|txt|png|jpe?g|gif|svg|webp)$/i.test(rel)) continue;
    const code = read(rel);
    const del = DELETE_CALLS.find(([re]) => re.test(code));
    if (del && !DRY_RUN.test(code)) out.push(p('tool_deletes', `${rel} calls ${del[1]} with no dry-run guard. Tools never delete: move or copy instead, make a dry run the default, and write an undo log.`, rel));
    const net = NETWORK_IMPORTS.find(([re]) => re.test(code));
    if (net) out.push(p('tool_network', `${rel} uses ${net[1]}. Small tools should work offline with the standard library; say clearly in the README if it needs the network.`, rel, 'warning'));
  }
  return out;
}

/** Local references must exist; remote script/style are errors unless the origin is allowed; remote media is a warning. */
/** Network APIs a gift may not use: the gift origin blocks them anyway (connect-src 'none'), so the gift would break. */
export function checkNetworkCalls(path: string, code: string): GateProblem[] {
  const out: GateProblem[] = [];
  const scripts = path.endsWith('.js') || path.endsWith('.mjs') ? code : [...code.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]).join('\n');
  const checks: Array<[RegExp, string]> = [
    [/\bfetch\s*\(/, 'fetch()'],
    [/\bnew\s+XMLHttpRequest\b/, 'XMLHttpRequest'],
    [/\bnew\s+WebSocket\s*\(/, 'WebSocket'],
    [/\bnew\s+EventSource\s*\(/, 'EventSource'],
    [/\bsendBeacon\s*\(/, 'navigator.sendBeacon'],
    [/\bimport\s*\(\s*['"`]https?:/, 'a remote import()'],
    [/\bimport\s+[^;]*?from\s+['"]https?:/, 'a remote import'],
  ];
  for (const [re, what] of checks) {
    if (re.test(scripts)) out.push(p('network_request', `${path} uses ${what}. Gifts work offline and the calendar blocks network access: inline the data instead (JSON in a <script type="application/json">, data: URIs for media).`, path));
  }
  return out;
}

function checkV2(root: string, m: GiftManifest, byPath: Map<string, UnpackedFile>): GateProblem[] {
  const out: GateProblem[] = [];
  const exists = (rel: string) => byPath.has(rel) || fileExists(root, rel);
  if (!m.emotion) out.push(p('emotion_missing', 'gift.json needs "emotion": one of funny, ridiculous, absurd, cute, touching.'));
  if (!m.interaction || (Array.isArray(m.interaction) && m.interaction.length === 0)) out.push(p('interaction_missing', 'gift.json needs "interaction": the verb(s) of the delight, e.g. ["shake"].'));
  if (!m.share) out.push(p('share_missing', 'gift.json needs a "share" frame: "still": "share.png" (1080×1350) or { "capture": "still" } with window.adventCapture in index.html.'));
  else {
    if (typeof m.share.still === 'string' && !exists(m.share.still)) out.push(p('share_file_missing', `The share still ${m.share.still} is not in the package.`, m.share.still));
    if (typeof m.share.loop === 'string' && !exists(m.share.loop)) out.push(p('share_file_missing', `The share loop ${m.share.loop} is not in the package.`, m.share.loop));
    const wantsCapture = typeof m.share.still !== 'string' || (m.share.loop !== undefined && typeof m.share.loop !== 'string');
    const entry = m.primary;
    if (wantsCapture) {
      if (!entry || !/\.html?$/i.test(entry)) out.push(p('share_missing', 'A capture share frame needs an HTML entry page with window.adventCapture. Provide share.png instead.'));
      else if (exists(entry) && !/adventCapture/.test(readFileSync(join(root, ...entry.split('/')), 'utf8'))) {
        out.push(p('capture_hook_missing', `${entry} does not define window.adventCapture; the calendar will capture the page as it first appears.`, entry, 'warning'));
      }
    }
  }
  for (const d of m.downloads) if (!exists(d.file)) out.push(p('file_missing', `The download "${d.label}" points to ${d.file}, which is not in the package.`, d.file));
  const allowed = ALLOWED_CREDIT_LICENSES.map((l) => l.toLowerCase().replace(/[\s_-]+/g, ''));
  for (const c of m.credits) {
    const norm = c.license.toLowerCase().replace(/[\s_-]+/g, '');
    const ok = allowed.some((a) => norm === a || (norm.startsWith(a) && !/nc|nd|sa/.test(norm.slice(a.length))));
    if (!ok || /nc|nd|gpl|commonsclause/.test(norm)) out.push(p('credit_license', `"${c.what}" from ${c.source} is credited under ${c.license}, which may not be copied into a gift. Rewrite it yourself (see inspiration-sources.md).`));
  }
  if (m.ideaId && m.tierUsed) {
    const ideaTier = ideaMinimumTier(m.ideaId);
    if (ideaTier && TIERS.indexOf(ideaTier) > TIERS.indexOf(m.tierUsed)) out.push(p('tier_too_small', `${m.ideaId} needs tier ${ideaTier} or more; this gift used ${m.tierUsed}. Make sure scope was cut, not polish.`, undefined, 'warning'));
  }
  return out;
}

function ideaMinimumTier(id: string): (typeof TIERS)[number] | undefined {
  const file = join(LIBRARY_DIR, 'INDEX.json');
  if (!existsSync(file)) return undefined;
  try {
    return (JSON.parse(readFileSync(file, 'utf8')) as { ideas: Array<{ id: string; tier: (typeof TIERS)[number] }> }).ideas.find((i) => i.id === id)?.tier;
  } catch { return undefined; }
}

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
