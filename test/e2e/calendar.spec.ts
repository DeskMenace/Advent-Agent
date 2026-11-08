import { expect, test } from '@playwright/test';
import { api, login, resetDoor, setDemoDay } from './helpers.js';

test.describe('calendar and animation (E1)', () => {
  test.beforeEach(async () => { await setDemoDay(8); });

  test('E1.1 on December 8 door 8 opens and door 9 shakes with an accessible message', async ({ page }) => {
    await resetDoor(8);
    await login(page);
    await page.goto('/?gary=0');
    const nine = page.locator('.envelope[data-day="9"]');
    await expect(nine).toHaveAttribute('data-state', 'locked');
    await expect(nine).toHaveAttribute('aria-label', /locked until December 9/);
    await nine.click();
    await expect(nine).toHaveClass(/bump/);
    await expect(page.locator('#live')).toHaveText(/Not yet! Door 9 opens on December 9\./);
    await expect(page.locator('.toast')).toContainText('Door 9 opens on December 9');
    await expect(page).toHaveURL(/\/\?gary=0$/);
    await expect(nine).toBeFocused();
    const eight = page.locator('.envelope[data-day="8"]');
    await expect(eight).toHaveAttribute('data-state', 'ready_unopened');
    await eight.click();
    await expect(eight).toHaveClass(/opening/);
    await page.waitForURL(/\/gift\/2026\/8$/);
    await expect(page.locator('h1.gift-title')).toHaveText(/book you didn’t know/);
    await expect(page.locator('.detail-stamp')).toHaveText('Your gift is unwrapped');
  });

  test('E1.2 before December all doors are locked with a countdown; on December 24 all are eligible', async ({ page }) => {
    await login(page);
    await setDemoDay(0);
    await page.goto('/?gary=0');
    await expect(page.locator('.envelope.locked')).toHaveCount(24);
    await expect(page.locator('.date-headline')).toContainText('Before December');
    await page.locator('.envelope[data-day="1"]').click();
    await expect(page.locator('.toast')).toContainText('still sealed');
    await setDemoDay(24);
    await page.reload();
    await expect(page.locator('.envelope.locked')).toHaveCount(0);
    await expect(page.locator('.board-footer')).toContainText('24 unlocked');
  });

  test('E1.3 direct URLs to future gifts and doors are blocked', async ({ page }) => {
    await login(page);
    await page.goto('/gift/2026/9');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('.toast')).toContainText('Door 9 opens on December 9');
    await page.goto('/door/20');
    await expect(page).toHaveURL(/\/$/);
    const r = await fetch(`${page.url().replace(/\/$/, '')}/api/doors/15`, { headers: { authorization: `Bearer ${(await import('./helpers.js')).state().token}` } });
    expect(r.status).toBe(423);
  });

  test('E1.4 + E1.8 first open animates then shows the viewer; revisiting opens instantly without a new job; back restores focus', async ({ page }) => {
    await resetDoor(5);
    await login(page);
    await page.goto('/?gary=0');
    const five = page.locator('.envelope[data-day="5"]');
    const start = Date.now();
    await five.click();
    await expect(five).toHaveClass(/opening/);
    await page.waitForURL(/\/gift\/2026\/5$/);
    expect(Date.now() - start).toBeGreaterThan(700);
    await expect(page.locator('h1.gift-title')).toHaveText('Your personal snow globe');
    await expect(page.locator('iframe.gift-frame')).toHaveAttribute('sandbox', 'allow-scripts allow-pointer-lock allow-downloads');
    const before = await api<{ attempt: number }>('GET', '/api/doors/5');
    // Back restores focus to the envelope.
    await page.getByRole('button', { name: /Back to your calendar/ }).click();
    await page.waitForURL(/\/$/);
    await expect(page.locator('.envelope[data-day="5"]')).toBeFocused();
    await expect(page.locator('.envelope[data-day="5"]')).toHaveAttribute('data-state', 'opened');
    // Revisit: instant, same gift, no regeneration.
    await page.locator('.envelope[data-day="5"]').click();
    await page.waitForURL(/\/gift\/2026\/5$/, { timeout: 2000 });
    const after = await api<{ attempt: number }>('GET', '/api/doors/5');
    expect(after.attempt).toBe(before.attempt);
    // Browser back/forward keep working.
    await page.goBack();
    await expect(page.locator('.envelope')).toHaveCount(24);
    await page.goForward();
    await expect(page.locator('h1.gift-title')).toHaveText('Your personal snow globe');
    await page.reload();
    await expect(page.locator('h1.gift-title')).toHaveText('Your personal snow globe');
  });

  test('E1.5 rapid taps on one envelope start a single job', async ({ page }) => {
    await login(page);
    await page.goto('/?gary=0');
    const door = page.locator('.envelope[data-day="2"]');
    await resetDoor(2);
    await page.reload();
    await door.click({ clickCount: 1 });
    await door.click({ force: true }).catch(() => undefined);
    await door.click({ force: true }).catch(() => undefined);
    await page.waitForURL(/\/gift\/2026\/2$/);
    const st = await api<{ attempt: number }>('GET', '/api/doors/2');
    expect(st.attempt).toBe(1);
  });

  test('E1.6 reduced motion: no animation classes linger, same outcomes', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await resetDoor(4);
    await login(page);
    await page.goto('/');
    const nine = page.locator('.envelope[data-day="9"]');
    await nine.click();
    await expect(page.locator('#live')).toHaveText(/Door 9 opens/);
    const start = Date.now();
    await page.locator('.envelope[data-day="4"]').click();
    await page.waitForURL(/\/gift\/2026\/4$/);
    expect(Date.now() - start).toBeLessThan(1500);
    await expect(page.locator('h1.gift-title')).toHaveText('A constellation for you');
    // Gary is hidden under reduced motion (E6.5).
    await page.goto('/');
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => Boolean(document.querySelector('script[src*="gary"]')))).toBe(false);
    await ctx.close();
  });

  test('E1.7 the unlock boundary updates the board without a reload', async ({ page }) => {
    await login(page);
    await page.goto('/?gary=0');
    await expect(page.locator('.envelope[data-day="9"]')).toHaveAttribute('data-state', 'locked');
    await setDemoDay(9); // emits a rollover event over SSE
    await expect(page.locator('.envelope[data-day="9"]')).not.toHaveAttribute('data-state', 'locked', { timeout: 10_000 });
    await expect(page.locator('.board-footer')).toContainText('9 unlocked');
    await setDemoDay(8);
  });
});
