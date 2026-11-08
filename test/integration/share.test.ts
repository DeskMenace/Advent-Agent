/** D20/D21: share exports (still, loop, standalone) with the mark and the privacy blur. Uses the installed Chrome/Edge. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { testCompanion, type TestCompanion } from '../helpers/companion.js';
import { ffmpegPath, findInstalledChrome, SHARE_MARK_TEXT } from '../../src/share/capture.js';
import { sniffImage } from '../../src/intake/mime.js';

const hasChrome = Boolean(findInstalledChrome());
let t: TestCompanion;

const gift = {
  schema: 'advent-agent/gift@2', day: 5, title: 'A jelly persimmon for Maya', note: 'It wobbles like autumn pretending to be summer.', entry: 'index.html',
  emotion: 'cute', interaction: ['squeeze'], share: { still: { capture: 'still' }, loop: { capture: 'loop', durationMs: 3000 }, caption: 'My AI Secret Santa made me a jelly persimmon', privateText: ['Maya'] },
};
const page = `<!doctype html><html><body style="margin:0;background:#fde7cf"><h1 id="h">Hello <span data-advent-private>Maya</span></h1><div id="state">idle</div>
<script>window.adventCapture={async prepare(kind){document.getElementById('state').textContent='prepared:'+kind;}};let i=0;setInterval(()=>{document.body.style.background=i++%2?'#fde7cf':'#f6c79c'},200);</script></body></html>`;

beforeAll(async () => {
  t = await testCompanion({ config: { connection: { mode: 'connected', permissive: false } } });
  const r = await t.api<{ ok: boolean; problems: unknown[] }>('POST', '/api/agent/submit?day=5&mode=connected', { files: [{ name: 'gift.json', text: JSON.stringify(gift) }, { name: 'index.html', text: page }] });
  expect(r.data.ok, JSON.stringify(r.data.problems)).toBe(true);
  await t.api('POST', '/api/doors/5/reveal');
}, 60_000);
afterAll(async () => { await t?.close(); });

describe('share exports', () => {
  it('preview lists caption, private text and what can be exported', async () => {
    const info = (await t.api<Record<string, unknown>>('GET', '/api/share/5/preview')).data;
    expect(info).toMatchObject({ caption: gift.share.caption, privateText: ['Maya'], shareMark: true, standalone: true, browser: hasChrome });
  });

  it('the standalone file carries the share mark (text + GitHub link) and, on request, the blur and the note', async () => {
    const plain = await fetch(`${t.appUrl}/api/share/5/standalone`, { headers: { authorization: `Bearer ${t.token}` } });
    const html = await plain.text();
    expect(html).toContain(SHARE_MARK_TEXT);
    expect(html).toContain('https://github.com/suchipizza/Advent-Agent');
    expect(html).toContain('ref=aa-share');
    expect(html).not.toContain('It wobbles like autumn');
    const both = await (await fetch(`${t.appUrl}/api/share/5/standalone?blur=1&note=1`, { headers: { authorization: `Bearer ${t.token}` } })).text();
    expect(both).toContain('data-advent-private]{filter:blur');
    expect(both).toContain('It wobbles like autumn');
  });

  it.skipIf(!hasChrome)('the still is a 1080×1350 PNG captured after prepare("still")', async () => {
    const r = await fetch(`${t.appUrl}/api/share/5/still?blur=1`, { headers: { authorization: `Bearer ${t.token}` } });
    expect(r.status).toBe(200);
    expect(r.headers.get('x-advent-stamped')).toBe('1');
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
