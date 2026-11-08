/**
 * Sharing = exporting (D20, D21, DESK_MENACE_INTEGRATION §2). Builds the still, the loop and the standalone file for a
 * revealed gift, always with the privacy options and the share mark (unless the user turned the mark off).
 * Nothing is uploaded: the user saves or shares the files themselves.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import yazl from 'yazl';
import type { CalendarService } from '../jobs/service.js';
import { mimeFor } from '../intake/mime.js';
import { scanText } from '../intake/secrets.js';
import { blurScript, captureLoop, captureStill, CaptureUnavailable, ffmpegPath, findInstalledChrome, shareMarkHtml, SHARE_MARK_TEXT, SHARE_MARK_URL, stampImage } from './capture.js';

export { SHARE_MARK_URL, SHARE_MARK_TEXT };

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export class ShareError extends Error {
  constructor(public readonly code: string, message: string) { super(message); }
}

export interface ShareOptions { blur?: boolean; includeNote?: boolean }

function context(service: CalendarService, day: number) {
  const revealed = service.gift(day);
  const dir = service.store.home.giftDir(revealed.season, day);
  const m = revealed.gift.manifest;
  const entry = m.primary && /\.html?$/i.test(m.primary) ? m.primary : undefined;
  const cacheDir = join(service.store.home.doorDir(revealed.season, day), 'share-cache');
  return { revealed, dir, m, entry, cacheDir, url: entry ? `http://127.0.0.1:${service.giftPort}/g/${service.giftToken(revealed.season, day)}/${entry.split('/').map(encodeURIComponent).join('/')}` : undefined };
}

export function shareInfo(service: CalendarService, day: number) {
  const { revealed, m, entry } = context(service, day);
  const browser = Boolean(findInstalledChrome());
  const share = m.share;
  const loopFile = share && typeof share.loop === 'string' ? share.loop : undefined;
  const loopCapture = share && share.loop && typeof share.loop !== 'string' ? share.loop.durationMs : undefined;
  return {
    title: m.title,
    subtitle: m.subtitle,
    category: m.category,
    note: m.note,
    caption: share?.caption ?? `My AI Secret Santa made me “${m.title}”`,
    privateText: share?.privateText ?? [],
    kind: revealed.gift.kind,
    shareMark: revealed.shareMark,
    browser,
    ffmpeg: Boolean(ffmpegPath()),
    still: browser ? 'capture' : share && typeof share.still === 'string' ? 'file' : revealed.gift.kind === 'image' ? 'file' : 'unavailable',
    loop: loopCapture && browser && entry ? 'capture' : loopFile ? 'file' : 'none',
    loopDurationMs: loopCapture,
    standalone: true,
    downloads: m.downloads,
    print: m.print,
    files: revealed.gift.files.filter((f) => !f.path.startsWith('.advent/')).map((f) => f.path),
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

/** 1080×1350 still. `stamped: false` means the client must add the mark (no browser on this machine). */
export async function shareStill(service: CalendarService, day: number, opts: ShareOptions = {}): Promise<{ data: Buffer; mime: string; stamped: boolean }> {
  const { revealed, dir, m, url, cacheDir } = context(service, day);
  const mark = revealed.shareMark;
  const privateText = m.share?.privateText ?? [];
  const browser = findInstalledChrome();
  if (browser) {
    try {
      const html = url ? undefined : await buildShareHtml(service, day, { stripNote: true, mark: false, blur: opts.blur });
      const data = await cached(cacheDir, `still-${opts.blur ? 'blur' : 'plain'}-${mark ? 'mark' : 'nomark'}.png`, () => captureStill({ url, html: html?.html, blur: Boolean(opts.blur), privateText, mark, allowedOrigins: revealed.gift.networkConsent }));
      return { data, mime: 'image/png', stamped: true };
    } catch (e) {
      if (!(e instanceof CaptureUnavailable)) console.error('share capture failed:', (e as Error).message);
    }
  }
  const file = m.share && typeof m.share.still === 'string' ? m.share.still : revealed.gift.kind === 'image' && m.primary ? m.primary : undefined;
  if (!file) throw new ShareError('no_still', 'This computer has no Chrome or Edge to capture the gift, and the gift has no share image.');
  const raw = readFileSync(join(dir, ...file.split('/')));
  if (browser && mark) {
    try { return { data: await stampImage(raw, mimeFor(file)), mime: 'image/png', stamped: true }; } catch { /* fall through */ }
  }
  return { data: raw, mime: mimeFor(file), stamped: !mark };
}

/** 3–10 s loop. MP4 or GIF with ffmpeg, otherwise WebM. Agent-provided loops are returned as they are. */
export async function shareLoop(service: CalendarService, day: number, opts: ShareOptions & { format?: 'mp4' | 'gif' | 'webm' } = {}): Promise<{ data: Buffer; mime: string; ext: string; stamped: boolean }> {
  const { revealed, dir, m, url, cacheDir } = context(service, day);
  const loop = m.share?.loop;
  if (!loop) throw new ShareError('no_loop', 'This gift has no share loop.');
  if (typeof loop !== 'string' && url && findInstalledChrome()) {
    const format = opts.format ?? (ffmpegPath() ? 'mp4' : 'webm');
    const key = `loop-${opts.blur ? 'blur' : 'plain'}-${revealed.shareMark ? 'mark' : 'nomark'}`;
    const existing = existsSync(cacheDir) ? readdirSync(cacheDir).find((f) => f.startsWith(key + '.') && f.endsWith(`.${format}`)) : undefined;
    if (existing) return { data: readFileSync(join(cacheDir, existing)), mime: mimeFor(existing), ext: format, stamped: true };
    const r = await captureLoop({ url, blur: Boolean(opts.blur), privateText: m.share?.privateText ?? [], mark: revealed.shareMark, durationMs: loop.durationMs, format, allowedOrigins: revealed.gift.networkConsent });
    mkdirSync(cacheDir, { recursive: true });
    writeFileSync(join(cacheDir, `${key}.${r.format}`), r.data);
    return { data: r.data, mime: r.mime, ext: r.format, stamped: true };
  }
  if (typeof loop === 'string') {
    const data = readFileSync(join(dir, ...loop.split('/')));
    return { data, mime: mimeFor(loop), ext: loop.split('.').pop() ?? 'webm', stamped: !revealed.shareMark };
  }
  throw new ShareError('no_capture', 'Recording the loop needs Chrome or Edge on this computer.');
}

/**
 * Standalone file. Interactive gifts: their own entry page with the mark (and blur/note) injected; a zip when the
 * gift has other files. Other kinds: a self-contained page with the media inlined.
 */
export async function shareStandalone(service: CalendarService, day: number, opts: ShareOptions = {}): Promise<{ data: Buffer; mime: string; filename: string }> {
  const { revealed, dir, m, entry } = context(service, day);
  const slug = m.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'gift';
  if (!entry) {
    const r = await buildShareHtml(service, day, { stripNote: !opts.includeNote, blur: opts.blur });
    return { data: Buffer.from(r.html, 'utf8'), mime: 'text/html; charset=utf-8', filename: r.filename };
  }
  const injection = [
    opts.blur ? `<script>document.addEventListener('DOMContentLoaded',function(){${blurScript(m.share?.privateText ?? [])}})</script>` : '',
    opts.includeNote ? `<details data-advent-note style="position:fixed;left:12px;bottom:12px;z-index:2147483646;max-width:min(420px,80vw);background:#fffaf0;border:1px solid #dfd7c9;border-radius:8px;padding:8px 12px;font:14px/1.5 Georgia,serif;color:#243a32"><summary style="cursor:pointer;font:600 12px Arial,sans-serif">A note from my Secret Santa</summary><p style="white-space:pre-wrap;margin:8px 0 0">${esc(m.note)}</p></details>` : '',
    revealed.shareMark ? shareMarkHtml(1) : '',
  ].join('');
  const html = readFileSync(join(dir, ...entry.split('/')), 'utf8');
  const patched = /<\/body>/i.test(html) ? html.replace(/<\/body>(?![\s\S]*<\/body>)/i, `${injection}</body>`) : html + injection;
  const hits = scanText(patched, { apiToken: service.store.apiToken() });
  if (hits.some((h) => h.kind !== 'home_path')) throw new ShareError('private', 'The gift contains something that looks private; export was stopped.');
  const others = revealed.gift.files.filter((f) => f.path !== entry && !f.path.startsWith('.advent/') && f.path !== 'gift.json');
  if (others.length === 0) return { data: Buffer.from(patched, 'utf8'), mime: 'text/html; charset=utf-8', filename: `advent-agent-day-${day}-${slug}.html` };
  const zip = new yazl.ZipFile();
  zip.addBuffer(Buffer.from(patched, 'utf8'), entry);
  for (const f of others) zip.addFile(join(dir, ...f.path.split('/')), f.path);
  zip.end();
  const chunks: Buffer[] = [];
  await new Promise<void>((res, rej) => { zip.outputStream.on('data', (c: Buffer) => chunks.push(c)).on('end', () => res()).on('error', rej); });
  return { data: Buffer.concat(chunks), mime: 'application/zip', filename: `advent-agent-day-${day}-${slug}.zip` };
}

/** Self-contained page for non-HTML gifts (also the capture source for their still). */
export async function buildShareHtml(service: CalendarService, day: number, opts: { stripNote?: boolean; mark?: boolean; blur?: boolean } = {}): Promise<{ html: string; filename: string }> {
  const revealed = service.gift(day);
  const { gift } = revealed;
  const dir = service.store.home.giftDir(revealed.season, day);
  const m = gift.manifest;
  const title = m.title;
  const note = opts.stripNote ? '' : m.note;
  const hits = scanText([title, note, m.subtitle ?? ''].join('\n'), { apiToken: service.store.apiToken() });
  if (hits.length) throw new ShareError('private', 'The text contains something that looks private; export was stopped.');

  let body = '';
  const primary = m.primary;
  const primaryMime = primary ? mimeFor(primary) : '';
  const dataUri = (rel: string) => `data:${mimeFor(rel)};base64,${readFileSync(join(dir, ...rel.split('/'))).toString('base64')}`;
  if (gift.kind === 'interactive-html' && primary) {
    const html = readFileSync(join(dir, ...primary.split('/')), 'utf8');
    body = `<iframe sandbox="allow-scripts allow-pointer-lock" title="${esc(title)}" srcdoc="${esc(html)}" style="width:100%;height:70vh;border:0;background:#fff"></iframe>`;
  } else if ((gift.kind === 'image' || (gift.kind === 'card' && primaryMime.startsWith('image/'))) && primary) {
    body = `<img src="${dataUri(primary)}" alt="${esc(m.artifacts.find((a) => a.path === primary)?.alt ?? title)}" style="max-width:100%;height:auto;display:block;margin:0 auto">`;
  } else if (gift.kind === 'audio' && primary) {
    body = `<audio controls preload="metadata" src="${dataUri(primary)}" style="width:100%"></audio>`;
  } else if (gift.kind === 'video' && primary) {
    body = `<video controls playsinline preload="metadata" src="${dataUri(primary)}" style="max-width:100%;display:block;margin:0 auto"></video>`;
  } else if ((gift.kind === 'document' || gift.kind === 'card') && primary && (primaryMime === 'text/plain' || primaryMime === 'text/markdown')) {
    body = `<pre style="white-space:pre-wrap;font:17px/1.8 Georgia,serif;background:#fffaf1;padding:32px;border:1px solid #e5d2b5;margin:0">${esc(readFileSync(join(dir, ...primary.split('/')), 'utf8'))}</pre>`;
  } else if (gift.kind === 'song' && m.song) {
    const sheet = m.song.renderSheet ? readFileSync(join(dir, ...m.song.renderSheet.split('/')), 'utf8') : '';
    body = `${m.song.wav ? `<audio controls preload="metadata" src="${dataUri(m.song.wav)}" style="width:100%"></audio>` : ''}<pre style="white-space:pre-wrap;font:15px/1.7 Georgia,serif;background:#fffaf1;padding:24px;border:1px solid #e5d2b5">${esc(sheet)}</pre>`;
  } else if (gift.kind === 'real-world' && m.realWorld) {
    body = `<ul style="list-style:none;padding:0">${m.realWorld.items.map((i) => `<li style="padding:14px 0;border-bottom:1px solid #e5d2b5"><strong>${esc(i.name)}</strong> · ${esc(i.vendor)}${i.price !== undefined ? ` · ${i.price} ${esc(i.currency ?? '')}` : ''} <small>(price checked ${esc(i.checkedAt)})</small><br><a href="${esc(i.url)}" rel="noopener noreferrer" target="_blank">${esc(i.url)}</a>${i.notes ? `<br><em>${esc(i.notes)}</em>` : ''}</li>`).join('')}</ul><p><strong>What's left for you:</strong> ${esc(m.realWorld.whatsLeft)}</p><p><small>Prepared by an AI agent. Buying or booking is yours to decide.</small></p>`;
  } else if (gift.kind === 'link' && m.links?.length) {
    body = `<ul>${m.links.map((l) => `<li><a href="${esc(l.url)}" rel="noopener noreferrer" target="_blank">${esc(l.label)}</a></li>`).join('')}</ul>`;
  } else {
    body = `<p>This gift is a ${esc(gift.kind)} that cannot be embedded in a single page. The files travel with the calendar export.</p>`;
  }
  const withMark = (opts.mark ?? true) && revealed.shareMark;
  const blur = opts.blur ? `<script>${blurScript(m.share?.privateText ?? [])}</script>` : '';
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<style>body{margin:0;background:#f7f2e9;color:#243a32;font-family:Arial,Helvetica,sans-serif}main{max-width:960px;margin:0 auto;padding:32px 20px 80px}.eyebrow{color:#a82438;font-size:11px;letter-spacing:.2em;text-transform:uppercase;font-weight:800;text-align:center}h1{font:400 clamp(36px,6vw,64px)/1.07 Georgia,serif;color:#0d3829;text-align:center;letter-spacing:-.04em;margin:12px 0 28px}.art{background:#ede0c9;border:12px solid #fffaf3;box-shadow:0 16px 45px #4739271b;padding:16px}.note{margin:28px auto 0;max-width:640px;padding:23px 22px;background:#f5ecdc;border-left:2px solid #cfa765;font:italic 17px/1.7 Georgia,serif;color:#53674c}.note span{display:block;font:800 10px Arial;letter-spacing:.12em;text-transform:uppercase;color:#6b5a3d;margin-top:16px}</style></head>
<body><main><div class="eyebrow">December ${day}${m.category ? ` / ${esc(m.category)}` : ''}</div><h1>${esc(title)}</h1>${m.subtitle ? `<p style="text-align:center;color:#5a5449">${esc(m.subtitle)}</p>` : ''}<div class="art">${body}</div>${note ? `<div class="note">${esc(note).replace(/\n/g, '<br>')}<span>— my advent gift-maker</span></div>` : ''}</main>${withMark ? shareMarkHtml(1) : ''}${blur}</body></html>`;
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'gift';
  return { html, filename: `advent-agent-day-${day}-${slug}.html` };
}
