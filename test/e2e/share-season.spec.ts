import { expect, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { api, login, setDemoDay, state } from './helpers.js';

test.describe('sharing (D20/D21)', () => {
  test('the share panel previews a captured still, blurs on request, and saves picture, video and file', async ({ page }) => {
    await setDemoDay(8);
    await api('POST', '/api/doors/5/reveal').catch(() => undefined);
    await login(page, '/gift/2026/5');
    await page.getByRole('button', { name: 'Share…' }).click();
    const dialog = page.getByRole('dialog', { name: 'Share this gift' });
    await expect(dialog.locator('.share-preview img')).toBeVisible({ timeout: 45_000 });
    expect(await dialog.locator('.share-preview img').evaluate((i: HTMLImageElement) => [i.naturalWidth, i.naturalHeight])).toEqual([1080, 1350]);
    await expect(dialog).toContainText('My AI Secret Santa made me a snow globe');
    const pic = page.waitForEvent('download');
    await dialog.getByRole('button', { name: /Download picture/ }).click();
    expect((await pic).suggestedFilename()).toMatch(/\.png$/);
    const file = page.waitForEvent('download');
    await dialog.getByRole('button', { name: 'Download the gift as a file' }).click();
    const saved = await file;
    expect(saved.suggestedFilename()).toMatch(/\.html$/);
    const html = (await import('node:fs')).readFileSync(await saved.path(), 'utf8');
    expect(html).toContain('Made by my Advent Agent · more gifts at deskmenace.com');
    const vid = page.waitForEvent('download', { timeout: 90_000 });
    await dialog.getByRole('button', { name: /Download short video/ }).click();
    expect((await vid).suggestedFilename()).toMatch(/\.(mp4|webm)$/);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  });
});

test.describe('season shape in the UI (D15/D16)', () => {
  test('generosity is chosen with three plain options and persists', async ({ page }) => {
    await login(page, '/settings');
    const generous = page.getByRole('radio', { name: /Generous/ });
    await generous.click();
    await page.getByRole('button', { name: 'Save settings' }).click();
    await expect(page.locator('.toast')).toContainText('Saved');
    const cfg = await api<{ budgets: { generosity: string } }>('GET', '/api/settings');
    expect(cfg.budgets.generosity).toBe('generous');
    await page.reload();
    await expect(page.getByRole('radio', { name: /Generous/ })).toHaveAttribute('aria-checked', 'true');
    await api('PUT', '/api/settings', { budgets: { ...cfg.budgets, generosity: 'standard' } });
  });

  test('a locked door being prepared early shows "wrapping" and nothing else', async ({ page }) => {
    await setDemoDay(0);
    const s = state();
    const file = join(s.demoHome, 'seasons', '2026', 'doors', '01', 'state.json');
    const original = (await import('node:fs')).readFileSync(file, 'utf8');
    writeFileSync(file, JSON.stringify({ schemaVersion: 1, day: 1, jobState: 'preparing', phase: 'making', attempt: 1, attempts: [{ n: 1, mode: 'launched', startedAt: new Date().toISOString(), outcome: 'running', gateReports: 0 }], revealed: false, updatedAt: new Date().toISOString() }));
    try {
      await login(page, '/?gary=0');
      const one = page.locator('.envelope[data-day="1"]');
      await expect(one).toHaveClass(/wrapping/);
      await expect(one).toHaveAttribute('data-state', 'locked');
      await expect(one).toHaveAttribute('aria-label', /wrapping it/);
      const pub = await api<{ doors: Array<{ jobState: string; phase?: string; wrapping: boolean }> }>('GET', '/api/calendar');
      expect(pub.doors[0]).toMatchObject({ jobState: 'not_requested', wrapping: true });
      expect(pub.doors[0]!.phase).toBeUndefined();
    } finally {
      writeFileSync(file, original);
      await setDemoDay(8);
    }
  });

  test('a completed collection is shown together on the shelf', async ({ page }) => {
    await setDemoDay(24);
    for (const [day, index] of [[18, 1], [19, 2], [21, 3]] as const) {
      const manifest = { schema: 'advent-agent/gift@2', day, title: `Jelly ${index}`, note: 'Wobble.', entry: 'index.html', emotion: 'cute', interaction: ['squeeze'], collection: { set: 'jelly-fruits', index, size: 3 }, share: { still: { capture: 'still' } } };
      const dir = join(state().demoHome, 'seasons', '2026', 'doors', String(day));
      writeFileSync(join(dir, 'state.json'), JSON.stringify({ schemaVersion: 1, day, jobState: 'not_requested', attempt: 0, attempts: [], revealed: false, updatedAt: new Date().toISOString() }));
      const r = await api<{ ok: boolean }>('POST', `/api/agent/submit?day=${day}`, { files: [{ name: 'gift.json', text: JSON.stringify(manifest) }, { name: 'index.html', text: '<!doctype html><html><body><script>window.adventCapture={async prepare(){}}</script></body></html>' }] });
      expect(r.ok).toBe(true);
      await api('POST', `/api/doors/${day}/reveal`);
    }
    await login(page, '/gifts');
    const group = page.locator('.collection-group');
    await expect(group.locator('h2').first()).toHaveText('Set complete: jelly fruits');
    await expect(group.locator('.shelf-item')).toHaveCount(3);
    await setDemoDay(8);
  });
});
