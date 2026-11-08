/**
 * Share capture (D20, D21): open a revealed gift in the user's installed Chrome or Edge (headless, puppeteer-core,
 * no browser download), call window.adventCapture.prepare(kind), apply the privacy blur and the share mark, then
 * take a 1080×1350 still or record a 1080×1920 loop. Fallbacks are the agent's share.png / share.webm.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

export const SHARE_MARK_TEXT = 'Made by my Advent Agent · more gifts at deskmenace.com';
export const SHARE_MARK_URL = 'https://deskmenace.com/advent?ref=aa-share';
export const REPO_URL = 'https://github.com/suchipizza/Advent-Agent';
export const STILL_SIZE = { width: 1080, height: 1350 };
export const LOOP_SIZE = { width: 1080, height: 1920 };

const GITHUB_SVG = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>';

/** HTML for the mark (bottom-right, small, quiet). Used in captures and standalone exports. */
export function shareMarkHtml(scale = 1): string {
  const fs = Math.round(12 * scale);
  return `<div data-advent-mark style="position:fixed;right:${Math.round(12 * scale)}px;bottom:${Math.round(12 * scale)}px;z-index:2147483647;display:flex;align-items:center;gap:${Math.round(8 * scale)}px;font:600 ${fs}px/1.2 -apple-system,Segoe UI,Arial,sans-serif;color:#3b4a43;background:rgba(255,250,240,.88);border:1px solid rgba(36,58,50,.18);border-radius:${Math.round(14 * scale)}px;padding:${Math.round(5 * scale)}px ${Math.round(10 * scale)}px;box-shadow:0 2px 8px rgba(0,0,0,.08);pointer-events:auto"><a href="${SHARE_MARK_URL}" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:none">${SHARE_MARK_TEXT}</a><a href="${REPO_URL}" target="_blank" rel="noopener noreferrer" aria-label="Advent Agent on GitHub" style="color:inherit;display:inline-flex">${GITHUB_SVG.replace('width="14" height="14"', `width="${fs + 2}" height="${fs + 2}"`)}</a></div>`;
}

/**
 * In-page script (as a string so it can be injected into standalone files too): blurs elements marked
 * data-advent-private and every text occurrence of the given strings.
 */
export function blurScript(privateText: string[]): string {
  return `(function(){var words=${JSON.stringify(privateText.filter(Boolean))};var st=document.createElement('style');st.textContent='[data-advent-private]{filter:blur(9px)!important}.advent-blur{filter:blur(7px);display:inline-block}';document.head&&document.head.appendChild(st);if(!words.length)return;var w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,null);var nodes=[];while(w.nextNode())nodes.push(w.currentNode);nodes.forEach(function(n){var t=n.nodeValue;var hit=words.some(function(x){return t.indexOf(x)>=0});if(!hit||!n.parentNode||/^(SCRIPT|STYLE)$/.test(n.parentNode.nodeName))return;var frag=document.createDocumentFragment();var re=new RegExp('('+words.map(function(x){return x.replace(/[.*+?^\${}()|[\\]\\\\]/g,'\\\\$&')}).join('|')+')','g');t.split(re).forEach(function(part){if(!part)return;if(words.indexOf(part)>=0){var s=document.createElement('span');s.className='advent-blur';s.textContent=part;frag.appendChild(s)}else frag.appendChild(document.createTextNode(part))});n.parentNode.replaceChild(frag,n)})})();`;
}

/** The user's installed Chrome or Edge (D20), or the browser they opted into for the gift test drive. */
export function findInstalledChrome(): string | undefined {
  const env = process.env.ADVENT_AGENT_BROWSER;
  if (env && existsSync(env)) return env;
  const local = process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local');
  const candidates = process.platform === 'darwin'
    ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', join(homedir(), 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome'), '/Applications/Chromium.app/Contents/MacOS/Chromium']
    : process.platform === 'win32'
      ? ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', join(local, 'Google\\Chrome\\Application\\chrome.exe'), 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe']
      : ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/microsoft-edge', '/usr/bin/microsoft-edge-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium'];
  for (const c of candidates) if (existsSync(c)) return c;
  // Opt-in test-drive browser (Playwright cache), if the user installed it.
  const cache = process.platform === 'darwin' ? join(homedir(), 'Library', 'Caches', 'ms-playwright') : process.platform === 'win32' ? join(local, 'ms-playwright') : join(homedir(), '.cache', 'ms-playwright');
  if (existsSync(cache)) {
    for (const d of readdirSync(cache).filter((x) => /^chromium(_headless_shell)?-\d+$/.test(x)).sort().reverse()) {
      for (const plat of readdirSync(join(cache, d))) {
        for (const n of ['chrome-headless-shell', 'chrome-headless-shell.exe', 'chrome', 'chrome.exe', 'Chromium.app/Contents/MacOS/Chromium', 'Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing']) if (existsSync(join(cache, d, plat, n))) return join(cache, d, plat, n);
      }
    }
  }
  return undefined;
}

export function ffmpegPath(): string | undefined {
  for (const c of process.platform === 'win32' ? ['ffmpeg.exe', 'ffmpeg'] : ['ffmpeg']) {
    const r = spawnSync(c, ['-version'], { encoding: 'utf8', shell: false, timeout: 5000 });
    if (r.status === 0) return c;
  }
  return undefined;
}

export interface CaptureOptions {
  /** Page to open (the gift's entry on the gift origin)… */
  url?: string;
  /** …or an HTML document to load directly (self-contained wrappers for non-HTML gifts). */
  html?: string;
  blur: boolean;
  privateText: string[];
  mark: boolean;
  /** Extra origins the page may reach (consented network). Everything else is blocked. */
  allowedOrigins?: string[];
}

type Browser = import('puppeteer-core').Browser;
type Page = import('puppeteer-core').Page;

async function withPage<T>(size: { width: number; height: number }, opts: CaptureOptions, kind: 'still' | 'loop', fn: (page: Page) => Promise<T>): Promise<T> {
  const executablePath = findInstalledChrome();
  if (!executablePath) throw new CaptureUnavailable('No installed Chrome or Edge was found for capturing.');
  const puppeteer = (await import('puppeteer-core')).default;
  const browser: Browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-first-run', '--no-default-browser-check', '--mute-audio', '--hide-scrollbars', '--disable-extensions'], defaultViewport: { ...size, deviceScaleFactor: 1 }, timeout: 30_000 });
  try {
    const page = await browser.newPage();
    const allowed = [...(opts.url ? [new URL(opts.url).origin] : []), ...(opts.allowedOrigins ?? [])];
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const u = req.url();
      if (u.startsWith('data:') || u.startsWith('blob:') || allowed.some((o) => u.startsWith(o))) void req.continue();
      else void req.abort();
    });
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
    if (opts.url) await page.goto(opts.url, { waitUntil: 'load', timeout: 30_000 });
    else await page.setContent(opts.html ?? '<!doctype html><html><body></body></html>', { waitUntil: 'load', timeout: 30_000 });
    await page.evaluate(async (k: string) => {
      const w = window as unknown as { adventCapture?: { prepare?: (k: string) => unknown } };
      if (w.adventCapture?.prepare) await Promise.race([Promise.resolve(w.adventCapture.prepare(k)), new Promise((r) => setTimeout(r, 8000))]);
    }, kind);
    if (opts.blur) await page.evaluate(blurScript(opts.privateText));
    if (opts.mark) await page.evaluate((html: string) => { const d = document.createElement('div'); d.innerHTML = html; document.body.appendChild(d.firstElementChild!); }, shareMarkHtml(size.width / 860));
    await new Promise((r) => setTimeout(r, 350));
    return await fn(page);
  } finally {
    await browser.close().catch(() => undefined);
  }
}

export class CaptureUnavailable extends Error {}

export async function captureStill(opts: CaptureOptions): Promise<Buffer> {
  return withPage(STILL_SIZE, opts, 'still', async (page) => Buffer.from(await page.screenshot({ type: 'png' })));
}

export interface LoopResult { data: Buffer; format: 'mp4' | 'gif' | 'webm'; mime: string }

/** Records the page for durationMs via the DevTools screencast, normalises to a constant frame rate, encodes. */
export async function captureLoop(opts: CaptureOptions & { durationMs: number; format?: 'mp4' | 'gif' | 'webm' }): Promise<LoopResult> {
  const fps = 15;
  return withPage(LOOP_SIZE, opts, 'loop', async (page) => {
    const client = await page.createCDPSession();
    const frames: Array<{ data: string; t: number }> = [];
    let t0: number | undefined;
    client.on('Page.screencastFrame', (ev: { data: string; sessionId: number; metadata: { timestamp?: number } }) => {
      const ts = ev.metadata.timestamp ?? Date.now() / 1000;
      if (t0 === undefined) t0 = ts;
      frames.push({ data: ev.data, t: ts - t0 });
      void client.send('Page.screencastFrameAck', { sessionId: ev.sessionId }).catch(() => undefined);
    });
    await client.send('Page.startScreencast', { format: 'jpeg', quality: 85, maxWidth: LOOP_SIZE.width, maxHeight: LOOP_SIZE.height, everyNthFrame: 1 });
    await new Promise((r) => setTimeout(r, opts.durationMs));
    await client.send('Page.stopScreencast');
    if (frames.length === 0) frames.push({ data: (await page.screenshot({ type: 'jpeg', encoding: 'base64' })) as string, t: 0 });
    // Constant frame rate: each output frame shows the latest captured frame at that time.
    const total = Math.max(1, Math.round((opts.durationMs / 1000) * fps));
    const seq: string[] = [];
    let j = 0;
    for (let i = 0; i < total; i++) {
      const t = i / fps;
      while (j + 1 < frames.length && frames[j + 1]!.t <= t) j++;
      seq.push(frames[j]!.data);
    }
    const want = opts.format ?? 'mp4';
    const ff = ffmpegPath();
    if (ff && want !== 'webm') return encodeWithFfmpeg(ff, seq, fps, want);
    return { data: await encodeWebmInBrowser(page, seq, fps), format: 'webm', mime: 'video/webm' };
  });
}

function encodeWithFfmpeg(ff: string, seq: string[], fps: number, format: 'mp4' | 'gif'): LoopResult {
  const dir = mkdtempSync(join(tmpdir(), 'aa-loop-'));
  try {
    mkdirSync(join(dir, 'f'), { recursive: true });
    seq.forEach((b64, i) => writeFileSync(join(dir, 'f', `${String(i).padStart(4, '0')}.jpg`), Buffer.from(b64, 'base64')));
    const out = join(dir, `loop.${format}`);
    const input = ['-y', '-v', 'error', '-framerate', String(fps), '-i', join(dir, 'f', '%04d.jpg')];
    const args = format === 'mp4'
      ? [...input, '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'veryfast', '-crf', '24', '-movflags', '+faststart', out]
      : [...input, '-vf', 'fps=12,scale=540:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=4', out];
    const r = spawnSync(ff, args, { encoding: 'utf8', shell: false, timeout: 120_000 });
    if (r.status !== 0 || !existsSync(out)) throw new Error(`ffmpeg failed: ${r.stderr?.split('\n')[0] ?? 'unknown error'}`);
    return { data: readFileSync(out), format, mime: format === 'mp4' ? 'video/mp4' : 'image/gif' };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Without ffmpeg: play the frames onto a canvas in the same headless browser and record it with MediaRecorder. */
async function encodeWebmInBrowser(page: Page, seq: string[], fps: number): Promise<Buffer> {
  await page.goto('about:blank');
  const b64 = await page.evaluate(async (frames: string[], rate: number, w: number, h: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    const imgs = await Promise.all(frames.map((f) => new Promise<HTMLImageElement>((res) => { const im = new Image(); im.onload = () => res(im); im.src = `data:image/jpeg;base64,${f}`; })));
    const stream = canvas.captureStream(rate);
    const rec = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm', videoBitsPerSecond: 4_000_000 });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    const done = new Promise<void>((r) => { rec.onstop = () => r(); });
    rec.start(200);
    for (const im of imgs) { ctx.drawImage(im, 0, 0, w, h); await new Promise((r) => setTimeout(r, 1000 / rate)); }
    rec.stop();
    await done;
    const buf = await new Blob(chunks, { type: 'video/webm' }).arrayBuffer();
    let s = ''; const u = new Uint8Array(buf);
    for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
    return btoa(s);
  }, seq, fps, LOOP_SIZE.width, LOOP_SIZE.height);
  return Buffer.from(b64, 'base64');
}

/** Stamp the mark onto an existing image (the agent's share.png) in the headless browser. */
export async function stampImage(png: Buffer, mime: string): Promise<Buffer> {
  const executablePath = findInstalledChrome();
  if (!executablePath) throw new CaptureUnavailable('No installed Chrome or Edge was found.');
  const puppeteer = (await import('puppeteer-core')).default;
  const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-first-run', '--mute-audio'], defaultViewport: { ...STILL_SIZE, deviceScaleFactor: 1 } });
  try {
    const page = await browser.newPage();
    const dataUrl = `data:${mime};base64,${png.toString('base64')}`;
    await page.setContent(`<!doctype html><html><body style="margin:0;background:#f7f2e9"><img src="${dataUrl}" style="display:block;width:${STILL_SIZE.width}px;height:${STILL_SIZE.height}px;object-fit:contain">${shareMarkHtml(STILL_SIZE.width / 860)}</body></html>`, { waitUntil: 'load' });
    return Buffer.from(await page.screenshot({ type: 'png' }));
  } finally {
    await browser.close().catch(() => undefined);
  }
}
