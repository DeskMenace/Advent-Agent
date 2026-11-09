import { expect, test } from '@playwright/test';
import { api, clearDoor, env, login, setDemoDay, state } from './helpers.js';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import yazl from 'yazl';
import { createWriteStream } from 'node:fs';

test.describe('portable flow (E5)', () => {
  test.beforeAll(async () => { await setDemoDay(24); });
  test.afterAll(async () => { await setDemoDay(8); });

  /** Open a door from the board and unfold the portable instructions inside the pop-up. */
  async function openPortable(page: import('@playwright/test').Page, day: number) {
    await login(page, '/?gary=0');
    await page.locator(env(day)).click();
    const dialog = page.locator('.reveal');
    await expect(dialog.locator('.present')).toBeVisible();
    await dialog.getByText('Ask your assistant').click();
    return dialog;
  }

  test('E5.3 paste text in the pop-up seals a letter, which then unwraps in place', async ({ page }) => {
    await clearDoor(12);
    const dialog = await openPortable(page, 12);
    const request = dialog.getByLabel('Request for your assistant');
    await expect(request).toHaveValue(/door 12/);
    await expect(request).toHaveValue(/never buy or book/i);
    // No idea ids or gift-type hints in the text the user copies.
    expect(await request.inputValue()).not.toMatch(/something to touch|holo-card|pop-up-hello|snow-globe|tiny-companion/);
    await dialog.locator('#paste-12').fill('# A poem for door twelve\n\nSnow, quietly, on everything.');
    await dialog.getByRole('button', { name: 'Seal it into door 12' }).click();
    await expect(dialog.locator('.reveal-title')).toHaveText('A poem for door twelve', { timeout: 15_000 });
    await expect(dialog.locator('.paper-letter')).toContainText('Snow, quietly');
    await expect(dialog.locator('.agent-note')).toHaveCount(0); // a text drop has no invented note
  });

  test('E5.2 drop a single HTML file', async ({ page }) => {
    await clearDoor(13);
    const dialog = await openPortable(page, 13);
    const html = '<!doctype html><html><head><title>Dropped toy</title></head><body><button>Hi</button></body></html>';
    await dialog.locator('.dropzone input[type=file]').setInputFiles({ name: 'toy.html', mimeType: 'text/html', buffer: Buffer.from(html) });
    await expect(dialog.locator('.reveal-title')).toHaveText('Dropped toy', { timeout: 20_000 });
    await expect(dialog.locator('iframe.gift-frame')).toBeVisible();
  });

  test('E5.1 drop a zip with gift.json; a bad zip shows the gate problems', async ({ page }) => {
    await clearDoor(14);
    const dialog = await openPortable(page, 14);
    const dir = join(state().home, 'zips');
    mkdirSync(dir, { recursive: true });
    const bad = join(dir, 'bad.zip');
    await makeZip(bad, { 'gift.json': JSON.stringify({ day: 14, title: 'Broken', note: 'x', primary: 'index.html', artifacts: [{ path: 'index.html', kind: 'interactive-html' }, { path: 'missing.png', kind: 'image' }] }), 'index.html': '<html><body>hi</body></html>' });
    await dialog.locator('.dropzone input[type=file]').setInputFiles(bad);
    await expect(dialog.locator('.problems')).toContainText('missing.png');
    const good = join(dir, 'good.zip');
    await makeZip(good, { 'gift.json': JSON.stringify({ day: 14, title: 'Zipped card', note: 'From a zip.', primary: 'card.svg', artifacts: [{ path: 'card.svg', kind: 'card' }] }), 'card.svg': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#a82438"/></svg>' });
    await dialog.locator('.dropzone input[type=file]').setInputFiles(good);
    await expect(dialog.locator('.reveal-title')).toHaveText('Zipped card', { timeout: 20_000 });
  });

  test('E5.4 drop loose media files', async ({ page }) => {
    await clearDoor(15);
    const dialog = await openPortable(page, 15);
    const mp4 = readFileSync(join(process.cwd(), 'fixtures', 'gifts', '03-video', 'universe.mp4'));
    await dialog.locator('.dropzone input[type=file]').setInputFiles([
      { name: 'winter-wallpaper.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64') },
      { name: 'clip.mp4', mimeType: 'video/mp4', buffer: mp4 },
    ]);
    await expect(dialog.locator('.reveal-title')).toHaveText('Winter wallpaper', { timeout: 20_000 });
    void api;
  });
});

function makeZip(file: string, entries: Record<string, string>): Promise<void> {
  const zip = new yazl.ZipFile();
  for (const [n, d] of Object.entries(entries)) zip.addBuffer(Buffer.from(d), n);
  zip.end();
  return new Promise((res) => zip.outputStream.pipe(createWriteStream(file)).on('close', () => res()));
}
