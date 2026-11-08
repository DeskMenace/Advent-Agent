/** Idea library tests (PROGRESS U6.1–U6.4 as revised by D14; gift-library/README.md). */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
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
    expect(ideaFiles.length).toBe(49);
    expect(ideas.map((i) => i.frontmatter.id + '.md')).toEqual(ideaFiles);
    for (const i of ideas) expect(IdeaFrontmatterSchema.safeParse(i.frontmatter).success).toBe(true);
  });

  it('U6.2 INDEX.json and INDEX.md are up to date', () => {
    const index = buildIndex(ideas);
    expect(normalize(readFileSync(join(libraryDir, 'INDEX.json'), 'utf8'))).toBe(normalize(renderIndexJson(index)));
    expect(normalize(readFileSync(join(libraryDir, 'INDEX.md'), 'utf8'))).toBe(normalize(renderIndexMarkdown(index)));
    expect(index.schema).toBe('advent-agent/library@2');
    expect(index.count).toBe(49);
  });

  it('U6.3 the ideas are exactly the ones delivered in the gift-quality review (same ids and titles)', () => {
    const source = readdirSync(sourceDir).filter((f) => f.endsWith('.md')).sort();
    expect(ideaFiles).toEqual(source);
    for (const f of source) expect(readFileSync(join(ideasDir, f), 'utf8')).toBe(readFileSync(join(sourceDir, f), 'utf8'));
  });

  it('season shape: 4 day1 anchors, 4 finale anchors, collections of the README', () => {
    const fm = ideas.map((i) => i.frontmatter);
    expect(fm.filter((f) => f.anchor === 'day1').length).toBe(4);
    expect(fm.filter((f) => f.anchor === 'finale').length).toBe(4);
    expect(fm.filter((f) => f.anchor === 'finale').every((f) => f.family === 'finale')).toBe(true);
    expect([...new Set(fm.map((f) => f.collection).filter(Boolean))].sort()).toEqual(['bouquets', 'jelly-fruits', 'ornaments', 'tank-fish']);
    const counts = Object.fromEntries(IDEA_FAMILIES.map((fam) => [fam, fm.filter((f) => f.family === fam).length]));
    expect(counts).toEqual({ 'paper-and-pop-ups': 7, 'tactile-toys': 7, 'living-things': 4, sound: 4, games: 5, 'deadpan-documents': 9, printables: 3, heart: 4, 'real-world': 2, finale: 4 });
  });

  it('every idea names a share frame, at least one emotion and one interaction, and a body with both sections', () => {
    for (const i of ideas) {
      expect(i.frontmatter.share_frame.length, i.file).toBeGreaterThan(5);
      expect(i.body, i.file).toMatch(/## Make it theirs/);
      expect(i.body, i.file).toMatch(/## Great vs lazy/);
    }
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
