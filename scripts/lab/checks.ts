/**
 * Automated gift checks for the lab (Playwright against a running lab companion). Fast smoke checks, not proofs:
 * opens in the pop-up and on its page (console errors, outside network calls), touch and 360 px, share still/loop,
 * Save format, and a random-input play-through for games.
 */
import { chromium, type Browser, type Frame, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { sniffImage } from '../../src/intake/mime.js';

export interface CheckResult {
  name: string;
  ok: boolean | null; // null = not applicable
  detail: string;
}

interface Ctx {
  appUrl: string;
  token: string;
  loginUrl: (path: string) => string;
  day: number;
  manifest: { form?: string; family?: string; interaction?: string | string[]; share?: { loop?: unknown }; save?: { type: string }; primary?: string };
  kind: string;
  out: string;
}

const LOCAL = /^(https?:\/\/127\.0\.0\.1|data:|blob:|about:|chrome-extension:)/;

function watch(page: Page, errors: string[], outside: string[]): void {
  page.on('console', (m) => { if (m.type() === 'error' && !/^Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message.slice(0, 200)}`));
  page.on('request', (r) => { if (!LOCAL.test(r.url())) outside.push(r.url().slice(0, 120)); });
  page.on('requestfailed', (r) => errors.push(`request failed (${r.failure()?.errorText ?? '?'}): ${r.url().replace(/\/g\/[^/]+\//, '/g/…/').slice(0, 140)}`));
}

async function giftFrame(page: Page): Promise<Frame | undefined> {
  const el = await page.$('iframe.gift-frame');
  return el ? (await el.contentFrame()) ?? undefined : undefined;
}

const expectedSave = (ctx: Ctx): RegExp => {
  if (ctx.manifest.save?.type) return new RegExp(ctx.manifest.save.type.split('/')[0]!);
  if (ctx.manifest.form === 'tool') return /zip/;
  if (ctx.kind === 'song' || ctx.kind === 'audio') return /audio/;
  if (ctx.kind === 'image' || ctx.kind === 'card') return /image|html/;
  if (ctx.kind === 'video') return /video/;
  if (ctx.kind === 'document') return /pdf|text|html/;
  return /html/;
};

export async function runChecks(ctx: Ctx): Promise<{ checks: CheckResult[]; screenshot?: string; still?: string }> {
  const checks: CheckResult[] = [];
  const add = (name: string, ok: boolean | null, detail = '') => checks.push({ name, ok, detail });
  const auth = { authorization: `Bearer ${ctx.token}` };
  let browser: Browser | undefined;
  let screenshot: string | undefined;
  let still: string | undefined;
  try {
    browser = await chromium.launch();
    // 1. The pop-up, then the gift page (desktop).
    const desk = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await desk.newPage();
    const errors: string[] = [];
    const outside: string[] = [];
    watch(page, errors, outside);
    await page.goto(ctx.loginUrl('/?gary=0'));
    await page.locator(`.env[data-day="${ctx.day}"]`).click({ timeout: 15_000 });
    const popup = await page.locator('.revealed').waitFor({ timeout: 45_000 }).then(() => true, () => false);
    add('opens in the pop-up', popup, popup ? '' : 'the pop-up never showed the gift');
    await page.goto(`${ctx.appUrl}/gifts/${ctx.day}`);
    const titled = await page.locator('#gift-title').waitFor({ timeout: 20_000 }).then(() => true, () => false);
    await page.waitForTimeout(4000);
    add('opens on its gift page', titled);
    screenshot = join(ctx.out, 'page.png');
    await page.screenshot({ path: screenshot, fullPage: false });
    add('no console errors', errors.length === 0, errors.slice(0, 4).join(' | '));
    add('no network calls', outside.length === 0, [...new Set(outside)].slice(0, 4).join(' | '));

    // 5. Games: a random play-through (smoke only).
    const isGame = ctx.manifest.family === 'games' || [ctx.manifest.interaction].flat().some((v) => /play|jump|steer|catch|shoot|solve|guess|race|dodge/i.test(String(v ?? '')));
    const frame = await giftFrame(page);
    if (isGame && frame) {
      const before = errors.length;
      const box = await page.locator('iframe.gift-frame').boundingBox();
      const shotA = await page.locator('iframe.gift-frame').screenshot();
      for (let i = 0; i < 60; i++) {
        const r = Math.random();
        if (box && r < 0.5) await page.mouse.click(box.x + box.width * (0.15 + Math.random() * 0.7), box.y + box.height * (0.15 + Math.random() * 0.7));
        else await page.keyboard.press(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'Enter'][Math.floor(Math.random() * 6)]!);
        await page.waitForTimeout(250);
      }
      const shotB = await page.locator('iframe.gift-frame').screenshot();
      const changed = !shotA.equals(shotB);
      add('game smoke play-through', changed && errors.length === before, `${changed ? 'screen changed' : 'screen never changed'}; ${errors.length - before} new errors in 60 random inputs`);
      await page.screenshot({ path: join(ctx.out, 'played.png') });
    } else add('game smoke play-through', null, isGame ? 'no iframe' : 'not a game');
    await desk.close();

    // 2. Touch and 360 px.
    const phone = await browser.newContext({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    const p2 = await phone.newPage();
    await p2.goto(ctx.loginUrl(`/gifts/${ctx.day}`));
    await p2.locator('#gift-title').waitFor({ timeout: 20_000 }).catch(() => undefined);
    await p2.waitForTimeout(2500);
    const pageFits = await p2.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
    const f2 = await giftFrame(p2);
    if (f2) {
      const fits = await f2.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1).catch(() => true);
      add('fits a 360 px screen', pageFits && fits, `${pageFits ? '' : 'the page scrolls sideways. '}${fits ? '' : 'the gift is wider than its frame'}`);
      const el = p2.locator('iframe.gift-frame');
      await el.scrollIntoViewIfNeeded();
      const box = await el.boundingBox();
      const a = await el.screenshot();
      if (box) {
        await p2.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
        await p2.waitForTimeout(400);
        // A short swipe via CDP touch events (drag, shake, peel).
        const cdp = await phone.newCDPSession(p2);
        const pt = (x: number, y: number) => [{ x: box.x + x, y: box.y + y }];
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(box.width * 0.3, box.height * 0.5) });
        for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(box.width * (0.3 + i * 0.05), box.height * (0.5 - i * 0.02)) });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await p2.waitForTimeout(1200);
      }
      const b = await el.screenshot();
      add('touch works', !a.equals(b), a.equals(b) ? 'nothing changed after a tap and a swipe' : 'the gift reacted');
    } else {
      add('fits a 360 px screen', pageFits, pageFits ? 'no iframe; page fits' : 'the page scrolls sideways');
      add('touch works', null, `${ctx.kind}: no interactive frame`);
    }
    await phone.close();
  } catch (e) {
    add('checks ran', false, (e as Error).message.slice(0, 300));
  } finally {
    await browser?.close();
  }

  // 3. Share still and loop.
  try {
    const r = await fetch(`${ctx.appUrl}/api/share/${ctx.day}/still`, { headers: auth });
    if (r.ok) {
      const buf = Buffer.from(await r.arrayBuffer());
      still = join(ctx.out, 'still.png');
      writeFileSync(still, buf);
      const info = sniffImage(buf);
      add('share still produced', info.width === 1080 && info.height === 1350, `${info.format} ${info.width}×${info.height}`);
    } else add('share still produced', false, `HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
  } catch (e) { add('share still produced', false, (e as Error).message); }
  if (ctx.manifest.share?.loop) {
    try {
      const r = await fetch(`${ctx.appUrl}/api/share/${ctx.day}/loop`, { headers: auth });
      const buf = r.ok ? Buffer.from(await r.arrayBuffer()) : undefined;
      if (buf) writeFileSync(join(ctx.out, `loop.${/webm/.test(r.headers.get('content-type') ?? '') ? 'webm' : /gif/.test(r.headers.get('content-type') ?? '') ? 'gif' : 'mp4'}`), buf);
      add('share loop produced', r.ok && (buf?.length ?? 0) > 1000, r.ok ? `${r.headers.get('content-type')} ${Math.round((buf?.length ?? 0) / 1024)} KB` : `HTTP ${r.status}`);
    } catch (e) { add('share loop produced', false, (e as Error).message); }
  } else add('share loop produced', null, 'no loop declared');

  // 4. Save.
  try {
    const opts = (await (await fetch(`${ctx.appUrl}/api/save/${ctx.day}`, { headers: auth })).json()) as { options: Array<{ id: string; label: string; format: string }> };
    const first = opts.options[0];
    if (!first) add('Save gives the right format', false, 'no Save options');
    else {
      const r = await fetch(`${ctx.appUrl}/api/save/${ctx.day}/file?id=${encodeURIComponent(first.id)}`, { headers: auth });
      const type = r.headers.get('content-type') ?? '';
      const ok = r.ok && expectedSave(ctx).test(type);
      add('Save gives the right format', ok, `${first.label} ${first.format} → ${r.ok ? type : `HTTP ${r.status}`} (options: ${opts.options.map((o) => `${o.label} ${o.format}`).join(', ')})`);
    }
  } catch (e) { add('Save gives the right format', false, (e as Error).message); }

  return { checks, screenshot, still };
}
