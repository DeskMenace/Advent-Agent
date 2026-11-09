import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { api, login, reveal, setDemoDay, submitGift } from './helpers.js';

/** Open the Save menu on the gift page and return its items as "label format". */
async function saveItems(page: Page): Promise<string[]> {
  await page.getByRole('button', { name: 'Save' }).click();
  const items = page.getByRole('menuitem');
  await expect(items.first()).toBeVisible();
  return items.evaluateAll((els) => els.map((e) => (e as HTMLElement).innerText.replace(/\s+/g, ' ').trim()));
}

async function saveFirst(page: Page): Promise<{ name: string; body: Buffer }> {
  const dl = page.waitForEvent('download');
  await page.getByRole('menuitem').first().click();
  const d = await dl;
  return { name: d.suggestedFilename(), body: readFileSync((await d.path())!) };
}

test.describe('gift page and renderers (E2, D26)', () => {
  test.beforeAll(async () => { await setDemoDay(24); for (let d = 1; d <= 11; d++) await reveal(d); });
  test.afterAll(async () => { await setDemoDay(8); });

  test('interactive HTML runs sandboxed; Save gives the gift\'s own HTML and its motion as video', async ({ page }) => {
    await login(page, '/gifts/5');
    const frame = page.frameLocator('iframe.gift-frame');
    await frame.getByRole('button', { name: 'Shake the globe' }).click();
    await expect(frame.locator('#count')).toHaveText('1 shake');
    await page.getByRole('button', { name: 'Start again' }).click();
    await expect(frame.locator('#count')).toHaveText('0 shakes');
    await expect(page.getByRole('button', { name: 'Full screen' })).toBeVisible();
    await expect(page.locator('.gift-view')).not.toContainText(/interactive|runs in a sandbox/i);
    const items = await saveItems(page);
    expect(items[0]).toBe('The gift HTML');
    expect(items.some((i) => /^Video (MP4|WEBM)$/.test(i))).toBe(true);
    const saved = await saveFirst(page);
    expect(saved.name).toBe('advent-day-5-your-personal-snow-globe.html');
    const html = saved.body.toString('utf8');
    expect(html).toContain('Shake the globe');
    for (const ours of ['deskmenace', 'Advent Agent', 'December 5', 'Made by my']) expect(html).not.toContain(ours);
  });

  test('image: rendered from the gift origin; Save gives the image file itself', async ({ page }) => {
    await login(page, '/gifts/4');
    const img = page.locator('img.gift-image');
    await expect(img).toBeVisible();
    expect(await img.getAttribute('src')).toMatch(/^http:\/\/127\.0\.0\.1:4725\/g\//);
    expect(await saveItems(page)).toEqual(['Image SVG']);
    const saved = await saveFirst(page);
    expect(saved.name).toMatch(/\.svg$/);
    expect(saved.body.toString('utf8')).toContain('<svg');
  });

  test('audio: native controls, no autoplay, no calendar caption; Save gives the WAV', async ({ page }) => {
    await login(page, '/gifts/6');
    const audio = page.locator('audio');
    await expect(audio).toHaveAttribute('controls', '');
    expect(await audio.evaluate((a: HTMLAudioElement) => a.paused && !a.hasAttribute('autoplay'))).toBe(true);
    await expect(page.locator('.player')).not.toContainText(/original audio/i);
    expect(await saveItems(page)).toEqual(['Audio WAV']);
    expect((await saveFirst(page)).name).toMatch(/\.wav$/);
  });

  test('video: inline with captions, no "plays inline" label; Save gives the MP4', async ({ page }) => {
    await login(page, '/gifts/3');
    const video = page.locator('video');
    await expect(video).toHaveAttribute('controls', '');
    await expect(page.locator('video track')).toHaveCount(1);
    await expect(page.locator('.video-label')).toHaveCount(0);
    expect(await saveItems(page)).toEqual(['Video MP4']);
    expect((await saveFirst(page)).name).toMatch(/\.mp4$/);
  });

  test('document: markdown as text on paper (no raw HTML); Save gives plain text', async ({ page }) => {
    await login(page, '/gifts/1');
    await expect(page.locator('.paper-letter')).toContainText('A small thing you are worried about today');
    expect(await page.locator('.paper-letter script').count()).toBe(0);
    expect(await saveItems(page)).toEqual(['Text TXT']);
    const saved = await saveFirst(page);
    expect(saved.name).toMatch(/\.txt$/);
    expect(saved.body.toString('utf8')).toContain('A small thing you are worried about today');
  });

  test('card: the SVG; Save gives the image, then the agent\'s print file', async ({ page }) => {
    await login(page, '/gifts/2');
    await expect(page.locator('img.card-svg')).toBeVisible();
    const items = await saveItems(page);
    expect(items[0]).toBe('Image SVG');
    expect(items[1]).toMatch(/ PDF$/); // the agent's print file, under the agent's own label
  });

  test('song: the player plays the score; no calendar tech line; Save gives the WAV once', async ({ page }) => {
    await login(page, '/gifts/7');
    await page.getByRole('button', { name: '▶ Play' }).click();
    await expect(page.getByRole('button', { name: '■ Stop' })).toBeVisible();
    await page.getByRole('button', { name: '■ Stop' }).click();
    await expect(page.locator('.player')).not.toContainText('BPM');
    await expect(page.locator('.sheet .control-label')).toHaveCount(0); // headings inside the sheet are the agent's own
    const items = await saveItems(page);
    expect(items[0]).toBe('Audio WAV');
    expect(items.filter((i) => /WAV$/.test(i))).toHaveLength(1);
    expect(await page.locator('main').innerText()).not.toMatch(/\b(suno|udio|elevenlabs)\b/i);
  });

  test('real-world: only the agent\'s details and note, never "bought", no "what\'s left"; Save gives a bare reference page', async ({ page }) => {
    await login(page, '/gifts/8');
    await expect(page.locator('.rw-item h3')).toHaveText(/Field Guide/);
    await expect(page.locator('.rw-price')).toHaveText('12.99 GBP');
    await expect(page.locator('.gift-view')).not.toContainText(/What.s left for you|yours to decide|Price checked on/);
    await expect(page.getByLabel(/I bought it/)).toHaveCount(0);
    expect((await page.locator('.gift-view').innerText()).toLowerCase()).not.toMatch(/\b(bought|ordered|booked)\b/);
    expect(await saveItems(page)).toEqual(['Reference HTML']);
    const html = (await saveFirst(page)).body.toString('utf8');
    expect(html).toContain('Field Guide');
    expect(html).not.toMatch(/What.s left|Advent Agent|deskmenace|Prepared by an AI/);
  });

  test('links open in a new tab; unknown kinds fall back to a file list with no calendar sentence', async ({ page }) => {
    await login(page, '/gifts/9');
    const links = page.locator('.links-list a');
    await expect(links).toHaveCount(3);
    await expect(links.first()).toHaveAttribute('rel', /noopener/);
    await login(page, '/gifts/10');
    await expect(page.locator('.files-list li')).toHaveCount(3);
    await expect(page.locator('.gift-view')).not.toContainText('The calendar does not run them');
  });
});

test.describe('the note is the agent\'s alone (D26)', () => {
  test.beforeAll(async () => { await setDemoDay(24); });
  test.afterAll(async () => { await setDemoDay(8); });

  test('shown in a terminal panel, typed out, signed only when the agent signed', async ({ page }) => {
    const page1 = '<!doctype html><html><body><p>a gift</p></body></html>';
    await submitGift(21, [{ name: 'gift.json', text: JSON.stringify({ schema: 'advent-agent/gift@1', day: 21, title: 'Signed', note: 'I made this because you laugh at pigeons.', signature: 'Pip', primary: 'index.html', artifacts: [{ path: 'index.html', kind: 'interactive-html' }] }) }, { name: 'index.html', text: page1 }], { reveal: true });
    await login(page, '/gifts/21');
    const note = page.locator('.agent-note');
    await expect(note.locator('.term-bar span')).toHaveCount(3);
    await expect(note.locator('.term-prompt')).toHaveText('$ cat note.txt');
    await expect(note.locator('.term-text')).toHaveText('I made this because you laugh at pigeons.', { timeout: 5000 });
    await expect(note.locator('.term-sign')).toHaveText('— Pip');
    expect(await note.evaluate((el) => getComputedStyle(el.querySelector('.term-body')!).fontFamily)).toMatch(/mono|Menlo|Consolas/i);

    await submitGift(22, [{ name: 'gift.json', text: JSON.stringify({ schema: 'advent-agent/gift@1', day: 22, title: 'Unsigned', note: 'No name today.', primary: 'index.html', artifacts: [{ path: 'index.html', kind: 'interactive-html' }] }) }, { name: 'index.html', text: page1 }], { reveal: true });
    await login(page, '/gifts/22');
    await expect(page.locator('.term-text')).toHaveText('No name today.', { timeout: 5000 });
    await expect(page.locator('.term-sign')).toHaveCount(0);
    await expect(page.locator('.gift-view')).not.toContainText(/gift-maker|your Secret Santa/i);
  });

  test('no note in gift.json → nothing; a loose drop gets no invented note', async ({ page }) => {
    await submitGift(23, [{ name: 'gift.json', text: JSON.stringify({ schema: 'advent-agent/gift@1', day: 23, title: 'Silent', primary: 'index.html', artifacts: [{ path: 'index.html', kind: 'interactive-html' }] }) }, { name: 'index.html', text: '<p>x</p>' }], { reveal: true });
    await login(page, '/gifts/23');
    await expect(page.locator('#gift-title')).toHaveText('Silent');
    await expect(page.locator('.agent-note')).toHaveCount(0);
    await submitGift(24, [{ name: 'toy.html', text: '<!doctype html><html><head><title>Loose toy</title></head><body>hi</body></html>' }], { reveal: true });
    const g = await api<{ gift: { manifest: { note?: string; category?: string } } }>('GET', '/api/doors/24/gift');
    expect(g.gift.manifest.note).toBeUndefined();
    expect(g.gift.manifest.category).toBeUndefined();
    await login(page, '/gifts/24');
    await expect(page.locator('.agent-note')).toHaveCount(0);
  });

  test('a tool gift shows its terminal page and note; followUp never appears; Save gives the tool zip (D27)', async ({ page }) => {
    const manifest = {
      schema: 'advent-agent/gift@2', day: 21, title: 'Snow in your terminal', family: 'small-tools', form: 'tool', emotion: 'cute', interaction: ['run'],
      entry: 'index.html', share: { still: { capture: 'still' } }, note: 'It snows harder on Fridays. If you want, I can make it start with every new tab.',
      followUp: { offer: 'Snow on every new tab', prompt: 'Turn my Advent Agent gift from December 21 (<gift folder path>) into snow on every new terminal tab.' },
    };
    const terminal = '<!doctype html><html><body style="background:#16181d;color:#e8e6df;font-family:monospace"><pre id="out">$ snow\n  *   .  *\n .  *    .</pre><script>window.adventCapture={async prepare(){}}</script></body></html>';
    await submitGift(21, [
      { name: 'gift.json', text: JSON.stringify(manifest) }, { name: 'index.html', text: terminal },
      { name: 'tool/snow.py', text: 'import sys, time, random\n# quits cleanly on Ctrl+C\n' }, { name: 'tool/README.md', text: '# Snow\n\nRun: python3 snow.py\n\nUninstall: delete the alias line from ~/.zshrc.\n' },
    ], { reveal: true });
    await login(page, '/gifts/21');
    await expect(page.frameLocator('iframe.gift-frame').locator('#out')).toContainText('$ snow');
    await expect(page.locator('.term-text')).toHaveText(manifest.note, { timeout: 8000 });
    const text = await page.locator('main').innerText();
    expect(text).not.toContain('Snow on every new tab');
    expect(text).not.toContain('snow.py');
    const items = await saveItems(page);
    expect(items[0]).toBe('The tool ZIP');
    const saved = await saveFirst(page);
    expect(saved.name).toBe('advent-day-21-snow-in-your-terminal.zip');
    expect(saved.body.subarray(0, 2).toString('latin1')).toBe('PK');
  });

  test('reduced motion shows the whole note at once', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await login(page, '/gifts/1');
    await expect(page.locator('.term-text')).toContainText('The first door should be gentle', { timeout: 300 });
    await ctx.close();
  });
});
