/** Read access to the bundled workshop skills and the idea library (used by the API and MCP). */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, normalize, sep } from 'node:path';
import { LIBRARY_DIR, WORKSHOP_DIR } from './package-paths.js';
import type { IdeaIndexEntry } from '../shared/idea.js';

export interface WorkshopSkillInfo {
  name: string;
  description: string;
  files: string[];
}

export function listWorkshop(): WorkshopSkillInfo[] {
  const dir = join(WORKSHOP_DIR, 'skills');
  if (!existsSync(dir)) return [];
  const out: WorkshopSkillInfo[] = [];
  for (const name of readdirSync(dir).sort()) {
    const skillFile = join(dir, name, 'SKILL.md');
    if (!existsSync(skillFile)) continue;
    const text = readFileSync(skillFile, 'utf8');
    const description = text.match(/^---\n[\s\S]*?^description:\s*(.*)$[\s\S]*?\n---/m)?.[1]?.trim().replace(/^["']|["']$/g, '') ?? '';
    const files: string[] = [];
    const walk = (d: string, rel: string) => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        const r = rel ? `${rel}/${e.name}` : e.name;
        if (e.isDirectory()) walk(join(d, e.name), r);
        else files.push(r);
      }
    };
    walk(join(dir, name), '');
    out.push({ name, description, files: files.sort() });
  }
  out.sort((a, b) => (a.name === 'gift-director' ? -1 : b.name === 'gift-director' ? 1 : a.name.localeCompare(b.name)));
  return out;
}

export function readWorkshopGuide(skill: string, file?: string): string | undefined {
  if (!/^[a-z0-9-]+$/.test(skill)) return undefined;
  const base = join(WORKSHOP_DIR, 'skills', skill);
  const target = normalize(join(base, file ?? 'SKILL.md'));
  if (!target.startsWith(normalize(base) + sep) || !existsSync(target) || !statSync(target).isFile()) return undefined;
  return readFileSync(target, 'utf8');
}

export function readIdeaIndex(filter?: string): { count: number; ideas: IdeaIndexEntry[] } {
  const file = join(LIBRARY_DIR, 'INDEX.json');
  if (!existsSync(file)) return { count: 0, ideas: [] };
  const index = JSON.parse(readFileSync(file, 'utf8')) as { ideas: IdeaIndexEntry[] };
  let ideas = index.ideas;
  if (filter) {
    const q = filter.toLowerCase();
    ideas = ideas.filter((i) => [i.id, i.title, i.summary, i.suitable_if, i.family, i.anchor, i.tier, i.capability, i.collection ?? '', ...i.emotion, ...i.interaction].some((v) => String(v).toLowerCase().includes(q)));
  }
  return { count: ideas.length, ideas };
}

export function readIdea(id: string): string | undefined {
  if (!/^[a-z0-9-]+$/.test(id)) return undefined;
  const file = join(LIBRARY_DIR, 'ideas', `${id}.md`);
  return existsSync(file) ? readFileSync(file, 'utf8') : undefined;
}
