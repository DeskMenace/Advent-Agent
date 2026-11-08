/**
 * Parser for docs/spec/AI_Advent_Calendar_Gift_Idea_Bank.md ("All gift candidates", groups A–H).
 * Shared by scripts/library-convert.ts and test/unit/library.test.ts so both read the same source.
 */
import { IDEA_GROUPS } from '../shared/idea.js';

export type BankGroup = (typeof IDEA_GROUPS)[number];

export interface BankIdea {
  title: string;
  group: BankGroup;
  /** Group heading text after "A. ", kept verbatim. */
  groupName: string;
  description: string;
}

const GROUP_HEADING = /^###\s+([A-H])\.\s+(.+?)\s*$/;
const IDEA_LINE = /^-\s+\*\*(.+?)\*\*\s+—\s+(.+?)\s*$/;

export function parseBank(markdown: string): BankIdea[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const start = lines.findIndex((l) => /^##\s+All gift candidates/.test(l));
  if (start === -1) throw new Error('bank: "## All gift candidates" section not found');
  const ideas: BankIdea[] = [];
  let group: BankGroup | null = null;
  let groupName = '';
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (/^##\s/.test(line)) break;
    const heading = GROUP_HEADING.exec(line);
    if (heading) {
      group = heading[1] as BankGroup;
      groupName = heading[2] as string;
      continue;
    }
    const idea = IDEA_LINE.exec(line);
    if (idea && group) ideas.push({ title: idea[1] as string, group, groupName, description: idea[2] as string });
  }
  return ideas;
}

/** kebab-case of a title: lowercase ASCII letters and digits joined by single hyphens. */
export function kebab(title: string): string {
  return title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
