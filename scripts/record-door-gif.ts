/**
 * Records the README clip: Door 1 opening on the fixture calendar, cut before any gift is visible (D34).
 * Developer tool, not shipped. Needs ffmpeg on PATH. Usage: npx tsx scripts/record-door-gif.ts [out.gif]
 * The reveal request is held back while recording, so no part of a gift is ever rendered into the video.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from '@playwright/test';

const APP = 4824;
const GIFT = 4825;
const out = resolve(process.argv[2] ?? 'docs/media/door-1-opening.gif');
const home = mkdtempSync(join(tmpdir(), 'aa-gif-'));
const videoDir = mkdtempSync(join(tmpdir(), 'aa-gif-video-'));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const server = spawn(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'scripts/fixture-calendar.ts', '--port', String(APP), '--gift-port', String(GIFT), '--day', '1'], {
  env: { ...process.env, ADVENT_AGENT_HOME: home, ADVENT_AGENT_USER_HOME: home },
  stdio: 'ignore',
});

try {
  const tokenFile = join(home, 'demo', 'api.token');
  for (let i = 0; i < 200 && !existsSync(tokenFile); i++) await sleep(300);
  await sleep(1500);
  const bearer = readFileSync(tokenFile, 'utf8').trim();
  const base = `http://127.0.0.1:${APP}`;
  const auth = { authorization: `Bearer ${bearer}`, 'content-type': 'application/json' };
  await fetch(`${base}/api/settings`, { method: 'PUT', headers: auth, body: JSON.stringify({ onboardingDone: true }) });
  const { token } = (await (await fetch(`${base}/api/auth/token`, { method: 'POST', headers: auth })).json()) as { token: string };

  const size = { width: 1120, height: 760 };
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: size, deviceScaleFactor: 1, recordVideo: { dir: videoDir, size } });
  const page = await context.newPage();
  const t0 = Date.now();
  // Hold the reveal back: the present unwraps, and the gift never reaches the page.
  await page.route('**/api/doors/1/reveal', async () => { await sleep(60_000); });
  await page.goto(`${base}/auth?t=${token}&to=${encodeURIComponent('/?gary=0')}`);
  const door = page.locator('.env').first();
  await door.waitFor();
  await page.addStyleTag({ content: '* { cursor: default !important; }' });
  await sleep(1200);
  const start = (Date.now() - t0) / 1000;
  const box = (await door.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2 + 260, box.y + box.height / 2 + 160);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 30 });
  await sleep(500);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.locator('.present.unwrap').waitFor({ timeout: 20_000 });
  const unwrap = (Date.now() - t0) / 1000;
  await sleep(2500);
  if (await page.locator('.revealed, iframe.gift-frame, .reveal-title').count()) throw new Error('A gift became visible: not recording.');
  await context.close();
  await browser.close();

  const video = join(videoDir, readdirSync(videoDir).find((f) => f.endsWith('.webm'))!);
  // End just after the lid pops (the unwrap animation runs about 1.1 s).
  const duration = unwrap + 1.25 - start;
  const filter = 'fps=18,scale=880:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle';
  const r = spawnSync('ffmpeg', ['-y', '-ss', start.toFixed(2), '-t', duration.toFixed(2), '-i', video, '-filter_complex', filter, '-loop', '0', out], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('ffmpeg failed');
  console.log(`Wrote ${out} (${duration.toFixed(1)} s). Check every frame before committing: no gift, no personal details.`);
} finally {
  server.kill();
  rmSync(videoDir, { recursive: true, force: true });
  rmSync(home, { recursive: true, force: true });
}
