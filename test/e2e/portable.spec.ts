import { expect, test } from '@playwright/test';
import { api, login, setDemoDay, state } from './helpers.js';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import yazl from 'yazl';
import { createWriteStream } from 'node:fs';

/** Put a door back to "not requested" so the portable flow can start from the envelope. */
async function clearDoor(day: number) {
  const s = state();
  const dir = join(s.demoHome, 'seasons', '2026', 'doors', String(day).padStart(2, '0'));
  writeFileSync(join(dir, 'state.json'), JSON.stringify({ schemaVersion: 1, day, jobState: 'not_requested', attempt: 0, attempts: [], revealed: false, updatedAt: new Date().toISOString() }));
}

test.describe('portable flow (E5)', () => {
  test.beforeAll(async () => { await setDemoDay(24); });
  test.afterAll(async () => { await setDemoDay(8); });

  test('E5.3 paste text on the preparation screen seals a letter and reveals it', async ({ page }) => {
    await clearDoor(12);
    await login(page);
    await page.goto('/?gary=0');
    await page.locator('.envelope[data-day="12"]').click();
    await page.waitForURL(/\/door\/12$/);
    await expect(page.getByRole('heading', { name: /Ask your assistant/ })).toBeVisible();
    await expect(page.getByLabel('Request for your assistant')).toHaveValue(/door 12/);
    await expect(page.getByLabel('Request for your assistant')).toHaveValue(/never buy or book/i);
    await page.locator('#paste-12').fill('# A poem for door twelve\n\nSnow, quietly, on everything.');
    await page.getByRole('button', { name: 'Seal it into door 12' }).click();
    await page.waitForURL(/\/gift\/2026\/12$/, { timeout: 15_000 });
    await expect(page.locator('h1.gift-title')).toHaveText('A poem for door twelve');
    await expect(page.locator('.paper-letter')).toContainText('Snow, quietly');
  });

  test('E5.2 drop a single HTML file', async ({ page }) => {
    await clearDoor(13);
    await login(page, '/door/13');
    await api('POST', '/api/doors/13/open');
    await page.reload();
    const html = '<!doctype html><html><head><title>Dropped toy</title></head><body><button>Hi</button></body></html>';
    await page.locator('.dropzone input[type=file]').setInputFiles({ name: 'toy.html', mimeType: 'text/html', buffer: Buffer.from(html) });
    await page.waitForURL(/\/gift\/2026\/13$/, { timeout: 20_000 });
    await expect(page.locator('h1.gift-title')).toHaveText('Dropped toy');
    await expect(page.locator('iframe.gift-frame')).toBeVisible();
  });

  test('E5.1 drop a zip with gift.json; a bad zip shows the gate problems', async ({ page }) => {
    await clearDoor(14);
    await api('POST', '/api/doors/14/open');
    await login(page, '/door/14');
    const dir = join(state().home, 'zips');
    mkdirSync(dir, { recursive: true });
    const bad = join(dir, 'bad.zip');
    await makeZip(bad, { 'gift.json': JSON.stringify({ day: 14, title: 'Broken', note: 'x', primary: 'index.html', artifacts: [{ path: 'index.html', kind: 'interactive-html' }, { path: 'missing.png', kind: 'image' }] }), 'index.html': '<html><body>hi</body></html>' });
    await page.locator('.dropzone input[type=file]').setInputFiles(bad);
    await expect(page.locator('.problems')).toContainText('missing.png');
    await expect(page).toHaveURL(/\/door\/14$/);
    const good = join(dir, 'good.zip');
    await makeZip(good, { 'gift.json': JSON.stringify({ day: 14, title: 'Zipped card', note: 'From a zip.', primary: 'card.svg', artifacts: [{ path: 'card.svg', kind: 'card' }] }), 'card.svg': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#a82438"/></svg>' });
    await page.locator('.dropzone input[type=file]').setInputFiles(good);
    await page.waitForURL(/\/gift\/2026\/14$/, { timeout: 20_000 });
    await expect(page.locator('h1.gift-title')).toHaveText('Zipped card');
  });

  test('E5.4 drop loose media files', async ({ page }) => {
    await clearDoor(15);
    await api('POST', '/api/doors/15/open');
    await login(page, '/door/15');
    const png = readFileSync(join(process.cwd(), 'fixtures', 'gifts', '03-video', 'universe.mp4'));
    await page.locator('.dropzone input[type=file]').setInputFiles([
      { name: 'winter-wallpaper.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64') },
      { name: 'clip.mp4', mimeType: 'video/mp4', buffer: png },
    ]);
    await page.waitForURL(/\/gift\/2026\/15$/, { timeout: 20_000 });
    await expect(page.locator('h1.gift-title')).toHaveText('Winter wallpaper');
  });

  test('the shelf offers "add a gift for a door" in portable mode', async ({ page }) => {
    await clearDoor(16);
    await login(page, '/gifts');
    await expect(page.getByRole('heading', { name: 'Add a gift for a door' })).toBeVisible();
    await page.getByRole('button', { name: 'Door 16' }).click();
    await expect(page.locator('#paste-16')).toBeVisible();
  });
});

function makeZip(file: string, entries: Record<string, string>): Promise<void> {
  const zip = new yazl.ZipFile();
  for (const [n, d] of Object.entries(entries)) zip.addBuffer(Buffer.from(d), n);
  zip.end();
  return new Promise((res) => zip.outputStream.pipe(createWriteStream(file)).on('close', () => res()));
}
