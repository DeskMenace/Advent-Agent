import { expect, test } from '@playwright/test';
import { api, login, setDemoDay, state } from './helpers.js';

test.describe('gift sandbox (E3)', () => {
  test('a gift cannot reach the parent document, storage, the app API, the network, or navigate the top window', async ({ page }) => {
    await setDemoDay(24);
    await api('POST', '/api/doors/11/reveal').catch(() => undefined);
    await login(page, `/gift/2026/11`);
    const frame = page.frameLocator('iframe.gift-frame');
    await frame.getByRole('button', { name: 'Try the doors' }).click();
    await expect(frame.locator('li[data-probe="done"]')).toBeVisible({ timeout: 15_000 });
    const results = await frame.locator('li[data-probe]').evaluateAll((els) => Object.fromEntries(els.map((e) => [(e as HTMLElement).dataset.probe, (e as HTMLElement).dataset.result])));
    expect(results['parent-document']).toBe('locked');
    expect(results['local-storage']).toBe('locked');
    expect(results['calendar-api']).toBe('locked');
    expect(results['app-origin-fetch']).toBe('locked');
    expect(results['remote-image']).toBe('locked');
    expect(results['top-navigation']).toBe('locked');
    await expect(page).toHaveURL(/\/gift\/2026\/11$/);
    await setDemoDay(8);
  });

  test('gift files carry a strict CSP, CORP and no cookies; the app origin never frames itself', async ({ page }) => {
    await login(page, '/gift/2026/5');
    const src = await page.locator('iframe.gift-frame').getAttribute('src');
    const r = await fetch(src!);
    const csp = r.headers.get('content-security-policy') ?? '';
    expect(csp).toContain("connect-src 'none'");
    expect(csp).toContain(`frame-ancestors http://127.0.0.1:${state().appPort}`);
    expect(r.headers.get('cross-origin-resource-policy')).toBe('same-site');
    expect(r.headers.get('set-cookie')).toBeNull();
    const app = await fetch(`http://127.0.0.1:${state().appPort}/`);
    expect(app.headers.get('x-frame-options')).toBe('DENY');
  });
});

test.describe('agent text sanitisation (U4.7)', () => {
  test('HTML in a title, subtitle or note is shown as text, never executed or injected', async ({ page }) => {
    await setDemoDay(24);
    const { writeFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const dir = join(state().demoHome, 'seasons', '2026', 'doors', '17');
    writeFileSync(join(dir, 'state.json'), JSON.stringify({ schemaVersion: 1, day: 17, jobState: 'not_requested', attempt: 0, attempts: [], revealed: false, updatedAt: new Date().toISOString() }));
    const hostile = '<img src=x onerror="window.__pwned=1"><script>window.__pwned=2</script>';
    const manifest = { schema: 'advent-agent/gift@1', day: 17, title: `Title ${hostile}`, subtitle: `Sub <b onclick="window.__pwned=3">bold</b>`, note: `Hello **friend** ${hostile} [link](javascript:alert(1)) [ok](https://example.com)`, primary: 'letter.md', artifacts: [{ path: 'letter.md', kind: 'document' }] };
    const r = await api<{ ok: boolean; problems: unknown[] }>('POST', '/api/agent/submit?day=17', { files: [{ name: 'gift.json', text: JSON.stringify(manifest) }, { name: 'letter.md', text: `# Letter\n\n${hostile}\n\nplain` }] });
    expect(r.ok, JSON.stringify(r.problems)).toBe(true);
    await api('POST', '/api/doors/17/reveal');
    await login(page, '/gift/2026/17');
    await expect(page.locator('h1.gift-title')).toContainText('<img src=x onerror=');
    await expect(page.locator('.note strong')).toHaveText('friend');
    await expect(page.locator('.note')).toContainText('<script>');
    expect(await page.locator('.note a').evaluateAll((as) => as.map((a) => a.getAttribute('href')))).toEqual(['https://example.com']);
    expect(await page.locator('main img[src="x"], main script, main b[onclick]').count()).toBe(0);
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined();
    await setDemoDay(8);
  });
});
