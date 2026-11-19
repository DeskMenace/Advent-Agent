import { expect, test } from '@playwright/test';
import { api, login, resetDoor, setDemoDay } from './helpers.js';

test.describe('Gary (E6)', () => {
  test.beforeEach(async () => { await setDemoDay(8); await api('PUT', '/api/settings', { gary: { show: true } }); });

  test('E6.1 + E6.2 Gary is on the calendar only, from local assets, with a "Hire Gary" credit', async ({ page }) => {
    await login(page);
    await page.goto('/');
    await page.waitForFunction(() => Boolean((window as unknown as { Gary?: unknown }).Gary), null, { timeout: 15_000 });
    const script = page.locator('script[src*="gary"]');
    expect(await script.getAttribute('src')).toBe('/vendor/gary/dist/gary.core.js');
    const requests: string[] = [];
    page.on('request', (r) => requests.push(r.url()));
    await page.waitForTimeout(2500);
    expect(requests.every((u) => u.startsWith('http://127.0.0.1:'))).toBe(true);
    // The overlay is a host element appended to <html>; its shadow root holds the menu.
    const hasHost = await page.evaluate(() => Array.from(document.documentElement.children).some((el) => el.shadowRoot !== null && el.tagName !== 'BODY' && el.tagName !== 'HEAD'));
    expect(hasHost).toBe(true);
    // The character manifest carries our credit (the menu is built from it).
    const menuCredit = await page.evaluate(async () => {
      const r = await fetch('/vendor/gary/characters/gary/character.json');
      return r.ok;
    });
    expect(menuCredit).toBe(true);
    // Open the options menu through the keyboard-accessible options button inside the shadow root.
    const credit = await page.evaluate(async () => {
      const host = Array.from(document.documentElement.children).find((el) => el.shadowRoot !== null && !['BODY', 'HEAD'].includes(el.tagName)) as HTMLElement | undefined;
      const root = host?.shadowRoot;
      if (!root) return null;
      const btn = root.querySelector('button') as HTMLButtonElement | null;
      btn?.click();
      await new Promise((r) => setTimeout(r, 200));
      const link = Array.from(root.querySelectorAll('a')).find((a) => /Hire Gary/i.test(a.textContent ?? ''));
      return link ? { text: link.textContent, href: link.getAttribute('href') } : Array.from(root.querySelectorAll('a,button,[role=menuitem]')).map((e) => e.textContent).join('|');
    });
    expect(credit).toMatchObject({ text: expect.stringMatching(/Hire Gary/), href: 'https://deskmenace.com/?ref=aa-gary' });
    // Not on other pages.
    for (const path of ['/gifts', '/settings', '/gifts/8']) {
      await api('POST', '/api/doors/8/reveal').catch(() => undefined);
      await page.goto(path);
      await page.waitForTimeout(500);
      const hostOnPage = await page.evaluate(() => Array.from(document.documentElement.children).some((el) => el.shadowRoot !== null && !['BODY', 'HEAD'].includes(el.tagName)));
      expect(hostOnPage, path).toBe(false);
    }
  });

  test('E6.3 "send home" persists for the day and clears the next day', async ({ page }) => {
    await login(page);
    await page.goto('/');
    await page.waitForFunction(() => Boolean((window as unknown as { Gary?: unknown }).Gary), null, { timeout: 15_000 });
    await page.evaluate(() => (window as unknown as { Gary: { dismiss(): void } }).Gary.dismiss());
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => localStorage.getItem('gary.js:dismissed'))).not.toBeNull();
    expect(await page.evaluate(() => localStorage.getItem('advent-agent.gary.sentHomeOn'))).toBe(new Date().toISOString().slice(0, 10));
    await page.reload();
    await page.waitForTimeout(2500);
    expect(await page.evaluate(() => localStorage.getItem('gary.js:dismissed'))).not.toBeNull();
    // Pretend the dismissal happened yesterday → he comes back.
    await page.evaluate(() => localStorage.setItem('advent-agent.gary.sentHomeOn', '2000-01-01'));
    await page.reload();
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => localStorage.getItem('gary.js:dismissed'))).toBeNull();
  });

  test('E6.4 the setting hides him', async ({ page }) => {
    await api('PUT', '/api/settings', { gary: { show: false } });
    await login(page);
    await page.goto('/');
    await page.waitForTimeout(1500);
    expect(await page.locator('script[src*="gary"]').count()).toBe(0);
    await api('PUT', '/api/settings', { gary: { show: true } });
  });
});

test.describe('nothing from the makers in a gift (D26, D34)', () => {
  test('a revealed gift carries no voucher: no promo in the API response, no slip on the gift page', async ({ page }) => {
    await setDemoDay(8);
    await resetDoor(6);
    await api('POST', '/api/doors/6/reveal');
    const revealed = await api('GET', '/api/doors/6/gift');
    expect(JSON.stringify(revealed)).not.toMatch(/promo|voucher/i);
    await login(page, '/gifts/6');
    await expect(page.locator('#gift-title')).toBeVisible();
    await expect(page.locator('.slip')).toHaveCount(0);
  });
});
