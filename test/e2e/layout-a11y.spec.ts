import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { api, env, login, resetDoor, reveal, setDemoDay } from './helpers.js';

const WIDTHS = [320, 360, 390, 768, 1280, 1440];
const noOverflow = () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1;

test.describe('layouts (E8)', () => {
  test.beforeAll(async () => { await setDemoDay(8); await reveal(5); });
  for (const width of WIDTHS) {
    test(`E8.1/E8.2 ${width}px: calendar, pop-up and gift page fit, all 24 numbers legible`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await ctx.newPage();
      await login(page, '/?gary=0');
      await expect(page.locator('.env')).toHaveCount(24);
      expect(await page.evaluate(noOverflow)).toBe(true);
      const numbers = await page.locator('.env .num').evaluateAll((els) => els.map((e) => e.textContent));
      expect(numbers).toEqual(Array.from({ length: 24 }, (_, i) => String(i + 1)));
      const minFont = await page.locator('.env .num').evaluateAll((els) => Math.min(...els.map((e) => parseFloat(getComputedStyle(e).fontSize))));
      expect(minFont).toBeGreaterThanOrEqual(20);
      expect((await page.locator(env(1)).boundingBox())!.width).toBeGreaterThanOrEqual(44);
      // Mobile order: headline, calendar, then the steps.
      if (width < 1024) {
        const y = async (sel: string) => (await page.locator(sel).first().boundingBox())!.y;
        expect(await y('.home-title')).toBeLessThan(await y('.board-wrap'));
        expect(await y('.board-wrap')).toBeLessThan(await y('.mobile-only .steps'));
      }
      if (!process.env.CI) await expect(page).toHaveScreenshot(`calendar-${width}.png`, { fullPage: true, maxDiffPixelRatio: 0.03 });
      else await page.screenshot({ path: `test-results/calendar-${width}.png`, fullPage: true });
      // The pop-up: full-screen on phones, ~720 px on desktop.
      await page.locator(env(5)).click();
      await page.waitForURL(/\/gifts\/5$/);
      await expect(page.locator('#gift-title')).toBeVisible();
      expect(await page.evaluate(noOverflow)).toBe(true);
      await ctx.close();
    });
  }

  test('360px: the reveal pop-up is full-screen and the share sheet fits', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 740 } });
    const page = await ctx.newPage();
    await resetDoor(4);
    await login(page, '/?gary=0');
    await page.locator(env(4)).click();
    const dialog = page.locator('.reveal');
    await expect(dialog.locator('.revealed')).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(1000); // let the rise animation finish
    const box = (await dialog.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(359);
    expect(await page.evaluate(noOverflow)).toBe(true);
    await dialog.getByRole('button', { name: 'Share' }).click();
    const sheet = page.getByRole('dialog', { name: 'Share' });
    await expect(sheet.getByRole('button', { name: 'X', exact: true })).toBeVisible();
    expect((await sheet.boundingBox())!.width).toBeLessThanOrEqual(360);
    await ctx.close();
  });

  test('E8.1 200% zoom keeps the board usable without horizontal overflow', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 640, height: 450 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await login(page, '/?gary=0');
    await page.waitForTimeout(300);
    expect(await page.evaluate(noOverflow)).toBe(true);
    await expect(page.locator(env(24))).toBeVisible();
    await ctx.close();
  });
});

test.describe('accessibility (E9)', () => {
  test.beforeAll(async () => { await setDemoDay(8); await reveal(5); });
  for (const path of ['/?gary=0', '/setup', '/gifts/5', '/gifts', '/settings', 'pop-up', 'onboarding']) {
    test(`E9.1 axe: no serious or critical violations on ${path}`, async ({ page }) => {
      if (path === 'pop-up') { await resetDoor(8); await login(page, '/?gary=0'); await page.locator(env(8)).click(); await page.locator('.revealed').waitFor({ timeout: 10_000 }); }
      else if (path === 'onboarding') { await api('PUT', '/api/settings', { onboardingDone: false }); await login(page, '/?gary=0'); await page.locator('.onboard').waitFor(); }
      else { await login(page, path); }
      await page.waitForTimeout(800);
      try {
        const results = await new AxeBuilder({ page }).disableRules(['color-contrast']).analyze();
        const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
        expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
        const contrast = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
        // Decorative board text and envelope numbers are aria-hidden (each envelope's label carries its date and state).
        const bad = contrast.violations.flatMap((v) => v.nodes.map((n) => n.target.join(' '))).filter((t) => !t.includes('.num'));
        expect(bad).toEqual([]);
      } finally {
        if (path === 'onboarding') await api('PUT', '/api/settings', { onboardingDone: true });
      }
    });
  }

  test('E9.2–E9.4 keyboard-only: setup → calendar → open → gift → close, focus restored, live region speaks', async ({ page }) => {
    await resetDoor(3);
    await login(page, '/setup');
    await page.getByRole('button', { name: 'Continue' }).focus();
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Hang the calendar' }).focus();
    await page.keyboard.press('Enter');
    await page.waitForURL(/\/$/);
    const three = page.locator(env(3));
    await three.focus();
    await page.keyboard.press('Enter');
    const dialog = page.locator('.reveal');
    await expect(dialog).toBeFocused();
    await expect(dialog.locator('.reveal-title')).toHaveText('A pocket-sized universe', { timeout: 10_000 });
    await expect(page.locator('#live')).toHaveText(/Door 3: A pocket-sized universe/);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(page.locator(env(3))).toBeFocused();
    // Locked door via keyboard: a wiggle, no navigation, no pop-up.
    const twenty = page.locator(env(20));
    await twenty.focus();
    await page.keyboard.press('Space');
    await expect(twenty).toHaveClass(/shake/);
    await expect(page.locator('.reveal')).toHaveCount(0);
    await expect(page).toHaveURL(/\/(\?gary=0)?$/);
  });
});
