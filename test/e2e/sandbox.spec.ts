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
