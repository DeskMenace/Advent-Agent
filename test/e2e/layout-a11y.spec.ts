import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { api, login, resetDoor, setDemoDay } from './helpers.js';

const WIDTHS = [320, 390, 768, 1280, 1440];

test.describe('layouts (E8)', () => {
  test.beforeAll(async () => { await setDemoDay(8); await api('POST', '/api/doors/5/reveal').catch(() => undefined); });
  for (const width of WIDTHS) {
    test(`E8.1/E8.2 ${width}px: calendar and gift page have no horizontal overflow and all 24 numbers are legible`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await ctx.newPage();
      await login(page);
      await page.goto('/?gary=0');
      await expect(page.locator('.envelope')).toHaveCount(24);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
      const numbers = await page.locator('.envelope .number').evaluateAll((els) => els.map((e) => e.textContent));
      expect(numbers).toEqual(Array.from({ length: 24 }, (_, i) => String(i + 1)));
      const minFont = await page.locator('.envelope .number').evaluateAll((els) => Math.min(...els.map((e) => parseFloat(getComputedStyle(e).fontSize))));
      expect(minFont).toBeGreaterThanOrEqual(20);
      const tap = await page.locator('.envelope[data-day="1"]').boundingBox();
      expect(tap!.width).toBeGreaterThanOrEqual(44);
      if (!process.env.CI) await expect(page).toHaveScreenshot(`calendar-${width}.png`, { fullPage: true, maxDiffPixelRatio: 0.03 });
      else await page.screenshot({ path: `test-results/calendar-${width}.png`, fullPage: true });
      await page.goto('/gift/2026/5');
      await expect(page.locator('h1.gift-title')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
      await ctx.close();
    });
  }
  test('E8.1 200% zoom keeps the board usable without horizontal overflow', async ({ browser }) => {
    // Browser zoom at 200% halves the CSS viewport: a 1280px window behaves like 640 CSS px at 2× density.
    const ctx = await browser.newContext({ viewport: { width: 640, height: 450 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await login(page);
    await page.goto('/?gary=0');
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
    await expect(page.locator('.envelope[data-day="24"]')).toBeVisible();
    await ctx.close();
  });
});

test.describe('accessibility (E9)', () => {
  test.beforeAll(async () => { await setDemoDay(8); });
  for (const path of ['/?gary=0', '/setup', '/door/8', '/gift/2026/5', '/gifts', '/settings']) {
    test(`E9.1 axe: no serious or critical violations on ${path}`, async ({ page }) => {
      if (path === '/door/8') await resetDoor(8);
      await login(page);
      await page.goto(path);
      await page.waitForTimeout(800);
      const results = await new AxeBuilder({ page }).disableRules(['color-contrast']).analyze();
      const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
      const contrast = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
      // Contrast is checked separately and reported; decorative board text is excluded by aria-hidden.
      const bad = contrast.violations.flatMap((v) => v.nodes.map((n) => n.target.join(' '))).filter((t) => !t.includes('board-foot'));
      expect(bad).toEqual([]);
    });
  }

  test('E9.2–E9.4 keyboard-only: setup → calendar → open → gift → back, focus restored, live region speaks', async ({ page }) => {
    await resetDoor(3);
    await login(page, '/setup');
    await page.keyboard.press('Tab');
    // Walk the wizard with the keyboard: press "Continue" / "Hang the calendar" until the final step appears.
    for (let i = 0; i < 10; i++) {
      if (await page.getByRole('button', { name: 'Show me the calendar' }).count()) break;
      const cont = page.getByRole('button', { name: /Continue|Hang the calendar/ });
      await expect(cont).toBeEnabled();
      await cont.focus();
      await page.keyboard.press('Enter');
      await page.waitForTimeout(400);
    }
    await page.getByRole('button', { name: 'Show me the calendar' }).focus();
    await page.keyboard.press('Enter');
    await page.waitForURL(/\/$/);
    const three = page.locator('.envelope[data-day="3"]');
    await three.focus();
    await expect(three).toBeFocused();
    await page.keyboard.press('Enter');
    await page.waitForURL(/\/gift\/2026\/3$/);
    await expect(page.locator('#live')).toHaveText(/Door 3: A pocket-sized universe/);
    await expect(page.locator('h1.gift-title')).toBeFocused();
    await page.getByRole('button', { name: /Back to your calendar/ }).focus();
    await page.keyboard.press('Enter');
    await page.waitForURL(/\/$/);
    await expect(page.locator('.envelope[data-day="3"]')).toBeFocused();
    // Locked door via keyboard: announcement, no navigation.
    const twenty = page.locator('.envelope[data-day="20"]');
    await twenty.focus();
    await page.keyboard.press('Space');
    await expect(page.locator('#live')).toHaveText(/Door 20 opens on December 20/);
    await expect(page).toHaveURL(/\/$/);
  });
});
