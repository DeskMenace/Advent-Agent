import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { GiftManifestSchema } from '../../src/shared/gift.js';

const ROOT = resolve(__dirname, '..', '..');
const WORKSHOP = join(ROOT, 'workshop');
const SKILLS = join(WORKSHOP, 'skills');
const EXPECTED = ['gift-director', 'storyteller', 'arcade', 'art-studio', 'sound-studio', 'maker', 'concierge', 'quality-and-packaging'];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const PURCHASE_WORDS = ['bought', 'ordered', 'booked', 'purchased', 'reserved for you', 'paid for'];

function embeddedManifest(text: string): Record<string, unknown> {
  const json = text.match(/<script type="application\/advent-gift\+json">\s*([\s\S]*?)\s*<\/script>/)![1]!;
  return JSON.parse(json) as Record<string, unknown>;
}

function frontmatter(text: string): { fields: Record<string, string>; body: string } {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) throw new Error('missing frontmatter');
  const fields: Record<string, string> = {};
  for (const line of m[1]!.split('\n')) {
    const kv = line.match(/^([a-zA-Z_-]+):\s*(.*)$/);
    if (kv) fields[kv[1]!] = kv[2]!.replace(/^["']|["']$/g, '');
  }
  return { fields, body: m[2] ?? '' };
}

describe('workshop skills', () => {
  it('has exactly the eight expected skills', () => {
    const dirs = readdirSync(SKILLS).filter((d) => statSync(join(SKILLS, d)).isDirectory()).sort();
    expect(dirs).toEqual([...EXPECTED].sort());
  });

  for (const name of EXPECTED) {
    it(`${name}: valid frontmatter, body under 500 lines, examples present`, () => {
      const file = join(SKILLS, name, 'SKILL.md');
      expect(existsSync(file)).toBe(true);
      const { fields, body } = frontmatter(readFileSync(file, 'utf8'));
      expect(fields.name).toBe(name);
      expect(fields.name).toMatch(/^[a-z0-9-]{1,64}$/);
      expect(fields.description!.length).toBeGreaterThan(0);
      expect(fields.description!.length).toBeLessThanOrEqual(1024);
      expect(body.split('\n').length).toBeLessThanOrEqual(500);
      const examples = join(SKILLS, name, 'examples', 'great-vs-lazy.md');
      expect(existsSync(examples)).toBe(true);
      const ex = readFileSync(examples, 'utf8');
      expect(ex).toMatch(/\*\*Great:\*\*/);
      expect(ex).toMatch(/\*\*Lazy:\*\*/);
    });
  }

  it('gift-director states the three criteria, the share frame and the no-purchase rule', () => {
    const text = readFileSync(join(SKILLS, 'gift-director', 'SKILL.md'), 'utf8');
    for (const term of ['Emotional effect', 'Delightful interaction', 'Shareability', '`emotion`', '`interaction`', 'share frame', 'references/share-and-export.md']) expect(text).toContain(term);
    expect(text).toMatch(/never purchase/i);
    for (const word of ['bought', 'ordered', 'booked']) expect(text.toLowerCase()).toContain(word);
    expect(text).toContain('Your gift is wrapped. Open door N in your calendar.');
    expect(text).toMatch(/one modest gift done beautifully beats an ambitious one/i);
  });

  it('gift-director keeps its owner-authored references and calibration examples', () => {
    for (const f of ['budget-tiers.md', 'inspiration-sources.md', 'share-and-export.md', 'brief-fields.md']) expect(existsSync(join(SKILLS, 'gift-director', 'references', f)), f).toBe(true);
    const ex = readFileSync(join(SKILLS, 'gift-director', 'examples', 'great-vs-lazy.md'), 'utf8');
    expect(ex).toMatch(/flat image with a poem/i);
  });

  it('quality-and-packaging documents phases, gate commands, gift@2 and the capture hook', () => {
    const text = readFileSync(join(SKILLS, 'quality-and-packaging', 'SKILL.md'), 'utf8');
    for (const phase of ['thinking', 'making', 'testing', 'wrapping']) expect(text).toContain(`\`${phase}\``);
    expect(text).toContain('advent-agent progress <phase>');
    expect(text).toContain('./.progress');
    expect(text).toContain('advent-agent check ./gift --day N');
    expect(text).toContain('advent-agent submit ./gift --day N');
    for (const term of ['advent-agent/gift@2', 'window.adventCapture', 'data-advent-private', 'credits', 'workshop/kit/vendor/']) expect(text).toContain(term);
  });

  it('the full gift@2 example in manifest.md validates against the schema', () => {
    const text = readFileSync(join(SKILLS, 'quality-and-packaging', 'references', 'manifest.md'), 'utf8');
    const jsonc = text.match(/```jsonc\n([\s\S]*?)```/)![1]!.replace(/\s\/\/.*$/gm, '');
    const parsed = GiftManifestSchema.safeParse(JSON.parse(jsonc));
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
    const embedded = GiftManifestSchema.safeParse(embeddedManifest(text));
    expect(embedded.success, JSON.stringify(embedded.error?.issues)).toBe(true);
  });

  it('quality-and-packaging references list the gate problem codes', () => {
    const text = readFileSync(join(SKILLS, 'quality-and-packaging', 'references', 'gate-errors.md'), 'utf8');
    for (const code of ['share_missing', 'share_file_missing', 'emotion_missing', 'interaction_missing', 'credit_license', 'network_request', 'tier_too_small', 'manifest_invalid', 'file_missing', 'nothing_to_show', 'purchase_claim', 'remote_code', 'remote_media', 'ref_missing', 'ref_outside', 'image_invalid', 'media_invalid', 'wav_invalid', 'score_tracks', 'score_tempo', 'render_sheet_missing', 'secret_', 'day_mismatch', 'too_many_files', 'too_large', 'path_traversal', 'symlink']) {
      expect(text).toContain(code);
    }
  });
});

describe('workshop hygiene', () => {
  it('never mentions the mascot, the brand or vouchers under workshop/ or in AGENT_GUIDE.md', () => {
    // share-and-export.md names the share-mark domain by design (D21).
    const allowed = new Set([join(SKILLS, 'gift-director', 'references', 'share-and-export.md')]);
    const files = [...walk(WORKSHOP).filter((f) => !allowed.has(f) && !f.includes(`${join('kit', 'vendor')}`)), join(ROOT, 'AGENT_GUIDE.md')];
    const offenders: string[] = [];
    for (const f of files) {
      const text = readFileSync(f, 'utf8').toLowerCase();
      if (text.includes('gary') || text.includes('desk menace') || text.includes('deskmenace') || text.includes('voucher')) offenders.push(relative(ROOT, f));
    }
    expect(offenders).toEqual([]);
  });

  it('templates and examples never contain the purchase words (D1)', () => {
    const files = [
      ...walk(join(WORKSHOP, 'kit', 'templates')),
      ...walk(SKILLS).filter((f) => f.includes(`${join('examples', '')}`)),
    ];
    expect(files.length).toBeGreaterThan(8);
    const offenders: string[] = [];
    for (const f of files) {
      const text = readFileSync(f, 'utf8').toLowerCase();
      for (const w of PURCHASE_WORDS) if (text.includes(w)) offenders.push(`${relative(ROOT, f)}: ${w}`);
    }
    expect(offenders).toEqual([]);
  });

  it('every kit .js file (outside vendor/) has an MIT header and a usage example', () => {
    const files = walk(join(WORKSHOP, 'kit')).filter((f) => f.endsWith('.js') && !f.includes(`${join('kit', 'vendor')}`));
    expect(files.length).toBeGreaterThanOrEqual(50);
    for (const f of files) {
      const head = readFileSync(f, 'utf8').split('\n').slice(0, 16).join('\n');
      expect(head, f).toMatch(/MIT License/);
      expect(head, f).toMatch(/Usage/);
    }
  });

  it('templates embed a gift@2 manifest and a capture hook; the real-world template hands the choice over', () => {
    const dir = join(WORKSHOP, 'kit', 'templates');
    const names = ['video-short.html', 'slide-deck.html', 'greeting-card.html', 'poster-wallpaper.html', 'zine.html', 'trading-card.html', 'real-world-proposal.html', 'iou-coupon.html'];
    for (const n of names) {
      const text = readFileSync(join(dir, n), 'utf8');
      expect(text, n).toContain('<script type="application/advent-gift+json">');
      const manifest = embeddedManifest(text) as { schema: string; emotion?: string; interaction?: unknown; share?: { still?: unknown } };
      expect(manifest.schema, n).toBe('advent-agent/gift@2');
      expect(manifest.emotion, n).toBeTruthy();
      expect(manifest.interaction, n).toBeTruthy();
      expect(manifest.share?.still, n).toEqual({ capture: 'still' });
      expect(text, n).toMatch(/window\.adventCapture\s*=\s*\{\s*async prepare\(kind\)/);
      expect(text, n).toContain('TODO');
      expect(text, n).not.toMatch(/<script[^>]+src=["']https?:/i);
      expect(text, n).not.toMatch(/<link[^>]+href=["']https?:/i);
    }
    expect(readFileSync(join(dir, 'real-world-proposal.html'), 'utf8')).toContain('Prepared for you. Buying or booking is yours to decide.');
  });

  it('AGENT_GUIDE.md covers the portable contract', () => {
    const text = readFileSync(join(ROOT, 'AGENT_GUIDE.md'), 'utf8');
    expect(text).toContain('https://raw.githubusercontent.com/suchipizza/Advent-Agent/main/schema/gift.schema.json');
    expect(text).toContain('https://raw.githubusercontent.com/suchipizza/Advent-Agent/main/gift-library/INDEX.md');
    expect(text).toContain('"schema": "advent-agent/gift@2"');
    for (const term of ['"emotion"', '"interaction"', '"tierUsed"', '"share"', '"capture": "still"', 'window.adventCapture', 'data-advent-private', 'credits', 'chat-ok']) expect(text).toContain(term);
    for (const c of ['Emotional effect', 'Delightful interaction', 'Shareability']) expect(text).toContain(c);
    const manifest = GiftManifestSchema.safeParse(embeddedManifest(text));
    expect(manifest.success, JSON.stringify(manifest.error?.issues)).toBe(true);
    expect(['S', 'M']).toContain(manifest.data?.tierUsed);
    expect(text).toContain('Your gift is wrapped. Open door N in your calendar.');
    expect(text).toMatch(/never purchases or books/);
    expect(text).toContain('`signature`'); // D26: the agent may sign its own note
    expect(text).not.toMatch(/share mark|160×48/);
    const snippet = text.match(/```html\n<button id="play"[\s\S]*?```/)![0]!;
    expect(snippet.split('\n').length).toBeLessThanOrEqual(62);
  });
});
