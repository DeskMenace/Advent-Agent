/** Idea library loader and index builder (library@2, D14). Deterministic: no timestamps. */
import { readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { IDEA_FAMILIES, IdeaFrontmatterSchema, type IdeaFrontmatter, type IdeaIndexEntry } from '../shared/idea.js';
import { TIERS } from '../shared/gift.js';
import { parseFrontmatter } from './frontmatter.js';

export const INDEX_SCHEMA = 'advent-agent/library@2';

export interface LoadedIdea {
  file: string;
  frontmatter: IdeaFrontmatter;
  body: string;
}

export interface IdeaIndex {
  schema: typeof INDEX_SCHEMA;
  count: number;
  ideas: IdeaIndexEntry[];
}

export function loadIdeaFile(path: string, file: string): LoadedIdea {
  let parsed;
  try {
    parsed = parseFrontmatter(readFileSync(path, 'utf8'));
  } catch (err) {
    throw new Error(`${file}: ${(err as Error).message}`);
  }
  const result = IdeaFrontmatterSchema.safeParse(parsed.data);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `  ${i.path.join('.') || '(root)'}: ${i.message}`).join('\n');
    throw new Error(`${file}: invalid idea frontmatter\n${issues}`);
  }
  const expectedId = basename(file, '.md');
  if (result.data.id !== expectedId) throw new Error(`${file}: id "${result.data.id}" does not match the file name "${expectedId}"`);
  return { file, frontmatter: result.data, body: parsed.body };
}

export function loadIdeas(dir: string): LoadedIdea[] {
  const ideasDir = join(dir, 'ideas');
  const files = readdirSync(ideasDir).filter((f) => f.endsWith('.md')).sort();
  const ideas = files.map((f) => loadIdeaFile(join(ideasDir, f), `ideas/${f}`));
  const seen = new Map<string, string>();
  for (const idea of ideas) {
    const dup = seen.get(idea.frontmatter.id);
    if (dup) throw new Error(`${idea.file}: duplicate id "${idea.frontmatter.id}" (also in ${dup})`);
    seen.set(idea.frontmatter.id, idea.file);
  }
  return ideas;
}

const ANCHOR_ORDER = { day1: 0, finale: 1, none: 2 } as const;
const compare = (a: string, b: string): number => a.localeCompare(b, 'en');

/** Order: families as listed in gift-library/README.md, then anchors (day1, finale), then tier, then title. */
export function buildIndex(ideas: LoadedIdea[]): IdeaIndex {
  const entries: IdeaIndexEntry[] = ideas.map(({ file, frontmatter: f }) => ({
    id: f.id, title: f.title, family: f.family, anchor: f.anchor, collection: f.collection, emotion: f.emotion, interaction: f.interaction,
    tier: f.tier, capability: f.capability, summary: f.summary, suitable_if: f.suitable_if, status: f.status, file,
  }));
  entries.sort((a, b) =>
    IDEA_FAMILIES.indexOf(a.family) - IDEA_FAMILIES.indexOf(b.family)
    || ANCHOR_ORDER[a.anchor] - ANCHOR_ORDER[b.anchor]
    || TIERS.indexOf(a.tier) - TIERS.indexOf(b.tier)
    || compare(a.title, b.title));
  return { schema: INDEX_SCHEMA, count: entries.length, ideas: entries };
}

export function renderIndexJson(index: IdeaIndex): string {
  return JSON.stringify(index, null, 2) + '\n';
}

const cell = (s: string): string => s.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');

export function renderIndexMarkdown(index: IdeaIndex): string {
  const out: string[] = [
    '# Gift library index',
    '',
    'Generated from `ideas/*.md` by `npm run library:index`. Do not edit by hand.',
    '',
    `**${index.count} ideas.** Tier = minimum budget tier. Anchor = Day 1 or finale only. Collection = max 3 items per set. Ideas are inspiration, never a quota.`,
    '',
  ];
  for (const family of IDEA_FAMILIES) {
    const rows = index.ideas.filter((i) => i.family === family);
    if (rows.length === 0) continue;
    out.push(`## ${family}`, '', '| Idea | Emotion | Interaction | Tier | Who can make it | Anchor / collection |', '|---|---|---|---|---|---|');
    for (const r of rows) {
      const anchor = r.anchor !== 'none' ? r.anchor : r.collection ? `set: ${r.collection}` : '';
      out.push(`| [${cell(r.title)}](${r.file}) | ${r.emotion.join(', ')} | ${r.interaction.join(', ')} | ${r.tier} | ${r.capability === 'chat-ok' ? 'any agent' : 'coding agent'} | ${anchor} |`);
    }
    out.push('');
  }
  return out.join('\n');
}
