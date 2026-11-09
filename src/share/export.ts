/**
 * Sharing = exporting (D20, D26). Builds the still and the loop for the share sheet, and the Save files: the gift
 * itself in its natural format (D26 table), never a page that wraps it in calendar layout. Exports carry no mark.
 * Nothing is uploaded: the user saves or shares the files themselves.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import type { CalendarService } from '../jobs/service.js';
import { mimeFor } from '../intake/mime.js';
import { scanText } from '../intake/secrets.js';
import { TOOL_DIR, toolFiles } from '../shared/tool.js';
import yazl from 'yazl';
import { captureLoop, capturePdf, captureStill, CaptureUnavailable, ffmpegPath, findInstalledChrome } from './capture.js';

/** Fixed caption for every network (D26). `share.caption` from gift.json is ignored. */
export const SHARE_CAPTION = 'My AI agent made this gift for me 🎁';
/** The one link used by every share hand-off (D26). */
export const SHARE_URL = 'https://deskmenace.com';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export class ShareError extends Error {
  constructor(public readonly code: string, message: string) { super(message); }
}

export interface ShareOptions { blur?: boolean }

function context(service: CalendarService, day: number) {
  const revealed = service.gift(day);
  const dir = service.store.home.giftDir(revealed.season, day);
  const m = revealed.gift.manifest;
  const entry = m.primary && /\.html?$/i.test(m.primary) ? m.primary : undefined;
  const cacheDir = join(service.store.home.doorDir(revealed.season, day), 'share-cache');
  const giftUrl = (rel: string) => `http://127.0.0.1:${service.giftPort}/g/${service.giftToken(revealed.season, day)}/${rel.split('/').map(encodeURIComponent).join('/')}`;
  return { revealed, dir, m, entry, cacheDir, giftUrl, url: entry ? giftUrl(entry) : undefined };
}

function slugOf(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'gift';
}

export function shareInfo(service: CalendarService, day: number) {
  const { revealed, m, entry } = context(service, day);
  const browser = Boolean(findInstalledChrome());
  const share = m.share;
  const loopFile = share && typeof share.loop === 'string' ? share.loop : undefined;
  const loopCapture = share && share.loop && typeof share.loop !== 'string' ? share.loop.durationMs : undefined;
  return {
    title: m.title,
    caption: SHARE_CAPTION,
    url: SHARE_URL,
    privateText: share?.privateText ?? [],
    kind: revealed.gift.kind,
    browser,
    ffmpeg: Boolean(ffmpegPath()),
    still: browser ? 'capture' : share && typeof share.still === 'string' ? 'file' : revealed.gift.kind === 'image' ? 'file' : 'unavailable',
    loop: loopCapture && browser && entry ? 'capture' : loopFile ? 'file' : 'none',
    loopDurationMs: loopCapture,
  };
}

function cached(cacheDir: string, name: string, make: () => Promise<Buffer>): Promise<Buffer> {
  const file = join(cacheDir, name);
  if (existsSync(file)) return Promise.resolve(readFileSync(file));
  return make().then((data) => {
    mkdirSync(cacheDir, { recursive: true });
    writeFileSync(file, data);
    return data;
  });
}

/** 1080×1350 still of the gift only. */
export async function shareStill(service: CalendarService, day: number, opts: ShareOptions = {}): Promise<{ data: Buffer; mime: string }> {
  const { revealed, dir, m, url, cacheDir } = context(service, day);
  const privateText = m.share?.privateText ?? [];
  if (findInstalledChrome()) {
    try {
      const html = url ? undefined : captureHtml(service, day);
      const data = await cached(cacheDir, `still-${opts.blur ? 'blur' : 'plain'}.png`, () => captureStill({ url, html, blur: Boolean(opts.blur), privateText, allowedOrigins: revealed.gift.networkConsent }));
      return { data, mime: 'image/png' };
    } catch (e) {
      if (!(e instanceof CaptureUnavailable)) console.error('share capture failed:', (e as Error).message);
    }
  }
  const file = m.share && typeof m.share.still === 'string' ? m.share.still : revealed.gift.kind === 'image' && m.primary ? m.primary : undefined;
  if (!file) throw new ShareError('no_still', 'This computer has no Chrome or Edge to capture the gift, and the gift has no share image.');
  return { data: readFileSync(join(dir, ...file.split('/'))), mime: mimeFor(file) };
}

/** 3–10 s loop. MP4 or GIF with ffmpeg, otherwise WebM. Agent-provided loops are returned as they are. */
export async function shareLoop(service: CalendarService, day: number, opts: ShareOptions & { format?: 'mp4' | 'gif' | 'webm' } = {}): Promise<{ data: Buffer; mime: string; ext: string }> {
  const { revealed, dir, m, url, cacheDir } = context(service, day);
  const loop = m.share?.loop;
  if (!loop) throw new ShareError('no_loop', 'This gift has no loop.');
  if (typeof loop !== 'string' && url && findInstalledChrome()) {
    const format = opts.format ?? (ffmpegPath() ? 'mp4' : 'webm');
    const key = `loop-${opts.blur ? 'blur' : 'plain'}`;
    const existing = existsSync(cacheDir) ? readdirSync(cacheDir).find((f) => f.startsWith(key + '.') && f.endsWith(`.${format}`)) : undefined;
    if (existing) return { data: readFileSync(join(cacheDir, existing)), mime: mimeFor(existing), ext: format };
    const r = await captureLoop({ url, blur: Boolean(opts.blur), privateText: m.share?.privateText ?? [], durationMs: loop.durationMs, format, allowedOrigins: revealed.gift.networkConsent });
    mkdirSync(cacheDir, { recursive: true });
    writeFileSync(join(cacheDir, `${key}.${r.format}`), r.data);
    return { data: r.data, mime: r.mime, ext: r.format };
  }
  if (typeof loop === 'string') {
    return { data: readFileSync(join(dir, ...loop.split('/'))), mime: mimeFor(loop), ext: loop.split('.').pop() ?? 'webm' };
  }
  throw new ShareError('no_capture', 'Recording the loop needs Chrome or Edge on this computer.');
}

/** A page holding only the gift's main element, on a plain background: the capture source for non-HTML gifts. */
function captureHtml(service: CalendarService, day: number): string {
  const { revealed, dir, m } = context(service, day);
  const kind = revealed.gift.kind;
  const p = m.primary;
  const mime = p ? mimeFor(p) : '';
  const dataUri = (rel: string) => `data:${mimeFor(rel)};base64,${readFileSync(join(dir, ...rel.split('/'))).toString('base64')}`;
  let body = '';
  if (p && mime.startsWith('image/')) body = `<img src="${dataUri(p)}" alt="" style="max-width:100%;max-height:100vh;display:block;margin:auto">`;
  else if (p && (mime === 'text/plain' || mime === 'text/markdown')) body = `<pre style="white-space:pre-wrap;font:28px/1.6 Georgia,serif;margin:0;padding:80px">${esc(readFileSync(join(dir, ...p.split('/')), 'utf8'))}</pre>`;
  else if (kind === 'real-world' && m.realWorld) body = referenceBody(m.realWorld.items);
  else if (kind === 'link' && m.links?.length) body = `<ul style="font:28px/1.8 Georgia,serif">${m.links.map((l) => `<li>${esc(l.label)}</li>`).join('')}</ul>`;
  else body = `<div style="font:40px Georgia,serif;text-align:center;padding:200px 40px">${esc(m.title)}</div>`;
  return `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#fff;color:#222">${body}</body></html>`;
}

function referenceBody(items: NonNullable<ReturnType<typeof context>['m']['realWorld']>['items']): string {
  return `<ul style="list-style:none;padding:0;margin:0;font:18px/1.6 Georgia,serif">${items.map((i) => `<li style="padding:16px 0;border-bottom:1px solid #ddd"><strong>${esc(i.name)}</strong><br>${esc(i.vendor)}${i.price !== undefined ? ` · ${i.price} ${esc(i.currency ?? '')}` : ''}${i.notes ? `<br>${esc(i.notes)}` : ''}<br><a href="${esc(i.url)}">${esc(i.url)}</a></li>`).join('')}</ul>`;
}

// ---------------------------------------------------------------------------------------------------
// Save (D26): the gift in its natural format.

export interface SaveOption { id: string; label: string; format: string }
export interface SaveFile { data: Buffer; mime: string; filename: string }

const LABEL_BY_MIME: Array<[RegExp, string]> = [[/^image\//, 'Image'], [/^video\//, 'Video'], [/^audio\//, 'Audio'], [/pdf$/, 'PDF'], [/html/, 'The gift'], [/^text\//, 'Text']];
const labelFor = (mime: string) => LABEL_BY_MIME.find(([re]) => re.test(mime))?.[1] ?? 'The gift';
const extOf = (path: string) => (path.split('.').pop() ?? '').toUpperCase();

function hasFile(revealed: ReturnType<typeof context>['revealed'], path?: string): path is string {
  return Boolean(path && revealed.gift.files.some((f) => f.path === path));
}

function readLyrics(dir: string, scorePath: string): string | undefined {
  try {
    const score = JSON.parse(readFileSync(join(dir, ...scorePath.split('/')), 'utf8')) as { lyrics?: Array<{ text: string }>; tracks?: Array<{ lyrics?: Array<{ text: string }> }> };
    const lines = score.lyrics ?? score.tracks?.flatMap((t) => t.lyrics ?? []) ?? [];
    const text = lines.map((l) => l.text).join('\n').trim();
    return text || undefined;
  } catch {
    return undefined;
  }
}

/** The Save menu: the gift's primary file first, then motion, lyrics, and the agent's own downloads and print files. */
export function saveOptions(service: CalendarService, day: number): SaveOption[] {
  const { revealed, dir, m, entry } = context(service, day);
  const kind = revealed.gift.kind;
  const out: SaveOption[] = [];
  const p = m.primary;
  const pMime = p ? mimeFor(p) : '';
  const tool = toolFiles(m, revealed.gift.files.map((f) => f.path));
  if (tool.length > 0) out.push({ id: 'gift', label: 'The tool', format: 'ZIP' });
  else if (m.save && hasFile(revealed, m.save.file)) out.push({ id: 'gift', label: labelFor(m.save.type), format: extOf(m.save.file) });
  else if (entry && (kind === 'interactive-html' || kind === 'card')) out.push({ id: 'gift', label: 'The gift', format: 'HTML' });
  else if (kind === 'document' && p && /html?$/i.test(p)) out.push({ id: 'gift', label: 'PDF', format: findInstalledChrome() ? 'PDF' : 'HTML' });
  else if ((kind === 'document' || kind === 'card') && p && (pMime === 'text/plain' || pMime === 'text/markdown')) out.push({ id: 'gift', label: 'Text', format: 'TXT' });
  else if (kind === 'song' && m.song?.wav) out.push({ id: 'gift', label: 'Audio', format: extOf(m.song.wav) });
  else if (kind === 'real-world' && m.realWorld) out.push({ id: 'gift', label: 'Reference', format: 'HTML' });
  else if (kind === 'link' && m.links?.length) out.push({ id: 'gift', label: 'Links', format: 'HTML' });
  else if (hasFile(revealed, p)) out.push({ id: 'gift', label: labelFor(pMime), format: extOf(p) });
  if (kind === 'song' && m.song && readLyrics(dir, m.song.score)) out.push({ id: 'lyrics', label: 'Lyrics', format: 'TXT' });
  if (m.share?.loop && (typeof m.share.loop === 'string' || (entry && findInstalledChrome()))) {
    const mp4 = Boolean(ffmpegPath());
    out.push({ id: 'video', label: 'Video', format: typeof m.share.loop === 'string' ? extOf(m.share.loop) : mp4 ? 'MP4' : 'WEBM' });
    if (mp4 && typeof m.share.loop !== 'string') out.push({ id: 'gif', label: 'GIF', format: 'GIF' });
  }
  const seen = new Set([...(tool.length ? tool : [m.save?.file, p]), m.song?.wav].filter((x): x is string => Boolean(x)));
  const extra = (label: string, file: string) => { if (!seen.has(file) && hasFile(revealed, file)) { seen.add(file); out.push({ id: `file:${file}`, label, format: extOf(file) }); } };
  // A tool's screenshot (or its own save file) comes after the zip.
  if (tool.length) { if (m.save) extra(labelFor(m.save.type), m.save.file); if (p && /^image\//.test(pMime)) extra(labelFor(pMime), p); }
  for (const d of m.downloads) extra(d.label, d.file);
  for (const pr of m.print) if (pr.file) extra(pr.product ?? pr.service, pr.file);
  for (const a of m.artifacts) if (a.role === 'download' || a.role === 'print') extra(a.title ?? posix.basename(a.path), a.path);
  return out;
}

export async function saveFile(service: CalendarService, day: number, id: string): Promise<SaveFile> {
  const { revealed, dir, m, entry, giftUrl } = context(service, day);
  if (!saveOptions(service, day).some((o) => o.id === id)) throw new ShareError('no_such_save', 'This gift has no such file.');
  const slug = `advent-day-${day}-${slugOf(m.title)}`;
  const raw = (path: string): SaveFile => ({ data: readFileSync(join(dir, ...path.split('/'))), mime: mimeFor(path), filename: `${slug}.${path.split('.').pop()}` });
  if (id.startsWith('file:')) { const f = id.slice(5); const r = raw(f); return { ...r, filename: posix.basename(f) }; }
  if (id === 'lyrics') return { data: Buffer.from(readLyrics(dir, m.song!.score)! + '\n', 'utf8'), mime: 'text/plain; charset=utf-8', filename: `${slug}-lyrics.txt` };
  if (id === 'video' || id === 'gif') {
    const r = await shareLoop(service, day, { format: id === 'gif' ? 'gif' : undefined });
    return { data: r.data, mime: r.mime, filename: `${slug}.${r.ext}` };
  }
  // id === 'gift'
  const kind = revealed.gift.kind;
  const p = m.primary;
  const tool = toolFiles(m, revealed.gift.files.map((f) => f.path));
  if (tool.length > 0) return { data: await zipTool(dir, tool, slugOf(m.title)), mime: 'application/zip', filename: `${slug}.zip` };
  if (m.save && hasFile(revealed, m.save.file)) return raw(m.save.file);
  if (entry && (kind === 'interactive-html' || kind === 'card')) {
    const html = inlineAssets(dir, entry, revealed.gift.files.map((f) => f.path));
    guardPrivate(service, html);
    return { data: Buffer.from(html, 'utf8'), mime: 'text/html; charset=utf-8', filename: `${slug}.html` };
  }
  if (kind === 'document' && p && /html?$/i.test(p)) {
    if (findInstalledChrome()) {
      try { return { data: await capturePdf({ url: giftUrl(p), allowedOrigins: revealed.gift.networkConsent }), mime: 'application/pdf', filename: `${slug}.pdf` }; } catch (e) { console.error('pdf capture failed:', (e as Error).message); }
    }
    return { data: Buffer.from(inlineAssets(dir, p, revealed.gift.files.map((f) => f.path)), 'utf8'), mime: 'text/html; charset=utf-8', filename: `${slug}.html` };
  }
  if ((kind === 'document' || kind === 'card') && p && /\.(txt|md|markdown)$/i.test(p)) return { ...raw(p), mime: 'text/plain; charset=utf-8', filename: `${slug}.txt` };
  if (kind === 'song' && m.song?.wav) return raw(m.song.wav);
  if (kind === 'real-world' && m.realWorld) return { data: Buffer.from(plainPage(m.title, referenceBody(m.realWorld.items)), 'utf8'), mime: 'text/html; charset=utf-8', filename: `${slug}.html` };
  if (kind === 'link' && m.links?.length) return { data: Buffer.from(plainPage(m.title, `<ul style="font:18px/1.8 Georgia,serif">${m.links.map((l) => `<li><a href="${esc(l.url)}">${esc(l.label)}</a></li>`).join('')}</ul>`), 'utf8'), mime: 'text/html; charset=utf-8', filename: `${slug}.html` };
  if (p) return raw(p);
  throw new ShareError('no_such_save', 'This gift has no file to save.');
}

/** The tool's files in one folder, scripts kept executable. Nothing from the calendar is added. */
function zipTool(dir: string, paths: string[], folder: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const zip = new yazl.ZipFile();
    for (const rel of paths) {
      const name = `${folder || 'tool'}/${rel.slice(TOOL_DIR.length)}`;
      const exec = /\.(sh|bash|zsh|command|py|rb|pl)$/i.test(rel) || /^(install|uninstall)$/i.test(posix.basename(rel));
      zip.addBuffer(readFileSync(join(dir, ...rel.split('/'))), name, { mode: exec ? 0o100755 : 0o100644, mtime: new Date('2020-01-01T00:00:00Z') });
    }
    const chunks: Buffer[] = [];
    zip.outputStream.on('data', (c: Buffer) => chunks.push(c)).on('end', () => resolve(Buffer.concat(chunks))).on('error', reject);
    zip.end();
  });
}

/** A bare page: the agent's title as the document title, the agent's content, no calendar text. */
function plainPage(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head><body style="margin:0 auto;max-width:720px;padding:32px 20px;color:#222;background:#fff">${body}</body></html>`;
}

function guardPrivate(service: CalendarService, text: string): void {
  const hits = scanText(text, { apiToken: service.store.apiToken() });
  if (hits.some((h) => h.kind !== 'home_path')) throw new ShareError('private', 'The gift contains something that looks private; the export was stopped.');
}

/**
 * The gift's own HTML with its local assets inlined (scripts, stylesheets, images, fonts, audio) so the file opens and
 * plays on its own. References to files outside the sealed gift, and remote URLs, are left untouched.
 */
export function inlineAssets(dir: string, entry: string, files: string[]): string {
  const known = new Set(files);
  const base = posix.dirname(entry);
  const resolve = (from: string, ref: string): string | undefined => {
    if (/^(?:[a-z]+:|\/\/|#|\/)/i.test(ref)) return undefined;
    const clean = decodeURIComponent(ref.split(/[?#]/)[0]!);
    const rel = posix.normalize(posix.join(from === '.' ? '' : from, clean));
    return known.has(rel) && !rel.startsWith('.advent/') ? rel : undefined;
  };
  const read = (rel: string) => readFileSync(join(dir, ...rel.split('/')));
  const dataUri = (rel: string) => `data:${mimeFor(rel)};base64,${read(rel).toString('base64')}`;
  const inlineCss = (css: string, from: string) => css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (all, q: string, ref: string) => { const r = resolve(from, ref); return r ? `url(${q}${dataUri(r)}${q})` : all; });
  let html = read(entry).toString('utf8');
  html = html.replace(/<link\b[^>]*rel=["']?stylesheet["']?[^>]*>/gi, (tag) => {
    const href = tag.match(/href=["']([^"']+)["']/i)?.[1];
    const r = href ? resolve(base, href) : undefined;
    return r ? `<style>${inlineCss(read(r).toString('utf8'), posix.dirname(r))}</style>` : tag;
  });
  html = html.replace(/<script\b([^>]*)\bsrc=["']([^"']+)["']([^>]*)>\s*<\/script>/gi, (tag, a: string, src: string, b: string) => {
    const r = resolve(base, src);
    return r ? `<script${a}${b}>${read(r).toString('utf8').replace(/<\/script/gi, '<\\/script')}</script>` : tag;
  });
  html = html.replace(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi, (_t, attrs: string, css: string) => `<style${attrs}>${inlineCss(css, base)}</style>`);
  html = html.replace(/\b(src|href|poster)=(["'])([^"']+)\2/gi, (all, attr: string, q: string, ref: string) => {
    const r = resolve(base, ref);
    return r && !/\.html?$/i.test(r) ? `${attr}=${q}${dataUri(r)}${q}` : all;
  });
  return html;
}
