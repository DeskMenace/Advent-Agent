/** Idea library tests (PROGRESS U6.1–U6.4 as revised by D14; gift-library/README.md). */
import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { IDEA_FAMILIES, IdeaFrontmatterSchema } from '../../src/shared/idea.js';
import { parseFrontmatter, stringifyFrontmatter } from '../../src/library/frontmatter.js';
import { buildIndex, loadIdeas, renderIndexJson, renderIndexMarkdown } from '../../src/library/index.js';

const repo = resolve(__dirname, '../..');
const libraryDir = join(repo, 'gift-library');
const ideasDir = join(libraryDir, 'ideas');
const sourceDir = join(repo, 'docs/spec/advent-gifts/gift-library/ideas');

const ideaFiles = readdirSync(ideasDir).filter((f) => f.endsWith('.md')).sort();
const ideas = loadIdeas(libraryDir);
const normalize = (s: string): string => s.replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').replace(/\n+$/, '') + '\n';

describe('frontmatter parser', () => {
  it('reads scalars, quoted strings, inline arrays, block lists and comments', () => {
    const doc = parseFrontmatter(
      [
        '---',
        'id: x-y  # comment',
        "title: \"Quoted: with # hash\"",
        "note: 'it''s fine'",
        "forms: [a, \"b, c\", recipient's pick]  # trailing",
        'variations:',
        '  - first',
        '  - "second: one"',
        'empty: []',
        '---',
        'body line',
        '',
      ].join('\n'),
    );
    expect(doc.data).toMatchObject({
      id: 'x-y',
      title: 'Quoted: with # hash',
      note: "it's fine",
      forms: ['a', 'b, c', "recipient's pick"],
      variations: ['first', 'second: one'],
      empty: [],
    });
    expect(doc.body).toBe('body line\n');
  });

  it('round-trips through stringifyFrontmatter', () => {
    const data = { id: 'a-b', title: "Someone's Title: yes", forms: ['x', "it's", 'with, comma'], variations: ['one', 'two: three'] };
    const text = stringifyFrontmatter(data, 'Notes.', { blockListKeys: ['variations'], comments: { id: 'c' } });
    expect(parseFrontmatter(text).data).toEqual(data);
  });

  it('reads booleans and null', () => {
    expect(parseFrontmatter('---\nprint: true\nx: false\ncollection: null\n---\n').data).toEqual({ print: true, x: false, collection: null });
  });

  it('rejects a missing fence', () => {
    expect(() => parseFrontmatter('id: x\n')).toThrow(/fence/);
  });
});

describe('idea library (library@2, D14)', () => {
  it('U6.1 every idea validates and its id matches its file', () => {
    expect(ideaFiles.length).toBe(58);
    expect(ideas.map((i) => i.frontmatter.id + '.md')).toEqual(ideaFiles);
    for (const i of ideas) expect(IdeaFrontmatterSchema.safeParse(i.frontmatter).success).toBe(true);
  });

  it('U6.2 INDEX.json and INDEX.md are up to date', () => {
    const index = buildIndex(ideas);
    expect(normalize(readFileSync(join(libraryDir, 'INDEX.json'), 'utf8'))).toBe(normalize(renderIndexJson(index)));
    expect(normalize(readFileSync(join(libraryDir, 'INDEX.md'), 'utf8'))).toBe(normalize(renderIndexMarkdown(index)));
    expect(index.schema).toBe('advent-agent/library@2');
    expect(index.count).toBe(58);
  });

  it('U6.3 the library keeps every idea from the gift-quality review and adds the library update (D27)', () => {
    // docs/spec is frozen at the original 49; the library update (D27) adds 9 ideas and retitles karaoke-song.
    const source = readdirSync(sourceDir).filter((f) => f.endsWith('.md')).sort();
    expect(ideaFiles).toEqual(expect.arrayContaining(source));
    const added = ideaFiles.filter((f) => !source.includes(f)).map((f) => f.replace(/\.md$/, ''));
    expect(added.sort()).toEqual(['commit-celebrations', 'countdown-tab', 'downloads-archaeologist', 'festive-terminal', 'focus-companion', 'personal-fortune', 'song-about-your-project', 'terminal-snowfall', 'trip-photo-sorter']);
    expect(ideas.find((i) => i.frontmatter.id === 'karaoke-song')!.frontmatter.title).toBe('A Song About You');
  });

  it('season shape: 4 day1 anchors, 4 finale anchors, collections of the README', () => {
    const fm = ideas.map((i) => i.frontmatter);
    expect(fm.filter((f) => f.anchor === 'day1').length).toBe(4);
    expect(fm.filter((f) => f.anchor === 'finale').length).toBe(4);
    expect(fm.filter((f) => f.anchor === 'finale').every((f) => f.family === 'finale')).toBe(true);
    expect([...new Set(fm.map((f) => f.collection).filter(Boolean))].sort()).toEqual(['bouquets', 'jelly-fruits', 'ornaments', 'tank-fish']);
    const counts = Object.fromEntries(IDEA_FAMILIES.map((fam) => [fam, fm.filter((f) => f.family === fam).length]));
    expect(counts).toEqual({ 'paper-and-pop-ups': 7, 'tactile-toys': 7, 'living-things': 4, sound: 5, games: 5, 'deadpan-documents': 9, printables: 3, heart: 4, 'real-world': 2, 'small-tools': 8, finale: 4 });
  });

  it('every idea names a share frame, a render mode, what to save, and a body with all three sections', () => {
    for (const i of ideas) {
      expect(i.frontmatter.share_frame.length, i.file).toBeGreaterThan(5);
      expect(['2d', '3d', 'either', 'terminal'], i.file).toContain(i.frontmatter.render);
      expect(i.frontmatter.save.length, i.file).toBeGreaterThan(0);
      expect(i.body, i.file).toMatch(/## Make it theirs/);
      expect(i.body, i.file).toMatch(/## Make it useful \(offer in your note\)/);
      expect(i.body, i.file).toMatch(/## Great vs lazy/);
    }
  });

  it('the eight small tools all use the tool form', () => {
    const tools = ideas.filter((i) => i.frontmatter.family === 'small-tools').map((i) => i.frontmatter);
    expect(tools).toHaveLength(8);
    for (const t of tools) {
      expect(t.forms, t.id).toContain('tool');
    }
  });

  it('the indexer rejects an idea missing a body section, an unknown render or an old exports field', () => {
    const fm = { ...ideas[0]!.frontmatter } as Record<string, unknown>;
    expect(IdeaFrontmatterSchema.safeParse({ ...fm, render: '4d' }).success).toBe(false);
    const { render: _r, ...noRender } = fm;
    expect(IdeaFrontmatterSchema.safeParse(noRender).success).toBe(false);
    const dir = mkdtempSync(join(tmpdir(), 'lib-'));
    mkdirSync(join(dir, 'ideas'));
    const text = readFileSync(join(ideasDir, ideaFiles[0]!), 'utf8').replace('## Make it useful (offer in your note)', '## Other');
    writeFileSync(join(dir, 'ideas', ideaFiles[0]!), text);
    expect(() => loadIdeas(dir)).toThrow(/Make it useful/);
  });

  it('credit is optional, validated as a GitHub handle, and shown in the index as "idea by @handle"', () => {
    const fm = { ...ideas[0]!.frontmatter } as Record<string, unknown>;
    expect(IdeaFrontmatterSchema.safeParse(fm).success).toBe(true);
    expect(IdeaFrontmatterSchema.safeParse({ ...fm, credit: 'suchipizza' }).success).toBe(true);
    for (const bad of ['', '@suchipizza', 'has space', 'a'.repeat(40), 'under_score']) expect(IdeaFrontmatterSchema.safeParse({ ...fm, credit: bad }).success, bad).toBe(false);
    const credited = [{ ...ideas[0]!, frontmatter: { ...ideas[0]!.frontmatter, credit: 'mabel-w' } }, ...ideas.slice(1)];
    const index = buildIndex(credited);
    expect(index.ideas.find((i) => i.id === ideas[0]!.frontmatter.id)!.credit).toBe('mabel-w');
    expect(index.ideas.filter((i) => 'credit' in i)).toHaveLength(1);
    expect(renderIndexMarkdown(index)).toContain('idea by @mabel-w');
    expect(renderIndexMarkdown(buildIndex(ideas))).not.toContain('idea by @');
  });

  it('U6.4 Gary, Desk Menace and vouchers never appear in the library', () => {
    for (const f of [...ideaFiles.map((x) => join(ideasDir, x)), join(libraryDir, 'INDEX.md'), join(libraryDir, 'INDEX.json'), join(libraryDir, 'README.md')]) {
      expect(readFileSync(f, 'utf8'), f).not.toMatch(/gary|desk menace|voucher/i);
    }
  });

  it('real-world ideas never have the agent buy or book (D1)', () => {
    for (const i of ideas.filter((x) => x.frontmatter.family === 'real-world')) {
      const text = readFileSync(join(libraryDir, i.file), 'utf8').toLowerCase();
      expect(text).not.toMatch(/the agent (buys|books|orders|purchases)|agent purchases/);
    }
  });
});
