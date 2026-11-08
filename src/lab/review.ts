/**
 * Gift lab review sheet (TEST_PLAN §6): lists lab gifts with the review form; saves to docs/lab-reviews/<date>.md
 * in the repo working tree and can mark an idea approved in gift-library/ideas/<id>.md.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { LIBRARY_DIR, PACKAGE_ROOT } from '../core/package-paths.js';
import type { CalendarService } from '../jobs/service.js';

export const LabReviewSchema = z.object({
  day: z.number().int().min(1).max(24),
  idea: z.string().optional(),
  agent: z.string().optional(),
  works: z.enum(['yes', 'no', 'partly']),
  delight: z.number().int().min(1).max(5),
  feltPersonal: z.enum(['yes', 'no', 'n/a']),
  noteQuality: z.number().int().min(1).max(5),
  problems: z.string().max(4000).default(''),
  approveIdea: z.boolean().default(false),
});
export type LabReview = z.infer<typeof LabReviewSchema>;

export interface LabSheetItem {
  day: number;
  title?: string;
  kind?: string;
  idea?: string;
  agent?: string;
  state: string;
  revealed: boolean;
}

/** The lab stores which idea/agent each door was asked for in doors/NN/lab.json. */
export function labMeta(service: CalendarService, year: number, day: number): { idea?: string; agent?: string } {
  const f = join(service.store.home.doorDir(year, day), 'lab.json');
  if (!existsSync(f)) return {};
  try { return JSON.parse(readFileSync(f, 'utf8')) as { idea?: string; agent?: string }; } catch { return {}; }
}

export function labReviewSheet(service: CalendarService): { season: number | null; items: LabSheetItem[]; reviewsFile: string } {
  const season = service.season();
  if (!season) return { season: null, items: [], reviewsFile: reviewsFile() };
  const doors = service.store.doors(season.year).readAll();
  const items = doors
    .filter((d) => d.jobState !== 'not_requested')
    .map((d) => ({ day: d.day, title: d.revealed ? d.gift?.manifest.title : undefined, kind: d.revealed ? d.gift?.kind : undefined, ...labMeta(service, season.year, d.day), state: d.jobState, revealed: d.revealed }));
  return { season: season.year, items, reviewsFile: reviewsFile() };
}

function reviewsFile(date = new Date()): string {
  return join(PACKAGE_ROOT, 'docs', 'lab-reviews', `${date.toISOString().slice(0, 10)}.md`);
}

export function saveLabReview(service: CalendarService, raw: unknown): { saved: string; approved?: string } {
  const review = LabReviewSchema.parse(raw);
  const season = service.season();
  const title = season ? service.store.doors(season.year).read(review.day).gift?.manifest.title : undefined;
  const file = reviewsFile();
  mkdirSync(join(file, '..'), { recursive: true });
  if (!existsSync(file)) writeFileSync(file, `# Lab reviews · ${new Date().toISOString().slice(0, 10)}\n\n`);
  const block = [
    `## Door ${review.day}${title ? ` · ${title}` : ''}`,
    '',
    `- Idea: ${review.idea ?? '(free)'}`,
    `- Agent: ${review.agent ?? '(unknown)'}`,
    `- Works: ${review.works}`,
    `- Delight: ${review.delight}/5`,
    `- Felt personal: ${review.feltPersonal}`,
    `- Note quality: ${review.noteQuality}/5`,
    `- Problems: ${review.problems.trim() || 'none noted'}`,
    `- Approve idea: ${review.approveIdea ? 'yes' : 'no'}`,
    '',
  ].join('\n');
  appendFileSync(file, block);
  let approved: string | undefined;
  if (review.approveIdea && review.idea) {
    const ideaFile = join(LIBRARY_DIR, 'ideas', `${review.idea}.md`);
    if (existsSync(ideaFile)) {
      const text = readFileSync(ideaFile, 'utf8');
      const next = text.replace(/^status:\s*candidate.*$/m, 'status: approved');
      if (next !== text) { writeFileSync(ideaFile, next); approved = review.idea; }
    }
  }
  return { saved: file, approved };
}
