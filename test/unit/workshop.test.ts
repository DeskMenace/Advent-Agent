import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

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

  it('gift-director mentions the four phases and the no-purchase rule', () => {
    const text = readFileSync(join(SKILLS, 'gift-director', 'SKILL.md'), 'utf8');
    for (const phase of ['thinking', 'making', 'testing', 'wrapping']) expect(text).toContain(`\`${phase}\``);
    expect(text).toMatch(/never purchase/i);
    for (const word of ['bought', 'ordered', 'booked', 'purchased', 'reserved for you', 'paid for']) expect(text.toLowerCase()).toContain(word);
    expect(text).toContain('Your gift is wrapped. Open door N in your calendar.');
    expect(text).toContain('advent-agent check ./gift --day N');
    expect(text).toContain('advent-agent submit ./gift --day N');
    expect(text).toMatch(/one polished modest gift beats an ambitious broken one/i);
  });

  it('quality-and-packaging references list the gate problem codes', () => {
    const text = readFileSync(join(SKILLS, 'quality-and-packaging', 'references', 'gate-errors.md'), 'utf8');
    for (const code of ['manifest_invalid', 'file_missing', 'nothing_to_show', 'purchase_claim', 'remote_code', 'remote_media', 'ref_missing', 'ref_outside', 'image_invalid', 'media_invalid', 'wav_invalid', 'score_tracks', 'score_tempo', 'render_sheet_missing', 'secret_', 'day_mismatch', 'too_many_files', 'too_large', 'path_traversal', 'symlink']) {
      expect(text).toContain(code);
    }
  });
});

describe('workshop hygiene', () => {
  it('never mentions the mascot or the brand anywhere under workshop/ or in AGENT_GUIDE.md', () => {
    const files = [...walk(WORKSHOP), join(ROOT, 'AGENT_GUIDE.md')];
    const offenders: string[] = [];
    for (const f of files) {
      const text = readFileSync(f, 'utf8').toLowerCase();
      if (text.includes('gary') || text.includes('desk menace') || text.includes('voucher')) offenders.push(f);
    }
    expect(offenders).toEqual([]);
  });

  it('every kit .js file has an MIT header and a usage example', () => {
    const files = walk(join(WORKSHOP, 'kit')).filter((f) => f.endsWith('.js'));
    expect(files.length).toBe(34);
    for (const f of files) {
      const head = readFileSync(f, 'utf8').split('\n').slice(0, 16).join('\n');
      expect(head, f).toMatch(/MIT License/);
      expect(head, f).toMatch(/Usage/);
    }
  });

  it('templates embed the manifest script tag; the real-world template states nothing was ordered', () => {
    const dir = join(WORKSHOP, 'kit', 'templates');
    const names = ['video-short.html', 'slide-deck.html', 'greeting-card.html', 'poster-wallpaper.html', 'zine.html', 'trading-card.html', 'real-world-proposal.html', 'iou-coupon.html'];
    for (const n of names) {
      const text = readFileSync(join(dir, n), 'utf8');
      expect(text, n).toContain('<script type="application/advent-gift+json">');
      const json = text.match(/<script type="application\/advent-gift\+json">\s*([\s\S]*?)\s*<\/script>/)![1]!;
      const manifest = JSON.parse(json) as { schema: string };
      expect(manifest.schema).toBe('advent-agent/gift@1');
      expect(text, n).not.toMatch(/<script[^>]+src=["']https?:/i);
      expect(text, n).not.toMatch(/<link[^>]+href=["']https?:/i);
    }
    expect(readFileSync(join(dir, 'real-world-proposal.html'), 'utf8')).toContain('Nothing has been ordered or booked');
  });

  it('AGENT_GUIDE.md covers the portable contract', () => {
    const text = readFileSync(join(ROOT, 'AGENT_GUIDE.md'), 'utf8');
    expect(text).toContain('https://raw.githubusercontent.com/suchipizza/Advent-Agent/main/schema/gift.schema.json');
    expect(text).toContain('"schema": "advent-agent/gift@1"');
    expect(text).toContain('Your gift is wrapped. Open door N in your calendar.');
    expect(text).toMatch(/never purchases or books/);
    expect(text).toContain('Nothing has been ordered or booked');
    const snippet = text.match(/```html\n<button id="play"[\s\S]*?```/)![0]!;
    expect(snippet.split('\n').length).toBeLessThanOrEqual(62);
  });
});
