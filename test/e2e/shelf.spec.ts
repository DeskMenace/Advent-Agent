import { expect, test } from '@playwright/test';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { api, login, resetDoor, reveal, setDemoDay, state } from './helpers.js';

test.describe('Your Gifts (handoff §1.5)', () => {
  test('lists only opened gifts, ordered by day, and never leaks unopened titles', async ({ page }) => {
    await setDemoDay(8);
    await resetDoor(1);
    await resetDoor(2);
    await reveal(4);
    await reveal(3);
    await login(page, '/gifts');
    await expect(page.locator('.gift-card').first()).toBeVisible();
    const titles = await page.locator('.gift-card .title').allInnerTexts();
    expect(titles).toContain('A pocket-sized universe');
    const days = await page.locator('.gift-card .day').allInnerTexts();
    expect(days).toEqual([...days].sort((a, b) => Number(a.replace(/\D/g, '')) - Number(b.replace(/\D/g, ''))));
    const text = await page.locator('main').innerText();
    expect(text).not.toContain('A letter from a quieter tomorrow');
    expect(text).not.toContain('A little light for someone');
    await page.locator('.gift-card', { hasText: 'A pocket-sized universe' }).click();
    await expect(page).toHaveURL(/\/gifts\/3$/);
  });

  test('empty state is an empty wooden shelf, with no instructions', async ({ page }) => {
    const s = await api<{ items: Array<{ day: number }> }>('GET', '/api/gifts');
    for (const it of s.items) await resetDoor(it.day);
    await login(page, '/gifts');
    await expect(page.getByRole('img', { name: 'An empty shelf' })).toBeVisible();
    expect((await page.locator('main').innerText()).replace(/YOUR GIFTS|Your Gifts|Every surprise, kept\./g, '').trim()).toBe('');
    for (const it of s.items) await reveal(it.day);
  });

  test('a past season gift is still reachable at its URL; there is no archive UI', async ({ page }) => {
    const dir = join(state().demoHome, 'seasons', '2025');
    if (!existsSync(dir)) {
      mkdirSync(join(dir, 'doors', '03', 'gift', '.advent'), { recursive: true });
      writeFileSync(join(dir, 'season.json'), JSON.stringify({ schemaVersion: 1, year: 2025, timeZone: 'Europe/Zurich', unlockHour: 0, deliveryMode: 'on_demand', prepareDayBefore: true, connection: { mode: 'portable', permissive: false }, createdAt: '2025-11-20T10:00:00Z', kind: 'live', archivedAt: '2026-01-10T10:00:00Z' }));
      const manifest = { schema: 'advent-agent/gift@1', day: 3, title: 'Last year’s poem', note: 'Kept from last December.', primary: 'poem.md', artifacts: [{ path: 'poem.md', kind: 'document', role: 'primary' }], network: [], incomplete: [] };
      writeFileSync(join(dir, 'doors', '03', 'gift', 'poem.md'), '# Snow\n\nQuiet.');
      const sealed = { manifest, kind: 'document', files: [{ path: 'poem.md', bytes: 15, sha256: 'a'.repeat(64), mime: 'text/markdown', downloadOnly: false }], sealedAt: '2025-12-03T07:00:00Z', attempt: 1, mode: 'portable', verification: { render: 'skipped', renderNotes: [], media: 'skipped', secretScan: 'clean', warnings: [] }, networkConsent: [] };
      writeFileSync(join(dir, 'doors', '03', 'gift', '.advent', 'manifest.sealed.json'), JSON.stringify(sealed));
      writeFileSync(join(dir, 'doors', '03', 'state.json'), JSON.stringify({ schemaVersion: 1, day: 3, jobState: 'ready', attempt: 1, attempts: [{ n: 1, mode: 'portable', startedAt: '2025-12-03T06:00:00Z', endedAt: '2025-12-03T07:00:00Z', outcome: 'ready', gateReports: 0 }], revealed: true, revealedAt: '2025-12-03T08:15:00Z', gift: sealed, updatedAt: '2025-12-03T08:15:00Z' }));
    }
    await login(page, '/gift/2025/3');
    await expect(page.locator('#gift-title')).toHaveText('Last year’s poem');
    await expect(page.locator('.paper-letter')).toContainText('Quiet.');
    await expect(page.getByRole('link', { name: /Archive/ })).toHaveCount(0);
  });
});
