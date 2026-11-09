/** D20/D26: share exports (still, loop) without any mark, the fixed caption, and Save in the gift's natural format. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { testCompanion, type TestCompanion } from '../helpers/companion.js';
import { ffmpegPath, findInstalledChrome } from '../../src/share/capture.js';
import { sniffImage } from '../../src/intake/mime.js';

const hasChrome = Boolean(findInstalledChrome());
let t: TestCompanion;
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const auth = () => ({ authorization: `Bearer ${t.token}` });

const gift = {
  schema: 'advent-agent/gift@2', day: 5, title: 'A jelly persimmon for Maya', note: 'It wobbles like autumn pretending to be summer.', entry: 'index.html',
  emotion: 'cute', interaction: ['squeeze'], downloads: [{ label: 'Wallpaper', file: 'wall.png' }], share: { still: { capture: 'still' }, loop: { capture: 'loop', durationMs: 3000 }, caption: 'My AI Secret Santa made me a jelly persimmon', privateText: ['Maya'] },
};
const page = `<!doctype html><html><body style="margin:0;background:#fde7cf"><h1 id="h">Hello <span data-advent-private>Maya</span></h1><div id="state">idle</div>
<link rel="stylesheet" href="style.css"><script src="app.js"></script><script>window.adventCapture={async prepare(kind){document.getElementById('state').textContent='prepared:'+kind;}};let i=0;setInterval(()=>{document.body.style.background=i++%2?'#fde7cf':'#f6c79c'},200);</script></body></html>`;

beforeAll(async () => {
  t = await testCompanion({ config: { connection: { mode: 'connected', permissive: false } } });
  const r = await t.api<{ ok: boolean; problems: unknown[] }>('POST', '/api/agent/submit?day=5&mode=connected', { files: [{ name: 'gift.json', text: JSON.stringify(gift) }, { name: 'index.html', text: page }, { name: 'style.css', text: 'h1{color:#a00}' }, { name: 'app.js', text: 'window.__app=1;' }, { name: 'wall.png', base64: PNG }] });
  expect(r.data.ok, JSON.stringify(r.data.problems)).toBe(true);
  await t.api('POST', '/api/doors/5/reveal');
}, 60_000);
afterAll(async () => { await t?.close(); });

describe('share exports', () => {
  it('preview carries the fixed caption and the deskmenace.com link, never the gift.json caption', async () => {
    const info = (await t.api<Record<string, unknown>>('GET', '/api/share/5/preview')).data;
    expect(info).toMatchObject({ caption: 'My AI agent made this gift for me 🎁', url: 'https://deskmenace.com', privateText: ['Maya'], browser: hasChrome });
    expect(info.caption).not.toContain('persimmon');
    expect(info).not.toHaveProperty('shareMark');
  });

  it('Save offers the gift itself first, then the agent\'s downloads', async () => {
    const { options } = (await t.api<{ options: Array<{ id: string; label: string; format: string }> }>('GET', '/api/save/5')).data;
    expect(options[0]).toEqual({ id: 'gift', label: 'The gift', format: 'HTML' });
    expect(options.find((o) => o.id === 'file:wall.png')).toMatchObject({ label: 'Wallpaper', format: 'PNG' });
  });

  it('the saved HTML is the gift\'s own page with its assets inlined and nothing added by the calendar', async () => {
    const r = await fetch(`${t.appUrl}/api/save/5/file?id=gift`, { headers: auth() });
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toContain('text/html');
    const html = await r.text();
    expect(html).toContain('h1{color:#a00}');
    expect(html).toContain('window.__app=1;');
    expect(html).not.toContain('style.css');
    for (const ours of ['deskmenace', 'Advent Agent', 'github.com', 'December 5', 'It wobbles like autumn']) expect(html).not.toContain(ours);
    const wall = await fetch(`${t.appUrl}/api/save/5/file?id=file:wall.png`, { headers: auth() });
    expect(wall.headers.get('content-type')).toBe('image/png');
    expect((await fetch(`${t.appUrl}/api/save/5/file?id=file:../secret`, { headers: auth() })).status).toBe(409);
  });

  it.skipIf(!hasChrome)('the still is a 1080×1350 PNG captured after prepare("still")', async () => {
    const r = await fetch(`${t.appUrl}/api/share/5/still?blur=1`, { headers: { authorization: `Bearer ${t.token}` } });
    expect(r.status).toBe(200);
    const png = Buffer.from(await r.arrayBuffer());
    expect(sniffImage(png)).toMatchObject({ format: 'png', width: 1080, height: 1350 });
  }, 60_000);

  it.skipIf(!hasChrome)('the loop records 3 s at 1080×1920 (MP4 with ffmpeg, WebM without)', async () => {
    const r = await fetch(`${t.appUrl}/api/share/5/loop`, { headers: { authorization: `Bearer ${t.token}` } });
    expect(r.status).toBe(200);
    const data = Buffer.from(await r.arrayBuffer());
    expect(data.length).toBeGreaterThan(2000);
    expect(r.headers.get('content-type')).toBe(ffmpegPath() ? 'video/mp4' : 'video/webm');
    const webm = await fetch(`${t.appUrl}/api/share/5/loop?format=webm`, { headers: { authorization: `Bearer ${t.token}` } });
    expect(webm.headers.get('content-type')).toBe('video/webm');
    expect(Buffer.from(await webm.arrayBuffer()).subarray(0, 4).readUInt32BE(0)).toBe(0x1a45dfa3);
  }, 120_000);
});
