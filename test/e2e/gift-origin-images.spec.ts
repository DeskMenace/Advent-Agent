import { expect, test } from '@playwright/test';
import { login, reveal, setDemoDay } from './helpers.js';

/** The gift origin is another port. Its images must still load in the calendar (thumbnails on the board and the shelf, media on the gift page). */
test.describe('images from the gift origin load in the calendar', () => {
  test.beforeAll(async () => { await setDemoDay(24); for (let d = 1; d <= 11; d++) await reveal(d); });
  test.afterAll(async () => { await setDemoDay(8); });

  for (const path of ['/', '/gifts', '/gifts/4']) {
    test(`${path}: every image served by the gift origin has loaded`, async ({ page }) => {
      const failed: string[] = [];
      page.on('requestfailed', (r) => { if (r.resourceType() === 'image') failed.push(`${r.failure()?.errorText} ${r.url().replace(/\/g\/[^/]+\//, '/g/…/')}`); });
      await login(page, path);
      await page.waitForTimeout(1500);
      await page.locator('img').evaluateAll((imgs) => imgs.forEach((i) => ((i as HTMLImageElement).loading = 'eager')));
      await page.waitForTimeout(1500);
      const broken = await page.locator('img[src*="/g/"]').evaluateAll((imgs) => imgs.filter((i) => !(i as HTMLImageElement).complete || (i as HTMLImageElement).naturalWidth === 0).map((i) => (i as HTMLImageElement).src.replace(/\/g\/[^/]+\//, '/g/…/')));
      expect(failed, 'blocked image requests').toEqual([]);
      expect(broken, 'images that did not load').toEqual([]);
    });
  }
});
