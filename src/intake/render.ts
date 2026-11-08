/**
 * Headless render check (ARCHITECTURE §7 step 4). Uses playwright-core with a browser that is already
 * on the machine: the Playwright-managed Chromium (installed by "enable gift test drive") or a system Chrome/Edge.
 * Nothing is downloaded here. When no browser is available the step is skipped and recorded as such.
 */
import { existsSync, readFileSync, readdirSync as fsReaddir } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { join } from 'node:path';
import { mimeFor } from './mime.js';
import { giftOriginHeaders } from "./headers.js";

export interface RenderResult {
  status: 'passed' | 'failed' | 'skipped';
  notes: string[];
  /** PNG bytes of a private screenshot (shelf thumbnail). */
  screenshot?: Buffer;
  browser?: string;
}

export interface BrowserChoice {
  executablePath?: string;
  channel?: string;
  label: string;
}

/** Pick a browser without downloading anything. */
export async function findBrowser(): Promise<BrowserChoice | undefined> {
  const envPath = process.env.ADVENT_AGENT_BROWSER;
  if (envPath && existsSync(envPath)) return { executablePath: envPath, label: `custom (${envPath})` };
  try {
    const { chromium } = await import('playwright-core');
    const managed = chromium.executablePath();
    if (managed && existsSync(managed)) return { executablePath: managed, label: 'Playwright Chromium' };
    const shell = findHeadlessShell(managed);
    if (shell) return { executablePath: shell, label: 'Playwright chromium-headless-shell' };
  } catch { /* playwright-core unavailable */ }
  const systemCandidates: Array<{ channel: string; paths: string[] }> = [
    { channel: 'chrome', paths: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'] },
    { channel: 'msedge', paths: ['/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', '/usr/bin/microsoft-edge', 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'] },
  ];
  for (const c of systemCandidates) {
    const found = c.paths.find((pth) => existsSync(pth));
    if (found) return { channel: c.channel, label: `system ${c.channel}` };
  }
  return undefined;
}

/** Playwright keeps the headless shell beside the full Chromium: <cache>/chromium_headless_shell-<rev>/<platform>/chrome-headless-shell(.exe). */
function findHeadlessShell(managedChromiumPath: string | undefined): string | undefined {
  if (!managedChromiumPath) return undefined;
  const m = managedChromiumPath.match(/^(.*)[\\/]chromium-\d+[\\/]/);
  if (!m) return undefined;
  const cache = m[1]!;
  if (!existsSync(cache)) return undefined;
  const { readdirSync } = require_fs();
  const dirs = readdirSync(cache).filter((d: string) => /^chromium_headless_shell-\d+$/.test(d)).sort().reverse();
  for (const d of dirs) {
    const base = join(cache, d);
    for (const plat of readdirSync(base)) {
      for (const name of ['chrome-headless-shell', 'chrome-headless-shell.exe']) {
        const candidate = join(base, plat, name);
        if (existsSync(candidate)) return candidate;
      }
    }
  }
  return undefined;
}
function require_fs() { return { readdirSync: (p: string) => fsReaddir(p) }; }

/** Serve a quarantine folder on an ephemeral localhost port with the gift-origin headers. */
export function serveFolder(root: string): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  return new Promise((resolve, reject) => {
    const server: Server = createServer((req, res) => {
      try {
        const url = new URL(req.url ?? '/', 'http://127.0.0.1');
        const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
        if (rel.split('/').some((s) => s === '..')) { res.writeHead(400).end(); return; }
        const file = join(root, ...rel.split('/'));
        if (!existsSync(file)) { res.writeHead(404).end(); return; }
        const data = readFileSync(file);
        res.writeHead(200, { 'content-type': mimeFor(file), 'content-length': data.length, ...giftOriginHeaders('*') });
        res.end(data);
      } catch {
        res.writeHead(500).end();
      }
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') { reject(new Error('no address')); return; }
      resolve({ baseUrl: `http://127.0.0.1:${addr.port}`, close: () => new Promise((r) => server.close(() => r())) });
    });
    server.on('error', reject);
  });
}

export interface RenderOptions {
  primaryPath: string;
  timeoutMs?: number;
  /** For thumbnails of non-interactive kinds the caller may pass an HTML wrapper path instead. */
  viewport?: { width: number; height: number };
}

export async function renderCheck(root: string, opts: RenderOptions): Promise<RenderResult> {
  const choice = await findBrowser();
  if (!choice) return { status: 'skipped', notes: ['No browser available for the render check. Enable "gift test drive" in Settings to install one.'] };
  const notes: string[] = [];
  const served = await serveFolder(root);
  let browser: import('playwright-core').Browser | undefined;
  try {
    const { chromium } = await import('playwright-core');
    browser = await chromium.launch({ headless: true, executablePath: choice.executablePath, channel: choice.channel, timeout: 30_000 });
    const context = await browser.newContext({ viewport: opts.viewport ?? { width: 960, height: 640 }, reducedMotion: 'no-preference', javaScriptEnabled: true, offline: false });
    // Block everything that is not our ephemeral origin: the real gift origin behaves the same way (CSP + consent).
    await context.route('**/*', (route) => {
      const u = route.request().url();
      if (u.startsWith(served.baseUrl) || u.startsWith('data:') || u.startsWith('blob:')) return route.continue();
      notes.push(`Blocked request to ${u}`);
      return route.abort();
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(`Page error: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() !== 'error') return;
      // The sandbox blocking a remote request is the sandbox working, not the gift failing.
      if (/Content Security Policy|Refused to connect|Refused to load|violates the following/i.test(m.text())) notes.push(`Blocked by the sandbox: ${m.text().slice(0, 160)}`);
      else errors.push(`Console error: ${m.text()}`);
    });
    page.on('requestfailed', (r) => { if (r.url().startsWith(served.baseUrl)) errors.push(`Failed request: ${r.url().slice(served.baseUrl.length)}`); });
    const url = `${served.baseUrl}/${opts.primaryPath.split('/').map(encodeURIComponent).join('/')}`;
    const timeout = opts.timeoutMs ?? 20_000;
    const response = await page.goto(url, { waitUntil: 'load', timeout });
    if (!response || !response.ok()) errors.push(`The primary file did not load (HTTP ${response?.status() ?? 'none'}).`);
    await page.waitForTimeout(600);
    // Click the first focusable control, if any, and make sure the page survives it.
    const control = page.locator('button, [role="button"], a[href], input, select, textarea, [tabindex]:not([tabindex="-1"]), canvas, summary').first();
    if (await control.count()) {
      try {
        await control.focus({ timeout: 1500 });
        await control.click({ timeout: 1500, trial: false, force: true });
        await page.waitForTimeout(400);
      } catch (e) {
        notes.push(`First control could not be clicked: ${(e as Error).message.split('\n')[0]}`);
      }
    } else {
      notes.push('No focusable control found.');
    }
    const screenshot = await page.screenshot({ type: 'png', fullPage: false }).catch(() => undefined);
    await context.close();
    const status = errors.length ? 'failed' : 'passed';
    return { status, notes: [...errors, ...notes], screenshot: screenshot ? Buffer.from(screenshot) : undefined, browser: choice.label };
  } catch (e) {
    return { status: 'failed', notes: [`Render check crashed: ${(e as Error).message.split('\n')[0]}`, ...notes], browser: choice.label };
  } finally {
    await browser?.close().catch(() => undefined);
    await served.close();
  }
}

/** Install the Playwright headless shell (~150 MB) on user request. Streams progress lines to the callback. */
export async function installTestDriveBrowser(onLine: (line: string) => void): Promise<{ ok: boolean; message: string }> {
  const { spawn } = await import('node:child_process');
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  let cli: string;
  try {
    cli = require.resolve('playwright-core/cli');
  } catch {
    return { ok: false, message: 'playwright-core is not installed next to the companion.' };
  }
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [cli, 'install', 'chromium-headless-shell', '--no-shell'], { shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', (d: Buffer) => d.toString().split('\n').filter(Boolean).forEach(onLine));
    child.stderr.on('data', (d: Buffer) => d.toString().split('\n').filter(Boolean).forEach(onLine));
    child.on('close', (code) => resolve(code === 0 ? { ok: true, message: 'Gift test drive is ready.' } : { ok: false, message: `The browser install exited with code ${code}.` }));
    child.on('error', (e) => resolve({ ok: false, message: e.message }));
  });
}
