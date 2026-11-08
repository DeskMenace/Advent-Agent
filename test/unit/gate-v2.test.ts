/** gift@2 quality-gate rules (SPEC_CHANGES "check_gift additionally fails on"). */
import { describe, expect, it } from 'vitest';
import { runGate } from '../../src/intake/gate.js';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const html = (extra = '') => `<!doctype html><html><body><button>Squeeze</button><script>window.adventCapture={async prepare(k){}};${extra}</script></body></html>`;
const base = { schema: 'advent-agent/gift@2', day: 5, title: 'A jelly persimmon', note: 'It wobbles like autumn.', entry: 'index.html', emotion: 'cute', interaction: ['squeeze'], tierUsed: 'M', ideaId: 'jelly-fruit', family: 'tactile-toys', share: { still: { capture: 'still' }, caption: 'My AI Secret Santa made me a jelly persimmon' } };
const gate = (manifest: Record<string, unknown>, files: Record<string, string | Buffer> = { 'index.html': html() }) =>
  runGate({ type: 'files', entries: [{ name: 'gift.json', data: Buffer.from(JSON.stringify(manifest)) }, ...Object.entries(files).map(([name, d]) => ({ name, data: Buffer.isBuffer(d) ? d : Buffer.from(d) }))] }, { day: 5, render: false });
const codes = (r: { problems: Array<{ code: string; severity: string }> }) => r.problems.filter((x) => x.severity === 'error').map((x) => x.code);

describe('gift@2 gate', () => {
  it('a complete gift@2 passes; `entry` stands in for `primary`', async () => {
    const r = await gate(base);
    expect(codes(r)).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.manifest?.primary).toBe('index.html');
    expect(r.kind).toBe('interactive-html');
  });
  it('fails without a share frame, emotion or interaction', async () => {
    const { share: _s, emotion: _e, interaction: _i, ...rest } = base;
    expect(codes(await gate(rest))).toEqual(expect.arrayContaining(['share_missing', 'emotion_missing', 'interaction_missing']));
  });
  it('a share.png must exist; a capture frame wants a hook (warning)', async () => {
    expect(codes(await gate({ ...base, share: { still: 'share.png' } }))).toContain('share_file_missing');
    expect((await gate({ ...base, share: { still: 'share.png' } }, { 'index.html': html(), 'share.png': PNG })).ok).toBe(true);
    const noHook = await gate(base, { 'index.html': '<!doctype html><html><body>hi</body></html>' });
    expect(noHook.problems.find((x) => x.code === 'capture_hook_missing')?.severity).toBe('warning');
  });
  it('fails on network requests in the HTML or scripts', async () => {
    expect(codes(await gate(base, { 'index.html': html("fetch('data.json')") }))).toContain('network_request');
    expect(codes(await gate(base, { 'index.html': html(), 'app.js': 'new WebSocket("wss://x")' }))).toContain('network_request');
    expect(codes(await gate(base, { 'index.html': html().replace('<button>', '<img src="https://img.example/a.png"><button>') }))).toContain('remote_media');
  });
  it('fails on credits with a licence that may not be copied', async () => {
    expect(codes(await gate({ ...base, credits: [{ what: 'flower shader', source: 'OpenProcessing', license: 'CC BY-NC-SA 3.0' }] }))).toContain('credit_license');
    expect(codes(await gate({ ...base, credits: [{ what: 'envelope', source: 'React Bits', license: 'MIT + Commons Clause' }] }))).toContain('credit_license');
    expect(codes(await gate({ ...base, credits: [{ what: 'CSS 3D envelope', source: 'CSS 3D Lab', license: 'MIT', url: 'https://github.com/Evirtual/css-3d-lab' }, { what: 'chime', source: 'freesound', license: 'CC0' }, { what: 'font', source: 'Google Fonts', license: 'OFL-1.1' }] }))).toEqual([]);
  });
  it('fails on bought/ordered/booked anywhere, even negated', async () => {
    expect(codes(await gate({ ...base, note: 'Nothing has been ordered, promise.' }))).toContain('purchase_claim');
    expect(codes(await gate({ ...base, share: { ...base.share, caption: 'I booked us a table' } }))).toContain('purchase_claim');
    expect(codes(await gate({ ...base, note: 'Open the link if you want it. The choice is yours.' }))).toEqual([]);
  });
  it('warns when the idea needs a bigger tier than the one used', async () => {
    const r = await gate({ ...base, ideaId: 'the-premiere', tierUsed: 'S' });
    expect(r.problems.find((x) => x.code === 'tier_too_small')?.severity).toBe('warning');
  });
  it('gift@1 manifests and manifest-less submissions stay accepted with a warning', async () => {
    const r = await gate({ schema: 'advent-agent/gift@1', day: 5, title: 'Old', note: 'n', primary: 'index.html' });
    expect(r.ok).toBe(true);
    expect(r.problems.some((x) => x.code === 'schema_v1')).toBe(true);
    expect((await runGate({ type: 'text', text: '# Hi\n\nA letter.' }, { day: 5, render: false })).ok).toBe(true);
  });
});
