/** D27: small-tool gifts (form "tool", files in tool/), their check_gift rules, Save as a zip, and followUp. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import yauzl from 'yauzl';
import { testCompanion, type TestCompanion } from '../helpers/companion.js';

let t: TestCompanion;
const auth = () => ({ authorization: `Bearer ${t.token}` });
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

type File = { name: string; text?: string; base64?: string };
type Result = { ok: boolean; problems: Array<{ code: string; severity: string; message: string }> };

const SCRIPT = `#!/bin/sh
# Downloads archaeologist. Dry run by default: pass --apply to move files. Never deletes.
DRY_RUN=1; [ "$1" = "--apply" ] && DRY_RUN=0
for f in "$HOME/Downloads"/*.pdf; do
  if [ "$DRY_RUN" = 1 ]; then echo "would move $f to Papers/"; else mkdir -p "$HOME/Downloads/Papers" && mv "$f" "$HOME/Downloads/Papers/" && echo "$f" >> "$HOME/.downloads-undo.log"; fi
done
`;
const README = '# Downloads archaeologist\n\nmacOS and Linux, sh.\n\nInstall: `sh install.sh`\n\nUninstall: `sh uninstall.sh` puts every file back from the undo log.\n';
const toolManifest = (day: number, extra: Record<string, unknown> = {}) => ({
  schema: 'advent-agent/gift@2', day, title: 'The Downloads Archaeologist', family: 'small-tools', form: 'tool', ideaId: 'downloads-archaeologist',
  emotion: 'funny', interaction: ['run'], entry: 'screenshot.png', share: { still: 'screenshot.png' },
  note: 'Your Downloads folder has 41 PDFs called final. This digs them out.',
  followUp: { offer: 'A weekly reminder in your terminal', prompt: 'Turn my Advent Agent gift from December 3 (<gift folder path>) into a weekly terminal reminder.' },
  ...extra,
});
const toolFiles = (day: number, over: Partial<Record<string, string | null>> = {}, extra: Record<string, unknown> = {}): File[] => {
  const files: Record<string, string | null> = { 'tool/dig.sh': SCRIPT, 'tool/README.md': README, 'tool/install.sh': '#!/bin/sh\necho "alias dig-downloads=\\"sh $PWD/dig.sh\\"" >> ~/.zshrc\n', 'tool/uninstall.sh': '#!/bin/sh\n# Dry run first: prints what it would restore.\nsed -i.bak "/dig-downloads/d" ~/.zshrc\n', ...over };
  return [
    { name: 'gift.json', text: JSON.stringify(toolManifest(day, extra)) },
    { name: 'screenshot.png', base64: PNG },
    ...Object.entries(files).filter(([, v]) => v !== null).map(([name, text]) => ({ name, text: text! })),
  ];
};
const check = async (day: number, files: File[]) => (await t.api<Result>('POST', `/api/agent/check?day=${day}`, { files })).data;
const errors = (r: Result) => r.problems.filter((p) => p.severity === 'error').map((p) => p.code);

function unzip(buf: Buffer): Promise<Array<{ name: string; mode: number; text: string }>> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buf, { lazyEntries: true }, (err, zip) => {
      if (err || !zip) return reject(err);
      const out: Array<{ name: string; mode: number; text: string }> = [];
      zip.on('entry', (e: yauzl.Entry) => zip.openReadStream(e, (e2, s) => {
        if (e2 || !s) return reject(e2);
        const chunks: Buffer[] = [];
        s.on('data', (c: Buffer) => chunks.push(c)).on('end', () => { out.push({ name: e.fileName, mode: (e.externalFileAttributes >>> 16) & 0o777, text: Buffer.concat(chunks).toString('utf8') }); zip.readEntry(); });
      }));
      zip.on('end', () => resolve(out));
      zip.readEntry();
    });
  });
}

beforeAll(async () => {
  t = await testCompanion({ config: { connection: { mode: 'connected', permissive: false } } });
}, 60_000);
afterAll(async () => { await t?.close(); });

describe('small-tool gifts (D27)', () => {
  it('a well-made tool with a followUp passes check_gift', async () => {
    const r = await check(3, toolFiles(3));
    expect(errors(r), JSON.stringify(r.problems)).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it('fails without a README, without any uninstall instruction, or when it deletes with no dry run', async () => {
    expect(errors(await check(3, toolFiles(3, { 'tool/README.md': null })))).toContain('tool_readme_missing');
    expect(errors(await check(3, toolFiles(3, { 'tool/uninstall.sh': null, 'tool/README.md': '# Dig\n\nInstall: sh install.sh\n' })))).toContain('tool_uninstall_missing');
    // An uninstall line in the README is enough.
    expect(errors(await check(3, toolFiles(3, { 'tool/uninstall.sh': null })))).not.toContain('tool_uninstall_missing');
    for (const bad of ['rm -rf "$HOME/Downloads/old"', 'import shutil\nshutil.rmtree(path)', 'import os\nos.remove(p)', 'require("fs").unlinkSync(p)']) {
      const r = await check(3, toolFiles(3, { 'tool/dig.sh': null, 'tool/clean.py': `${bad}\n` }));
      expect(errors(r), bad).toContain('tool_deletes');
      expect(r.ok).toBe(false);
    }
    // The same call behind a dry-run guard is accepted.
    expect(errors(await check(3, toolFiles(3, { 'tool/clean.py': 'import os, sys\nDRY_RUN = "--apply" not in sys.argv\nif not DRY_RUN: os.remove(p)\n' })))).not.toContain('tool_deletes');
  });

  it('warns, without failing, on network imports', async () => {
    const r = await check(3, toolFiles(3, { 'tool/fortune.py': 'import requests\nprint(requests.get("https://example.com").text)\n' }));
    expect(r.problems.find((p) => p.code === 'tool_network')?.severity).toBe('warning');
    expect(errors(r)).toEqual([]);
  });

  it('fails when the tool/ folder is missing', async () => {
    expect(errors(await check(3, toolFiles(3, { 'tool/dig.sh': null, 'tool/README.md': null, 'tool/install.sh': null, 'tool/uninstall.sh': null })))).toContain('tool_files_missing');
  });

  it('displays the screenshot, Save gives the tool as a zip (scripts executable, nothing added), followUp stays out of the gift view and reaches the next brief', async () => {
    const s = await t.api<Result>('POST', '/api/agent/submit?day=3&mode=connected', { files: toolFiles(3) });
    expect(s.data.ok, JSON.stringify(s.data.problems)).toBe(true);
    await t.api('POST', '/api/doors/3/reveal');
    const g = (await t.api<{ gift: { kind: string } }>('GET', '/api/doors/3/gift')).data;
    expect(g.gift.kind).toBe('image');

    const { options } = (await t.api<{ options: Array<{ id: string; label: string; format: string }> }>('GET', '/api/save/3')).data;
    expect(options[0]).toEqual({ id: 'gift', label: 'The tool', format: 'ZIP' });
    expect(options.map((o) => o.id)).toContain('file:screenshot.png');
    const r = await fetch(`${t.appUrl}/api/save/3/file?id=gift`, { headers: auth() });
    expect(r.headers.get('content-type')).toBe('application/zip');
    expect(r.headers.get('content-disposition')).toMatch(/advent-day-3-.*\.zip/);
    const entries = await unzip(Buffer.from(await r.arrayBuffer()));
    expect(entries.map((e) => e.name).sort()).toEqual(['the-downloads-archaeologist/README.md', 'the-downloads-archaeologist/dig.sh', 'the-downloads-archaeologist/install.sh', 'the-downloads-archaeologist/uninstall.sh']);
    expect(entries.find((e) => e.name.endsWith('dig.sh'))!.mode).toBe(0o755);
    expect(entries.find((e) => e.name.endsWith('README.md'))!.mode).toBe(0o644);
    for (const e of entries) expect(e.text).not.toMatch(/Advent Agent|deskmenace/);

    const ctx = (await t.api<{ history: Array<{ day: number; followUp?: { offer: string } }> }>('GET', '/api/agent/context?day=4&mode=connected')).data;
    expect(ctx.history.find((h) => h.day === 3)?.followUp?.offer).toBe('A weekly reminder in your terminal');
  });

  it('followUp is checked like the note: no purchase words, no secrets', async () => {
    const r = await check(3, toolFiles(3, {}, { followUp: { offer: 'A tracker of what you bought', prompt: 'Make it.' } }));
    expect(errors(r)).toContain('purchase_claim');
  });
});
