import { expect, test } from '@playwright/test';
import { api, login, resetDoor, setDemoDay, state } from './helpers.js';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

test.describe('shelf and archive (E4)', () => {
  test('E4.1 the shelf lists only revealed gifts and never leaks unopened titles', async ({ page }) => {
    await setDemoDay(8);
    await resetDoor(1);
    await resetDoor(2);
    await api('POST', '/api/doors/3/reveal').catch(() => undefined);
    await login(page, '/gifts');
    await expect(page.locator('.shelf-item h2', { hasText: 'A pocket-sized universe' })).toBeVisible();
    const text = await page.locator('main').innerText();
    expect(text).not.toContain('A letter from a quieter tomorrow');
    expect(text).not.toContain('A little light for someone');
    const api2 = await api<{ items: Array<{ day: number }> }>('GET', '/api/gifts');
    expect(api2.items.every((i) => ![1, 2].includes(i.day))).toBe(true);
  });

  test('E4.2 a past season is browsable in the archive with its original dates', async ({ page }) => {
    // Plant a 2025 season with one revealed gift directly in the demo home.
    const s = state();
    const dir = join(s.demoHome, 'seasons', '2025');
    if (!existsSync(dir)) {
      mkdirSync(join(dir, 'doors', '03', 'gift', '.advent'), { recursive: true });
      writeFileSync(join(dir, 'season.json'), JSON.stringify({ schemaVersion: 1, year: 2025, timeZone: 'Europe/Zurich', unlockHour: 0, deliveryMode: 'on_demand', prepareDayBefore: true, connection: { mode: 'portable', permissive: false }, createdAt: '2025-11-20T10:00:00Z', kind: 'live', archivedAt: '2026-01-10T10:00:00Z' }));
      const manifest = { schema: 'advent-agent/gift@1', day: 3, title: 'Last year’s poem', note: 'Kept from last December.', primary: 'poem.md', artifacts: [{ path: 'poem.md', kind: 'document', role: 'primary' }], network: [], incomplete: [] };
      writeFileSync(join(dir, 'doors', '03', 'gift', 'poem.md'), '# Snow\n\nQuiet.');
      const sealed = { manifest, kind: 'document', files: [{ path: 'poem.md', bytes: 15, sha256: 'a'.repeat(64), mime: 'text/markdown', downloadOnly: false }], sealedAt: '2025-12-03T07:00:00Z', attempt: 1, mode: 'portable', verification: { render: 'skipped', renderNotes: [], media: 'skipped', secretScan: 'clean', warnings: [] }, networkConsent: [] };
      writeFileSync(join(dir, 'doors', '03', 'gift', '.advent', 'manifest.sealed.json'), JSON.stringify(sealed));
      writeFileSync(join(dir, 'doors', '03', 'state.json'), JSON.stringify({ schemaVersion: 1, day: 3, jobState: 'ready', attempt: 1, attempts: [{ n: 1, mode: 'portable', startedAt: '2025-12-03T06:00:00Z', endedAt: '2025-12-03T07:00:00Z', outcome: 'ready', gateReports: 0 }], revealed: true, revealedAt: '2025-12-03T08:15:00Z', gift: sealed, updatedAt: '2025-12-03T08:15:00Z' }));
    }
    await login(page, '/archive');
    await expect(page.locator('.shelf-item h2', { hasText: 'Advent 2025' })).toBeVisible();
    await page.locator('.shelf-item', { hasText: 'Advent 2025' }).click();
    await expect(page).toHaveURL(/\/archive\/2025$/);
    await expect(page.locator('.shelf-item h2')).toHaveText('Last year’s poem');
    await expect(page.locator('.shelf-body .date')).toContainText('December 3, 2025');
    await page.locator('.shelf-item').click();
    await expect(page).toHaveURL(/\/gift\/2025\/3$/);
    await expect(page.locator('.paper-letter')).toContainText('Quiet.');
    await expect(page.locator('.verification')).toContainText('December 3, 2025');
  });
});
