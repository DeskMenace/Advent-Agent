import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(__dirname, '..', '..');
const KIT = join(ROOT, 'workshop', 'kit');
const IDEAS = join(ROOT, 'gift-library', 'ideas');
const load = (rel: string) => import(pathToFileURL(join(KIT, rel)).href);

const NEW_JS = [
  'capture/capture.js',
  'paper/pop-up-card.js', 'paper/envelope.js',
  'toys/snow-globe.js', 'toys/jelly.js', 'toys/bloom.js', 'toys/holo-card.js', 'toys/sticker-peel.js',
  'toys/aquarium.js', 'toys/crystal.js', 'toys/confetti.js', 'toys/scratch.js',
  'sound/karaoke.js', 'sound/cassette.js',
  'characters/character-rig.js',
  'document/layouts.js',
];
const VENDOR = [
  ['three.module.min.js', 'three.LICENSE', /MIT License/],
  ['matter.min.js', 'matter.LICENSE', /MIT License|The MIT License/],
  ['confetti.browser.js', 'canvas-confetti.LICENSE', /ISC License/],
] as const;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

/** Block-list values of `kit:` in an idea's frontmatter. */
function kitNames(text: string): string[] {
  const fm = text.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
  const out: string[] = [];
  let inKit = false;
  for (const line of fm.split('\n')) {
    if (/^kit:\s*$/.test(line)) { inKit = true; continue; }
    const inline = line.match(/^kit:\s*\[(.*)\]\s*$/);
    if (inline) { out.push(...inline[1]!.split(',').map((s) => s.trim()).filter(Boolean)); continue; }
    if (inKit) {
      const item = line.match(/^\s*-\s+(.+?)\s*$/);
      if (item) out.push(item[1]!.replace(/^["']|["']$/g, ''));
      else inKit = false;
    }
  }
  return out;
}

describe('kit v2: new blocks import in Node without a DOM', () => {
  for (const rel of NEW_JS) {
    it(rel, async () => {
      const mod = await load(rel);
      expect(Object.keys(mod).length).toBeGreaterThan(0);
    });
  }
});

describe('kit v2: headers', () => {
  it('each new block file starts with an MIT header and a usage example', () => {
    for (const rel of NEW_JS) {
      const text = readFileSync(join(KIT, rel), 'utf8');
      const head = text.split('\n').slice(0, 16).join('\n');
      expect(text.split('\n')[0], rel).toMatch(new RegExp(`^// kit/${rel.replace(/[.]/g, '\\.')} — `));
      expect(head, rel).toMatch(/MIT License/);
      expect(head, rel).toMatch(/Usage/);
    }
    const css = readFileSync(join(KIT, 'document', 'document.css'), 'utf8').slice(0, 1200);
    expect(css).toMatch(/MIT License/);
    expect(css).toMatch(/Usage/);
  });
});

describe('toys/jelly physics', () => {
  it('keeps area within ±15 % of rest after a squash and settling', async () => {
    const { createJellyBody, stepJelly, squash, areaRatio, kineticEnergy } = await load('toys/jelly.js');
    const body = createJellyBody({ x: 200, y: 200, radius: 100, count: 28 });
    squash(body, 0.5);
    expect(Math.abs(areaRatio(body) - 1)).toBeGreaterThan(0.2); // the perturbation is real
    for (let i = 0; i < 360; i++) stepJelly(body, 1 / 60);
    expect(Math.abs(areaRatio(body) - 1)).toBeLessThan(0.15);
    expect(kineticEnergy(body)).toBeLessThan(1); // settled
  });

  it('preserves area through a drag-stretch and release, and with pressure alone', async () => {
    const { createJellyBody, stepJelly, squash, areaRatio } = await load('toys/jelly.js');
    const body = createJellyBody({ x: 200, y: 200, radius: 100 });
    body.grab = { index: 0, x: 380, y: 200 };
    for (let i = 0; i < 90; i++) { stepJelly(body, 1 / 60); expect(Math.abs(areaRatio(body) - 1)).toBeLessThan(0.15); }
    expect(body.points[0].x).toBeGreaterThan(300); // it really stretched
    body.grab = null;
    for (let i = 0; i < 300; i++) stepJelly(body, 1 / 60);
    expect(Math.abs(areaRatio(body) - 1)).toBeLessThan(0.15);
    const soft = createJellyBody({ radius: 80, memory: 0 });
    squash(soft, 0.6);
    for (let i = 0; i < 300; i++) stepJelly(soft, 1 / 60);
    expect(Math.abs(areaRatio(soft) - 1)).toBeLessThan(0.15);
  });
});

describe('capture/capture', () => {
  it('registers window.adventCapture-style hooks with fallbacks', async () => {
    const { register, overlapsShareMark, clampLoopSeconds, ready, SHARE_MARK } = await load('capture/capture.js');
    const target: Record<string, any> = {};
    const calls: string[] = [];
    const off = register({ loop: async () => { calls.push('loop'); } }, { target, settleMs: 0 });
    expect(typeof target.adventCapture.prepare).toBe('function');
    await target.adventCapture.prepare('still'); // falls back to the only handler
    await target.adventCapture.prepare('loop');
    expect(calls).toEqual(['loop', 'loop']);
    off();
    expect(target.adventCapture).toBeUndefined();
    expect(SHARE_MARK).toEqual({ width: 160, height: 48, corner: 'bottom-right' });
    expect(overlapsShareMark({ x: 1000, y: 1320, width: 20, height: 20 })).toBe(true);
    expect(overlapsShareMark({ x: 0, y: 0, width: 900, height: 1290 })).toBe(false);
    expect(clampLoopSeconds(1)).toBe(3);
    expect(clampLoopSeconds(30)).toBe(10);
    const r = ready();
    setTimeout(() => r.resolve(7), 1);
    expect(await r).toBe(7);
  });
});

describe('kit v2: pure helpers', () => {
  it('bloom geometry is deterministic per seed', async () => {
    const { flowerGeometry } = await load('toys/bloom.js');
    expect(JSON.stringify(flowerGeometry(7))).toBe(JSON.stringify(flowerGeometry(7)));
    expect(JSON.stringify(flowerGeometry(7))).not.toBe(JSON.stringify(flowerGeometry(8)));
  });

  it('snow stays inside the globe', async () => {
    const { stepSnow } = await load('toys/snow-globe.js');
    const parts = Array.from({ length: 50 }, (_, i) => ({ x: Math.cos(i) * 50, y: Math.sin(i) * 50, vx: 300 * Math.cos(i * 3), vy: 300 * Math.sin(i * 3) }));
    for (let i = 0; i < 120; i++) stepSnow(parts, 1 / 60, { ax: 400, ay: 0, radius: 100 });
    for (const p of parts) expect(Math.hypot(p.x, p.y)).toBeLessThanOrEqual(100.0001);
  });

  it('karaoke finds the active word; cassette maps time to tracks', async () => {
    const { lyricLines, activeWord } = await load('sound/karaoke.js');
    const score = { tempo: 60, tracks: [{ voice: 'musicbox', notes: [{ t: 0, p: 60, d: 4 }], lyrics: [{ t: 0, text: 'Open' }, { t: 1, text: 'the' }, { t: 2, text: 'door' }] }] };
    const lines = lyricLines(score);
    expect(lines.length).toBeGreaterThan(0);
    const at = activeWord(lines, 1.5);
    expect(lines[at.line].words[at.word].text).toBe('the');
    const { trackAt, reelRadii } = await load('sound/cassette.js');
    const tracks = [{ duration: 30 }, { duration: 40 }];
    expect(trackAt(tracks, 10)).toMatchObject({ index: 0, offset: 10 });
    expect(trackAt(tracks, 45)).toMatchObject({ index: 1, offset: 15 });
    const r0 = reelRadii(0), r1 = reelRadii(1);
    expect(r0.left).toBeGreaterThan(r0.right);
    expect(r1.right).toBeGreaterThan(r1.left);
  });

  it('scratch coverage counts transparent pixels', async () => {
    const { coverage } = await load('toys/scratch.js');
    const alpha = new Uint8ClampedArray(400); // 100 RGBA pixels, all transparent
    expect(coverage(alpha, 1)).toBeCloseTo(1, 5);
    for (let i = 3; i < 400; i += 4) alpha[i] = 255;
    expect(coverage(alpha, 1)).toBeCloseTo(0, 5);
  });

  it('character rig clamps pupils', async () => {
    const { pupilOffset } = await load('characters/character-rig.js');
    const o = pupilOffset({ x: 0, y: 0 }, { x: 1000, y: 0 }, 5);
    expect(Math.hypot(o.x, o.y)).toBeLessThanOrEqual(5.0001);
  });

  it('document layouts escape their inputs', async () => {
    const { documentHTML } = await load('document/layouts.js');
    for (const kind of ['certificate', 'newspaper', 'report', 'patent', 'award', 'label']) {
      const html: string = documentHTML(kind, Object.fromEntries(['title', 'headline', 'name', 'category', 'maker', 'paper', 'org'].map((k) => [k, '<script>x</script>'])));
      expect(html, kind).not.toContain('<script>x</script>');
      expect(html, kind).toContain('&lt;script&gt;');
    }
  });
});

describe('kit INDEX.json', () => {
  const index = JSON.parse(readFileSync(join(KIT, 'INDEX.json'), 'utf8'));

  it('has the schema and well-formed entries', () => {
    expect(index.schema).toBe('advent-agent/kit-index@1');
    for (const [name, entry] of Object.entries<any>(index.blocks)) {
      expect(['built', 'planned'], name).toContain(entry.status);
      expect(Array.isArray(entry.files), name).toBe(true);
      expect(typeof entry.note, name).toBe('string');
      expect(entry.note.length, name).toBeGreaterThan(10);
    }
  });

  it('covers every kit name used by a library idea', () => {
    const used = new Set<string>();
    for (const f of readdirSync(IDEAS).filter((n) => n.endsWith('.md'))) for (const k of kitNames(readFileSync(join(IDEAS, f), 'utf8'))) used.add(k);
    expect(used.size).toBeGreaterThan(30);
    const missing = [...used].filter((k) => !(k in index.blocks));
    expect(missing).toEqual([]);
  });

  it('every built entry lists files that exist; planned entries say the agent builds from scratch', () => {
    for (const [name, entry] of Object.entries<any>(index.blocks)) {
      if (entry.status === 'built') {
        expect(entry.files.length, name).toBeGreaterThan(0);
        for (const f of entry.files) expect(existsSync(join(KIT, f)), `${name}: ${f}`).toBe(true);
      } else {
        expect(entry.note, name).toMatch(/from scratch/);
      }
    }
  });
});

describe('kit vendor folder', () => {
  it('has each vendored file with its licence text and a README', () => {
    const dir = join(KIT, 'vendor');
    for (const [file, licence, re] of VENDOR) {
      expect(existsSync(join(dir, file)), file).toBe(true);
      expect(statSync(join(dir, file)).size, file).toBeGreaterThan(10_000);
      expect(readFileSync(join(dir, licence), 'utf8'), licence).toMatch(re);
    }
    const readme = readFileSync(join(dir, 'README.md'), 'utf8');
    for (const v of ['0.187.0', '0.20.0', '1.9.4', 'MIT', 'ISC']) expect(readme).toContain(v);
  });

  it('three.js module imports in Node', async () => {
    const THREE = await load('vendor/three.module.min.js');
    expect(THREE.REVISION).toBe('187');
  });
});

describe('kit hygiene', () => {
  const files = walk(KIT).filter((f) => /\.(js|css|html|json|md)$/.test(f));
  it('no kit file references a CDN', () => {
    const cdn = /https?:\/\/[^\s"'`)]*(cdn|unpkg|jsdelivr|cdnjs)[^\s"'`)]*/i;
    const offenders = files.filter((f) => cdn.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
  it('no kit file mentions the mascot or the brand', () => {
    const offenders = files.filter((f) => { const t = readFileSync(f, 'utf8').toLowerCase(); return t.includes('gary') || t.includes('desk menace'); });
    expect(offenders).toEqual([]);
  });
});
