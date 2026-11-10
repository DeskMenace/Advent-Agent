import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { api, login, reveal, setDemoDay } from './helpers.js';

const CAPTION = 'My AI agent made this gift for me 🎁';

test.describe('share sheet (handoff §1.6, D26)', () => {
  test.beforeAll(async () => { await setDemoDay(8); await reveal(5); });

  test('privacy preview first; no share mark; no Copy link; fixed caption and deskmenace.com everywhere', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await login(page, '/gifts/5');
    await page.getByRole('button', { name: 'Share' }).click();
    const sheet = page.getByRole('dialog', { name: 'Share' });
    await expect(sheet.locator('.share-preview img')).toBeVisible({ timeout: 45_000 });
    expect(await sheet.locator('.share-preview img').evaluate((i: HTMLImageElement) => [i.naturalWidth, i.naturalHeight])).toEqual([1080, 1350]);
    await expect(sheet.getByLabel(/Blur private details/)).toBeVisible();
    // Buttons: X, Facebook, Instagram, TikTok, Copy image (+ native Share… where supported). Never Copy link.
    for (const n of ['X', 'Facebook', 'Instagram', 'TikTok', 'Copy image']) await expect(sheet.getByRole('button', { name: n, exact: true })).toBeVisible();
    await expect(sheet.getByRole('button', { name: /Copy link/ })).toHaveCount(0);

    // X: saves the still, opens the intent with the fixed caption and the bare link.
    const pic = page.waitForEvent('download');
    const xTab = context.waitForEvent('page');
    await sheet.getByRole('button', { name: 'X', exact: true }).click();
    const still = await pic;
    expect(still.suggestedFilename()).toMatch(/\.png$/);
    const xUrl = new URL((await xTab).url());
    expect(xUrl.origin + xUrl.pathname).toBe('https://x.com/intent/post');
    expect(xUrl.searchParams.get('text')).toBe(CAPTION);
    expect(xUrl.searchParams.get('url')).toBe('https://deskmenace.com');
    await (await context.pages()).at(-1)!.close();
    await expect(page.locator('.toast')).toContainText('Image saved. Add it to your post.');

    // Facebook: sharer with the bare link.
    const fbTab = context.waitForEvent('page');
    await sheet.getByRole('button', { name: 'Facebook', exact: true }).click();
    const fbUrl = new URL((await fbTab).url());
    expect(fbUrl.searchParams.get('u')).toBe('https://deskmenace.com');
    await (await context.pages()).at(-1)!.close();

    // Instagram: copies the caption without the link, opens the site, downloads the media.
    const igTab = context.waitForEvent('page');
    const igFile = page.waitForEvent('download', { timeout: 90_000 });
    await sheet.getByRole('button', { name: 'Instagram', exact: true }).click();
    expect((await igTab).url()).toMatch(/^https:\/\/www\.instagram\.com\//);
    await (await context.pages()).at(-1)!.close();
    expect((await igFile).suggestedFilename()).toMatch(/\.(mp4|webm)$/); // the globe is animated → the loop
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(CAPTION);
    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
  });

  test('the server never sends the gift.json caption or a mark', async () => {
    const info = await api<Record<string, unknown>>('GET', '/api/share/5/preview');
    expect(info).toMatchObject({ caption: CAPTION, url: 'https://deskmenace.com' });
    expect(info).not.toHaveProperty('shareMark');
  });

  test('exports carry no mark (saved HTML checked byte for byte for our strings)', async ({ page }) => {
    await login(page, '/gifts/5');
    await page.getByRole('button', { name: 'Save' }).click();
    const dl = page.waitForEvent('download');
    await page.getByRole('menuitem').first().click();
    const html = readFileSync((await (await dl).path())!, 'utf8');
    expect(html).not.toMatch(/Made by my Advent Agent|deskmenace|data-advent-mark|github\.com\/DeskMenace/);
  });
});

test.describe('settings (handoff §1.7, D26)', () => {
  test('sections in order; budget copy is about size only; no share-mark toggle; profile and reminder live here', async ({ page }) => {
    await login(page, '/settings');
    await expect(page.locator('.settings-h').first()).toBeVisible();
    const heads = await page.locator('.settings-h').evaluateAll((els) => els.map((e) => e.childNodes[0]!.textContent!.trim()));
    expect(heads.slice(0, 5)).toEqual(['Delivery', 'Budget', 'Your Secret Santa’s list', 'Your Secret Santa', 'Reminder']);
    await expect(page.getByText('Anything it might not know')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Remind me when a door opens' })).toHaveAttribute('href', '/api/reminder.ics');
    await expect(page.getByText(/Advent Agent mark/)).toHaveCount(0);
    const generous = page.getByRole('radio', { name: /Generous/ });
    await expect(generous).toContainText('Bigger gifts. Uses more tokens.');
    await generous.click();
    await page.getByRole('button', { name: 'Save settings' }).click();
    await expect(page.locator('.toast')).toContainText('Saved');
    const cfg = await api<{ budgets: { generosity: string } }>('GET', '/api/settings');
    expect(cfg.budgets.generosity).toBe('generous');
    await api('PUT', '/api/settings', { budgets: { ...cfg.budgets, generosity: 'standard' } });
    // No gift-type hints anywhere on the page (including the agent table, which no longer lists "gifts possible").
    const text = await page.locator('main').innerText();
    expect(text).not.toMatch(/Gifts possible|\b(games?|songs?|poems?|stickers?|wallpapers?|illustrations?|little worlds|characters)\b/i);
  });
});
