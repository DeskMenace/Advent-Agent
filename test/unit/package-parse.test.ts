import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync, createWriteStream } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import yazl from 'yazl';
import { runGate, sealGift, readSealedGift } from '../../src/intake/gate.js';
import { GiftManifestSchema } from '../../src/shared/gift.js';
import { buildGiftJsonSchema } from '../../scripts/gen-schema.js';

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'aa-pkg-')); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

const PNG_1x1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

async function zipOf(files: Record<string, string | Buffer>, name = 'gift.zip'): Promise<string> {
  const zip = new yazl.ZipFile();
  for (const [p, data] of Object.entries(files)) zip.addBuffer(Buffer.isBuffer(data) ? data : Buffer.from(data), p);
  zip.end();
  const out = join(dir, name);
  await new Promise<void>((res) => zip.outputStream.pipe(createWriteStream(out)).on('close', () => res()));
  return out;
}

const html = '<!doctype html><html><head><title>Snow globe</title></head><body><button id="shake">Shake</button><script>document.getElementById("shake").onclick=()=>{};</script></body></html>';

describe('package forms', () => {
  it('U3.1 form A: zip with gift.json', async () => {
    const manifest = { schema: 'advent-agent/gift@1', day: 7, title: 'The Snow Globe', category: 'Interactive toy', note: 'Shake gently.', primary: 'index.html', artifacts: [{ path: 'index.html', kind: 'interactive-html' }, { path: 'assets/globe.png', kind: 'image', role: 'download', alt: 'globe' }] };
    const zip = await zipOf({ 'gift.json': JSON.stringify(manifest), 'index.html': html, 'assets/globe.png': PNG_1x1 });
    const r = await runGate({ type: 'zip', file: zip }, { day: 7, render: false });
    expect(r.problems.filter((p) => p.severity === 'error')).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.form).toBe('A');
    expect(r.kind).toBe('interactive-html');
    expect(r.manifest?.title).toBe('The Snow Globe');
    const giftDir = join(dir, 'gift');
    const sealed = sealGift(r, giftDir, { attempt: 1, mode: 'launched', adapter: 'claude-code' });
    expect(sealed.files.map((f) => f.path).sort()).toEqual(['assets/globe.png', 'gift.json', 'index.html']);
    expect(sealed.files.every((f) => f.sha256.length === 64)).toBe(true);
    expect(readSealedGift(giftDir)?.manifest.day).toBe(7);
    expect(readFileSync(join(giftDir, 'index.html'), 'utf8')).toBe(html);
  });

  it('form A: zip of a folder (nested one level) is accepted and paths are rebased', async () => {
    const manifest = { day: 2, title: 'Nested', note: 'n', primary: 'index.html', artifacts: [{ path: 'index.html', kind: 'interactive-html' }] };
    const zip = await zipOf({ 'gift/gift.json': JSON.stringify(manifest), 'gift/index.html': html });
    const r = await runGate({ type: 'zip', file: zip }, { day: 2, render: false });
    expect(r.ok).toBe(true);
    expect(r.manifest?.primary).toBe('gift/index.html');
  });

  it('U3.2 form B: single HTML with an embedded manifest', async () => {
    const embedded = html.replace('</head>', `<script type="application/advent-gift+json">${JSON.stringify({ schema: 'advent-agent/gift@1', day: 7, title: 'Embedded', note: 'hi' })}</script></head>`);
    const file = join(dir, 'gift.html');
    writeFileSync(file, embedded);
    const r = await runGate({ type: 'file', file }, { day: 7, render: false });
    expect(r.ok).toBe(true);
    expect(r.form).toBe('B');
    expect(r.manifest?.title).toBe('Embedded');
    expect(r.manifest?.primary).toBe('gift.html');
    expect(r.kind).toBe('interactive-html');
  });

  it('U3.2 form B without a manifest: title from <title>, day required', async () => {
    const file = join(dir, 'toy.html');
    writeFileSync(file, html);
    const noDay = await runGate({ type: 'file', file }, { render: false });
    expect(noDay.ok).toBe(false);
    expect(noDay.needsDay).toBe(true);
    const r = await runGate({ type: 'file', file }, { day: 3, render: false });
    expect(r.ok).toBe(true);
    expect(r.manifest?.title).toBe('Snow globe');
    expect(r.manifest?.day).toBe(3);
  });

  it('U3.3 form C: text paste becomes a document; # Title is the title', async () => {
    const r = await runGate({ type: 'text', text: '# A letter from tomorrow\n\nDear you,\n\nAll is well.' }, { day: 1, render: false });
    expect(r.ok).toBe(true);
    expect(r.form).toBe('C');
    expect(r.kind).toBe('document');
    expect(r.manifest?.title).toBe('A letter from tomorrow');
    const plain = await runGate({ type: 'text', text: 'just a poem\nwith lines' }, { day: 1, render: false });
    expect(plain.manifest?.title).toBe('A letter for you');
  });

  it('U3.4 form D: loose media → minimal manifest', async () => {
    const r = await runGate({ type: 'files', entries: [{ name: 'winter-wallpaper.png', data: PNG_1x1 }, { name: 'notes.pdf', data: Buffer.from('%PDF-1.4 fake') }] }, { day: 5, render: false });
    expect(r.ok).toBe(true);
    expect(r.form).toBe('D');
    expect(r.kind).toBe('image');
    expect(r.manifest?.title).toBe('Winter wallpaper');
    expect(r.manifest?.artifacts).toHaveLength(2);
    const noDay = await runGate({ type: 'files', entries: [{ name: 'a.png', data: PNG_1x1 }] }, { render: false });
    expect(noDay.needsDay).toBe(true);
  });

  it('U3.5 missing required fields are reported; extra fields tolerated; day mismatch rejected', async () => {
    const zip = await zipOf({ 'gift.json': JSON.stringify({ day: 7, artifacts: [], somethingExtra: true }), 'index.html': html });
    const r = await runGate({ type: 'zip', file: zip }, { day: 7, render: false });
    expect(r.ok).toBe(false);
    expect(r.problems.map((p) => p.code)).toContain('manifest_invalid');
    expect(r.problems.some((p) => p.message.includes('title'))).toBe(true);
    expect(r.problems.some((p) => p.message.includes('note'))).toBe(true);
    const ok = await zipOf({ 'gift.json': JSON.stringify({ day: 7, title: 'T', note: 'N', primary: 'index.html', artifacts: [{ path: 'index.html', kind: 'interactive-html' }], extra: 1 }), 'index.html': html }, 'ok.zip');
    expect((await runGate({ type: 'zip', file: ok }, { day: 7, render: false })).ok).toBe(true);
    expect((await runGate({ type: 'zip', file: ok }, { day: 8, render: false })).problems.map((p) => p.code)).toContain('day_mismatch');
  });

  it('missing files named in the manifest are errors', async () => {
    const zip = await zipOf({ 'gift.json': JSON.stringify({ day: 1, title: 'T', note: 'N', primary: 'index.html', artifacts: [{ path: 'index.html', kind: 'interactive-html' }, { path: 'assets/missing.png', kind: 'image' }] }), 'index.html': html });
    const r = await runGate({ type: 'zip', file: zip }, { day: 1, render: false });
    expect(r.ok).toBe(false);
    expect(r.problems.find((p) => p.code === 'file_missing')?.path).toBe('assets/missing.png');
  });

  it('real-world proposals need fields and must never claim a purchase (D1)', async () => {
    const base = { day: 9, title: 'A book', note: 'I found this for you.', artifacts: [] as unknown[] };
    const good = { ...base, realWorld: { items: [{ name: 'Book', vendor: 'Shop', url: 'https://shop.example/book', price: 20, currency: 'CHF', checkedAt: '2026-12-09' }], whatsLeft: 'Click the link and pay. Nothing has been ordered.' } };
    const r = await runGate({ type: 'files', entries: [{ name: 'gift.json', data: Buffer.from(JSON.stringify(good)) }] }, { day: 9, render: false });
    expect(r.ok).toBe(true);
    expect(r.kind).toBe('real-world');
    const bad = { ...good, note: 'I bought this for you.' };
    const rb = await runGate({ type: 'files', entries: [{ name: 'gift.json', data: Buffer.from(JSON.stringify(bad)) }] }, { day: 9, render: false });
    expect(rb.ok).toBe(false);
    expect(rb.problems.map((p) => p.code)).toContain('purchase_claim');
    const missing = { ...base, realWorld: { items: [{ name: 'Book', vendor: 'Shop', url: 'http://insecure.example', checkedAt: 'yesterday' }], whatsLeft: 'x' } };
    const rm = await runGate({ type: 'files', entries: [{ name: 'gift.json', data: Buffer.from(JSON.stringify(missing)) }] }, { day: 9, render: false });
    expect(rm.ok).toBe(false);
    expect(rm.problems.some((p) => p.message.includes('https'))).toBe(true);
  });

  it('U3.6 schema/gift.schema.json is in sync with the zod schema', () => {
    const onDisk = JSON.parse(readFileSync(join(process.cwd(), 'schema/gift.schema.json'), 'utf8'));
    expect(onDisk).toEqual(buildGiftJsonSchema());
    expect(GiftManifestSchema.safeParse({ schema: 'advent-agent/gift@1', day: 1, title: 't', note: 'n' }).success).toBe(true);
  });

  it('song gifts need a parsable score with tracks and tempo', async () => {
    const score = JSON.stringify({ tempo: 96, key: 'C', tracks: [{ voice: 'music-box', notes: [{ t: 0, p: 60, d: 0.5 }] }] });
    const files = { 'gift.json': JSON.stringify({ day: 11, title: 'Music box', note: 'Wind it up.', primary: 'index.html', artifacts: [{ path: 'index.html', kind: 'interactive-html' }], song: { score: 'score.json', renderSheet: 'render-it-yourself.md' } }), 'index.html': html, 'score.json': score, 'render-it-yourself.md': '# Render it yourself\n\nLyrics…' };
    const r = await runGate({ type: 'zip', file: await zipOf(files) }, { day: 11, render: false });
    expect(r.ok).toBe(true);
    expect(r.kind).toBe('song');
    const broken = await runGate({ type: 'zip', file: await zipOf({ ...files, 'score.json': '{"tracks": []}' }, 'b.zip') }, { day: 11, render: false });
    expect(broken.ok).toBe(false);
    expect(broken.problems.map((p) => p.code)).toEqual(expect.arrayContaining(['score_tracks', 'score_tempo']));
  });

  it('a folder submission works too', async () => {
    const folder = join(dir, 'giftfolder');
    mkdirSync(folder);
    writeFileSync(join(folder, 'gift.json'), JSON.stringify({ day: 4, title: 'Folder', note: 'n', primary: 'index.html', artifacts: [{ path: 'index.html', kind: 'interactive-html' }] }));
    writeFileSync(join(folder, 'index.html'), html);
    const r = await runGate({ type: 'folder', path: folder }, { day: 4, render: false });
    expect(r.ok).toBe(true);
  });
});
