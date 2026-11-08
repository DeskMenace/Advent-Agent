import { expect, test } from '@playwright/test';
import { api, login, setDemoDay } from './helpers.js';

async function reveal(day: number) {
  await api('POST', `/api/doors/${day}/reveal`).catch(() => undefined);
}

test.describe('renderers (E2)', () => {
  test.beforeAll(async () => { await setDemoDay(24); for (let d = 1; d <= 11; d++) await reveal(d); });
  test.afterAll(async () => { await setDemoDay(8); });

  test('E2.1 interactive HTML runs in a sandboxed iframe with reset and full-screen', async ({ page }) => {
    await login(page, '/gift/2026/5');
    const frame = page.frameLocator('iframe.gift-frame');
    await expect(frame.getByRole('button', { name: 'Shake the globe' })).toBeVisible();
    await frame.getByRole('button', { name: 'Shake the globe' }).click();
    await expect(frame.locator('#count')).toHaveText('1 shake');
    await page.getByRole('button', { name: 'Play from the beginning' }).click();
    await expect(frame.locator('#count')).toHaveText('0 shakes');
    await expect(page.getByRole('button', { name: 'Full screen' })).toBeVisible();
  });

  test('E2.2 image renders from the gift origin and downloads', async ({ page }) => {
    await login(page, '/gift/2026/4');
    const img = page.locator('img.gift-image');
    await expect(img).toBeVisible();
    expect(await img.getAttribute('src')).toMatch(/^http:\/\/127\.0\.0\.1:4725\/g\//);
    expect((await img.boundingBox())!.width).toBeGreaterThan(100);
    expect(await img.evaluate((el: HTMLImageElement) => el.complete)).toBe(true);
    const dl = page.waitForEvent('download');
    await page.getByRole('button', { name: /Download star map/ }).click();
    expect((await dl).suggestedFilename()).toBe('constellation.svg');
  });

  test('E2.3 audio has native controls, does not autoplay, and downloads', async ({ page }) => {
    await login(page, '/gift/2026/6');
    const audio = page.locator('audio');
    await expect(audio).toHaveAttribute('controls', '');
    expect(await audio.evaluate((a: HTMLAudioElement) => a.paused)).toBe(true);
    expect(await audio.evaluate((a: HTMLAudioElement) => a.hasAttribute('autoplay'))).toBe(false);
    const dl = page.waitForEvent('download');
    await page.getByRole('button', { name: /Download chimes/ }).click();
    expect((await dl).suggestedFilename()).toBe('chimes.wav');
  });

  test('E2.4 video plays inline with controls, poster-less, captions and a download', async ({ page }) => {
    await login(page, '/gift/2026/3');
    const video = page.locator('video');
    await expect(video).toHaveAttribute('controls', '');
    await expect(video).toHaveAttribute('playsinline', '');
    await expect(page.locator('video track')).toHaveCount(1);
    expect(await video.evaluate((v: HTMLVideoElement) => v.paused)).toBe(true);
    const dl = page.waitForEvent('download');
    await page.getByRole('button', { name: /Download the film/ }).click();
    expect((await dl).suggestedFilename()).toBe('universe.mp4');
  });

  test('E2.5 document renders markdown as text on paper (no raw HTML) with copy and download', async ({ page }) => {
    await login(page, '/gift/2026/1');
    await expect(page.locator('.paper-letter')).toContainText('A small thing you are worried about today');
    await expect(page.locator('.paper-letter em')).toHaveCount(2);
    expect(await page.locator('.paper-letter script').count()).toBe(0);
    await expect(page.getByRole('button', { name: 'Copy the text' })).toBeVisible();
    const dl = page.waitForEvent('download');
    await page.getByRole('button', { name: /Download letter/ }).click();
    expect((await dl).suggestedFilename()).toBe('letter.md');
  });

  test('E2.6 card shows the SVG, offers print, PNG, SVG and PDF downloads', async ({ page }) => {
    await login(page, '/gift/2026/2');
    await expect(page.locator('img.card-svg')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Print the card' })).toBeVisible();
    const png = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download as PNG' }).click();
    expect((await png).suggestedFilename()).toBe('card.png');
    const svg = page.waitForEvent('download');
    await page.getByRole('button', { name: /Download card \(SVG\)/ }).click();
    expect((await svg).suggestedFilename()).toBe('card.svg');
    const pdf = page.waitForEvent('download');
    await page.getByRole('button', { name: /print-ready PDF/ }).click();
    expect((await pdf).suggestedFilename()).toBe('card-print.pdf');
  });

  test('E2.7 song: player plays the score, WAV download, render-it-yourself sheet with copy buttons', async ({ page }) => {
    await login(page, '/gift/2026/7');
    await expect(page.locator('.player h3')).toHaveText('Music box for a snowy street');
    await expect(page.locator('.player .caption')).toContainText('92 BPM');
    const play = page.getByRole('button', { name: '▶ Play' });
    await play.click();
    await expect(page.getByRole('button', { name: '■ Stop' })).toBeVisible();
    await page.waitForTimeout(600);
    expect(Number(await page.locator('progress').getAttribute('value'))).toBeGreaterThan(0);
    await page.getByRole('button', { name: '■ Stop' }).click();
    await expect(page.locator('.sheet')).toContainText('Ready-to-paste prompt');
    await expect(page.getByRole('button', { name: 'Copy prompt 1' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Copy the whole sheet' })).toBeVisible();
    const dl = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download WAV' }).click();
    expect((await dl).suggestedFilename()).toBe('song.wav');
    // No provider is named anywhere on the page.
    const text = await page.locator('main').innerText();
    expect(text).not.toMatch(/suno|udio|elevenlabs/i);
  });

  test('E2.8 real-world proposal: price, date checked, what is left, never "bought", user-only mark', async ({ page }) => {
    await login(page, '/gift/2026/8');
    await expect(page.locator('.rw-item h3')).toHaveText(/Field Guide/);
    await expect(page.locator('.rw-price')).toHaveText('12.99 GBP');
    await expect(page.locator('.rw-meta')).toContainText('checked on 2026-11-08');
    await expect(page.locator('.rw-whatsleft')).toContainText('Nothing has been ordered or booked');
    const text = ((await page.locator('.gift-artbox').innerText()) + (await page.locator('.note').innerText())).toLowerCase();
    expect(text).not.toMatch(/\b(i|we) (have )?(bought|ordered|booked)\b/);
    const box = page.getByLabel(/I bought it/);
    await box.check();
    await expect(box).toBeChecked();
    await page.reload();
    await expect(page.getByLabel(/I bought it/)).toBeChecked();
    await page.getByLabel(/I bought it/).uncheck();
  });

  test('E2.9 link gift lists links opening in a new tab', async ({ page }) => {
    await login(page, '/gift/2026/9');
    const links = page.locator('.links-list a');
    await expect(links).toHaveCount(3);
    await expect(links.first()).toHaveAttribute('target', '_blank');
    await expect(links.first()).toHaveAttribute('rel', /noopener/);
  });

  test('E2.10 unknown kind falls back to a download view', async ({ page }) => {
    await login(page, '/gift/2026/10');
    await expect(page.locator('.files-list li')).toHaveCount(3);
    await expect(page.locator('.files-list')).toContainText('star.stl');
    const dl = page.waitForEvent('download');
    await page.locator('.files-list a', { hasText: 'Save' }).first().click();
    expect((await dl).suggestedFilename()).toMatch(/\.(stl|json|txt)$/);
  });

  test('D4 companion note is present and gift-specific; D2 typography carries over', async ({ page }) => {
    await login(page, '/gift/2026/1');
    await expect(page.locator('.note')).toContainText('I wrote you a letter');
    await login(page, '/gift/2026/5');
    await expect(page.locator('.note')).toContainText('Click or tap the globe');
    const font = await page.locator('h1.gift-title').evaluate((el) => getComputedStyle(el).fontFamily);
    expect(font).toMatch(/Georgia/);
  });
});
