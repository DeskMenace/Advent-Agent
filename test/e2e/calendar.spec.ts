import { expect, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { api, clearDoor, env, login, resetDoor, setDemoDay, state } from './helpers.js';

test.describe('onboarding (handoff §0)', () => {
  test.afterEach(async () => { await api('PUT', '/api/settings', { onboardingDone: true, deliveryMode: 'on_demand', budgets: { generosity: 'standard', tokenTarget: 25000, realWorldSuggestions: true } }); });

  test('two steps over the calendar, never about the user; finishing saves and closes; it does not come back', async ({ page }) => {
    await api('PUT', '/api/settings', { onboardingDone: false });
    await login(page, '/?gary=0');
    const dialog = page.getByRole('dialog', { name: 'When does your Secret Santa work?' });
    await expect(dialog).toBeVisible();
    await expect(page.locator('.shell')).toHaveClass(/behind-modal/);
    await expect(dialog.getByRole('radio', { name: /On demand/ })).toHaveAttribute('aria-checked', 'true');
    // Portable mode cannot be scheduled.
    await expect(dialog.getByRole('radio', { name: /Scheduled/ })).toBeDisabled();
    await expect(dialog).toContainText('Your agent works when you call it, so gifts are made on demand.');
    await dialog.getByRole('button', { name: 'Next' }).click();
    const budget = page.getByRole('dialog', { name: 'How generous is your Secret Santa?' });
    await expect(budget.getByRole('radio', { name: /Standard/ })).toHaveAttribute('aria-checked', 'true');
    await expect(budget).toContainText('Smaller gifts. Easy on your tokens.');
    await expect(budget).toContainText('A balance of surprise and tokens.');
    await expect(budget).toContainText('Bigger gifts. Uses more tokens.');
    await expect(budget).toContainText('Day 1 and December 24 get extra room.');
    // No questions about the user, no gift examples.
    const text = await budget.innerText();
    expect(text).not.toMatch(/name|hobb|pet|game|card|song|world|character|illustration/i);
    await budget.getByRole('radio', { name: /Generous/ }).click();
    await budget.getByRole('button', { name: 'Start wrapping' }).click();
    await expect(page.locator('.onboard')).toHaveCount(0);
    const cfg = await api<{ onboardingDone: boolean; budgets: { generosity: string } }>('GET', '/api/settings');
    expect(cfg).toMatchObject({ onboardingDone: true, budgets: { generosity: 'generous' } });
    await page.reload();
    await expect(page.locator(env(1))).toBeVisible();
    await expect(page.locator('.onboard')).toHaveCount(0);
  });

  test('closing applies the defaults and marks onboarding done', async ({ page }) => {
    await api('PUT', '/api/settings', { onboardingDone: false, budgets: { generosity: 'light', tokenTarget: 25000, realWorldSuggestions: true } });
    await login(page, '/?gary=0');
    await page.locator('.onboard').getByRole('button', { name: 'Close' }).click();
    await expect(page.locator('.onboard')).toHaveCount(0);
    const cfg = await api<{ onboardingDone: boolean; deliveryMode: string; budgets: { generosity: string } }>('GET', '/api/settings');
    expect(cfg).toMatchObject({ onboardingDone: true, deliveryMode: 'on_demand', budgets: { generosity: 'standard' } });
  });
});

test.describe('envelope states (handoff §1.2)', () => {
  test.beforeEach(async () => { await setDemoDay(8); });

  test('locked, unlocked, preparing and opened look different, carry no text and have full labels', async ({ page }) => {
    await resetDoor(4);
    await api('POST', '/api/doors/3/reveal');
    // Door 7 temporarily "being prepared" (the fixture file is restored afterwards).
    const file7 = join(state().demoHome, 'seasons', '2026', 'doors', '07', 'state.json');
    const original7 = (await import('node:fs')).readFileSync(file7, 'utf8');
    writeFileSync(file7, JSON.stringify({ schemaVersion: 1, day: 7, jobState: 'waiting_for_drop', attempt: 1, attempts: [{ n: 1, mode: 'submit', startedAt: new Date().toISOString(), outcome: 'running', gateReports: 0 }], revealed: false, updatedAt: new Date().toISOString() }));
    try {
    await login(page, '/?gary=0');
    const locked = page.locator(env(12));
    const unlocked = page.locator(env(4));
    const preparing = page.locator(env(7));
    const opened = page.locator(env(3));
    await expect(locked).toHaveAttribute('data-state', 'locked');
    await expect(unlocked).toHaveAttribute('data-state', 'unlocked');
    await expect(preparing).toHaveAttribute('data-state', 'preparing');
    await expect(opened).toHaveAttribute('data-state', 'opened');
    // Distinguishable by shape, not only colour: seal, star, ribbon, peeking card.
    await expect(locked.locator('.seal')).toHaveCount(1);
    await expect(unlocked.locator('.corner')).toHaveCount(1);
    await expect(preparing.locator('.tie')).toHaveCount(1);
    await expect(opened.locator('.peek')).toHaveCount(1);
    for (const e of [locked, unlocked, preparing, opened]) expect((await e.innerText()).replace(/\d+/g, '').trim()).toBe('');
    await expect(locked).toHaveAttribute('aria-label', 'December 12, locked');
    await expect(unlocked).toHaveAttribute('aria-label', 'December 4, gift ready to open');
    await expect(preparing).toHaveAttribute('aria-label', 'December 7, your Secret Santa is wrapping it');
    await expect(opened).toHaveAttribute('aria-label', 'December 3, opened: A pocket-sized universe');
    // Today's door glints once; no "OPENED" label anywhere.
    await expect(page.locator(`${env(8)} .glint`)).toHaveCount(1);
    await expect(page.locator('.board-wrap')).not.toContainText(/opened/i);
    await expect(page.locator('.board-footer')).toContainText('Each door opens on its day');
    await expect(page.locator('.board-footer')).toContainText('8 unlocked');
    // Greyscale: the board stays legible when colour is removed (the four states differ in structure, checked above).
    await page.addStyleTag({ content: 'html{filter:grayscale(1)}' });
    await expect(page.locator(env(7)).locator('.tie')).toBeVisible();
    } finally { writeFileSync(file7, original7); }
  });

  test('a locked door wiggles, says nothing and emits door:locked-click', async ({ page }) => {
    await login(page, '/?gary=0');
    await page.evaluate(() => { (window as unknown as { __ev: unknown[] }).__ev = []; window.addEventListener('door:locked-click', (e) => (window as unknown as { __ev: unknown[] }).__ev.push((e as CustomEvent).detail)); });
    await page.locator(env(9)).click();
    await expect(page.locator(env(9))).toHaveClass(/shake/);
    await expect(page.locator('.toast.show')).toHaveCount(0);
    await expect(page.locator('.reveal')).toHaveCount(0);
    expect(await page.evaluate(() => (window as unknown as { __ev: unknown[] }).__ev)).toEqual([{ day: 9 }]);
  });

  test('a locked door being prepared early (Day 1 in November) shows the ribbon and leaks nothing', async ({ page }) => {
    await setDemoDay(0);
    const file = join(state().demoHome, 'seasons', '2026', 'doors', '01', 'state.json');
    const original = (await import('node:fs')).readFileSync(file, 'utf8');
    writeFileSync(file, JSON.stringify({ schemaVersion: 1, day: 1, jobState: 'preparing', phase: 'making', attempt: 1, attempts: [{ n: 1, mode: 'launched', startedAt: new Date().toISOString(), outcome: 'running', gateReports: 0 }], revealed: false, updatedAt: new Date().toISOString() }));
    try {
      await login(page, '/?gary=0');
      const one = page.locator(env(1));
      await expect(one).toHaveAttribute('data-state', 'preparing');
      await expect(one.locator('.seal')).toHaveCount(1);
      await expect(one).toHaveAttribute('aria-label', 'December 1, locked, your Secret Santa is wrapping it');
      const pub = await api<{ doors: Array<{ jobState: string; phase?: string; wrapping: boolean }> }>('GET', '/api/calendar');
      expect(pub.doors[0]).toMatchObject({ jobState: 'not_requested', wrapping: true });
      expect(pub.doors[0]!.phase).toBeUndefined();
    } finally {
      writeFileSync(file, original);
      await setDemoDay(8);
    }
  });
});

test.describe('reveal pop-up (handoff §1.4)', () => {
  test.beforeEach(async () => { await setDemoDay(8); });

  test('flap → wrapped present → unwrap → gift, saved on reveal, with only the agent\'s words', async ({ page }) => {
    await resetDoor(5);
    await login(page, '/?gary=0');
    await page.evaluate(() => { (window as unknown as { __ev: string[] }).__ev = []; window.addEventListener('gift:revealed', () => (window as unknown as { __ev: string[] }).__ev.push('revealed')); });
    const five = page.locator(env(5));
    await five.click();
    await expect(five).toHaveClass(/opening/);
    const dialog = page.locator('.reveal');
    await expect(dialog.locator('.present')).toBeVisible();
    await expect(dialog.locator('.revealed')).toBeVisible({ timeout: 10_000 });
    await expect(dialog.locator('.reveal-title')).toHaveText('Your personal snow globe');
    await expect(dialog.locator('iframe.gift-frame')).toHaveAttribute('sandbox', 'allow-scripts allow-pointer-lock allow-downloads');
    await expect(dialog.getByRole('button', { name: 'Share' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Save' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Open full page' })).toBeVisible();
    // Nothing written by the calendar besides the day and the buttons.
    const ours = await dialog.locator('.revealed').evaluate((el) => {
      const clone = el.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('.reveal-title, .agent-note, .action-row, iframe, .frame-tools').forEach((n) => n.remove());
      return clone.innerText.trim();
    });
    expect(ours.toUpperCase()).toBe('DECEMBER 5');
    expect(await page.evaluate(() => (window as unknown as { __ev: string[] }).__ev)).toEqual(['revealed']);
    // Saved immediately: on the shelf, opened on the board.
    const shelf = await api<{ items: Array<{ day: number }> }>('GET', '/api/gifts');
    expect(shelf.items.map((i) => i.day)).toContain(5);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(page.locator(env(5))).toHaveAttribute('data-state', 'opened');
    await expect(page.locator(env(5))).toBeFocused();
    // An opened door goes straight to its gift page.
    await page.locator(env(5)).click();
    await page.waitForURL(/\/gifts\/5$/);
    await expect(page.locator('#gift-title')).toHaveText('Your personal snow globe');
  });

  test('closing during preparation is safe; when ready the door is unopened again and unwraps on click', async ({ page }) => {
    await setDemoDay(24);
    await clearDoor(20);
    await login(page, '/?gary=0');
    await page.locator(env(20)).click();
    const dialog = page.locator('.reveal');
    await expect(dialog.locator('.present.wobble')).toBeVisible();
    await expect(dialog.locator('.reveal-line')).not.toBeEmpty();
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator(env(20))).toHaveAttribute('data-state', 'preparing');
    // The gift lands while the pop-up is closed.
    const files = [{ name: 'gift.json', text: JSON.stringify({ schema: 'advent-agent/gift@1', day: 20, title: 'Landed later', note: 'Made while you were away.', primary: 'index.html', artifacts: [{ path: 'index.html', kind: 'interactive-html' }] }) }, { name: 'index.html', text: '<!doctype html><html><body><p>hi</p></body></html>' }];
    const r = await api<{ ok: boolean }>('POST', '/api/agent/submit?day=20', { files });
    expect(r.ok).toBe(true);
    await expect(page.locator(env(20))).toHaveAttribute('data-state', 'unlocked', { timeout: 10_000 });
    await page.locator(env(20)).click();
    await expect(dialog.locator('.reveal-title')).toHaveText('Landed later', { timeout: 10_000 });
    await page.keyboard.press('Escape');
    await clearDoor(20);
    await setDemoDay(8);
  });

  test('reduced motion: same outcome, no wobble, quick crossfade', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await resetDoor(4);
    await login(page, '/?gary=0');
    const start = Date.now();
    await page.locator(env(4)).click();
    await expect(page.locator('.reveal-title')).toHaveText('A constellation for you', { timeout: 5000 });
    expect(Date.now() - start).toBeLessThan(2500);
    const anim = await page.locator(env(4)).evaluate((el) => getComputedStyle(el).transitionDuration);
    expect(parseFloat(anim)).toBeLessThan(0.05);
    await ctx.close();
  });

  test('/door/:day opens that door\'s pop-up; future doors stay shut', async ({ page }) => {
    await resetDoor(2);
    await login(page, '/door/2');
    await expect(page.locator('.reveal')).toBeVisible();
    await page.keyboard.press('Escape');
    await login(page, '/door/20');
    await expect(page.locator('.reveal')).toHaveCount(0);
    await login(page, '/gifts/9');
    await expect(page).toHaveURL(/\/$/);
    const r = await fetch(`http://127.0.0.1:${state().appPort}/api/doors/15`, { headers: { authorization: `Bearer ${state().token}` } });
    expect(r.status).toBe(423);
  });

  test('the unlock boundary updates the board without a reload', async ({ page }) => {
    await login(page, '/?gary=0');
    await expect(page.locator(env(9))).toHaveAttribute('data-state', 'locked');
    await setDemoDay(9);
    await expect(page.locator(env(9))).not.toHaveAttribute('data-state', 'locked', { timeout: 10_000 });
    await expect(page.locator('.board-footer')).toContainText('9 unlocked');
    await setDemoDay(8);
  });
});

test.describe('home copy (handoff §1.1, D26)', () => {
  test('headline, steps and footer are exactly as specified, with no gift examples', async ({ page }) => {
    await login(page, '/?gary=0');
    await expect(page.locator('.home-eyebrow')).toHaveText('The season of surprises');
    await expect(page.locator('.home-title')).toHaveText('Your AI agent is your Secret Santa.');
    await expect(page.locator('.home-title em')).toHaveText('Secret Santa.');
    await expect(page.locator('.home-sub')).toHaveText('Discover what it thinks you\'d love, one gift at a time.');
    const steps = page.locator('.desk-only .steps li');
    await expect(steps).toHaveCount(3);
    await expect(steps.nth(0)).toContainText('Wait for your day.A new envelope unlocks at local midnight.');
    await expect(steps.nth(2).getByRole('link', { name: 'Your Gifts' })).toHaveAttribute('href', '/gifts');
    await expect(page.locator('.desk-only .footnote')).toHaveText('Fully local. Nothing leaves your device.');
    await expect(page.getByRole('link', { name: 'Advent Agent on GitHub' })).toHaveAttribute('href', 'https://github.com/suchipizza/Advent-Agent');
    await expect(page.getByRole('link', { name: /Archive/ })).toHaveCount(0);
    expect(await page.locator('main').innerText()).not.toMatch(/\b(game|card|song|poem|sticker|wallpaper|illustration|interactive|3D)\b/i);
  });
});
