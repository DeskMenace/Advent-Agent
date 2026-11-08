/** Idea library tests (PROGRESS U6.1–U6.4; GIFT_WORKSHOP.md §4, D2, D10). */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { IDEA_GROUP_NAMES, IdeaFrontmatterSchema } from '../../src/shared/idea.js';
import { parseBank } from '../../src/library/bank.js';
import { parseFrontmatter, stringifyFrontmatter } from '../../src/library/frontmatter.js';
import { buildIndex, loadIdeas, renderIndexJson, renderIndexMarkdown } from '../../src/library/index.js';

const repo = resolve(__dirname, '../..');
const libraryDir = join(repo, 'gift-library');
const ideasDir = join(libraryDir, 'ideas');
const bankPath = join(repo, 'docs/spec/AI_Advent_Calendar_Gift_Idea_Bank.md');

const ideaFiles = readdirSync(ideasDir).filter((f) => f.endsWith('.md')).sort();
const ideas = loadIdeas(libraryDir);
const bank = parseBank(readFileSync(bankPath, 'utf8'));
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
    expect(doc.data).toEqual({
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

  it('rejects a missing fence', () => {
    expect(() => parseFrontmatter('id: x\n')).toThrow(/fence/);
  });
});

describe('idea library', () => {
  it('U6.1 every idea file validates against the idea schema', () => {
    for (const file of ideaFiles) {
      const parsed = parseFrontmatter(readFileSync(join(ideasDir, file), 'utf8'));
      const result = IdeaFrontmatterSchema.safeParse(parsed.data);
      expect(result.success, `${file}: ${result.success ? '' : JSON.stringify(result.error.issues)}`).toBe(true);
      if (result.success) expect(result.data.id, `${file}: id matches file name`).toBe(file.replace(/\.md$/, ''));
    }
    expect(ideas).toHaveLength(ideaFiles.length);
  });

  it('U6.2 INDEX.json and INDEX.md are up to date', () => {
    const index = buildIndex(ideas);
    expect(normalize(readFileSync(join(libraryDir, 'INDEX.json'), 'utf8'))).toBe(normalize(renderIndexJson(index)));
    expect(normalize(readFileSync(join(libraryDir, 'INDEX.md'), 'utf8'))).toBe(normalize(renderIndexMarkdown(index)));
    expect(index.count).toBe(ideas.length);
    expect(index.groups).toEqual(IDEA_GROUP_NAMES);
    expect(JSON.stringify(index)).not.toMatch(/generatedAt|\d{4}-\d{2}-\d{2}T/);
  });

  it('U6.3 78 ideas whose titles and groups match the source bank', () => {
    expect(bank).toHaveLength(78);
    expect(ideas).toHaveLength(78);
    const fromBank = bank.map((b) => `${b.group}|${b.title}`).sort();
    const fromLibrary = ideas.map((i) => `${i.frontmatter.group}|${i.frontmatter.title}`).sort();
    expect(fromLibrary).toEqual(fromBank);
    for (const b of bank) expect(IDEA_GROUP_NAMES[b.group], `group name for ${b.group}`).toBe(b.groupName);
    for (const b of bank) {
      const idea = ideas.find((i) => i.frontmatter.title === b.title);
      expect(idea?.frontmatter.summary, `summary of ${b.title} keeps the bank wording`).toBe(b.description);
    }
  });

  it('U6.4 Gary never appears in the library', () => {
    const files = [...ideaFiles.map((f) => join(ideasDir, f)), join(libraryDir, 'INDEX.json'), join(libraryDir, 'INDEX.md'), join(libraryDir, 'README.md')];
    for (const path of files) {
      const text = readFileSync(path, 'utf8').toLowerCase();
      expect(text, path).not.toMatch(/gary/);
      expect(text, path).not.toMatch(/desk\s*menace/);
    }
  });

  it('every idea in groups G and H is a real-world suggestion', () => {
    for (const idea of ideas) {
      if (idea.frontmatter.group === 'G' || idea.frontmatter.group === 'H') expect(idea.frontmatter.real_world, idea.file).toBe('suggest');
    }
  });

  it('real-world ideas never say the agent buys, purchases or books', () => {
    for (const idea of ideas) {
      if (idea.frontmatter.real_world !== 'suggest') continue;
      const text = readFileSync(join(libraryDir, idea.file), 'utf8').toLowerCase();
      for (const phrase of ['the agent buys', 'agent purchases', 'agent books']) expect(text, `${idea.file} contains "${phrase}"`).not.toContain(phrase);
    }
  });

  it('skills, forms and quality checks are non-empty and ids are unique', () => {
    const ids = new Set(ideas.map((i) => i.frontmatter.id));
    expect(ids.size).toBe(ideas.length);
    for (const idea of ideas) {
      expect(idea.frontmatter.skills.length, idea.file).toBeGreaterThan(0);
      expect(idea.frontmatter.forms.length, idea.file).toBeGreaterThan(0);
      expect(idea.frontmatter.quality_checks.length, idea.file).toBeGreaterThan(0);
      expect(idea.body.trim().length, `${idea.file} has creative notes`).toBeGreaterThan(0);
    }
  });
});
