/** Idea library entry format, library@2 (D14, gift-library/README.md). */
import { z } from 'zod';
import { EMOTIONS, FAMILIES, TIERS } from './gift.js';

export const IDEA_FAMILIES = FAMILIES;
export type IdeaFamily = (typeof IDEA_FAMILIES)[number];
export const IDEA_FAMILY_NAMES: Record<IdeaFamily, string> = {
  'paper-and-pop-ups': 'Cards, envelopes, tickets and boxes that open in 3D',
  'tactile-toys': 'Desk objects you shake, squeeze, tap or steer',
  'living-things': 'Characters, flowers, gardens, ornaments',
  sound: 'Songs, mixtapes, music boxes, soundscapes',
  games: 'Small games and puzzles',
  'deadpan-documents': 'Awards, museums, reports, patents, newspapers, trailers played completely straight',
  printables: 'Stickers, wallpapers, zines, with print files',
  heart: 'The touching ones',
  'real-world': 'Purchase-ready proposals; the agent never buys (D1)',
  'small-tools': 'Scripts and terminal things that are useful and funny or cute',
  finale: 'December 24 only',
};

export const SKILL_NAMES = ['gift-director', 'storyteller', 'arcade', 'art-studio', 'sound-studio', 'maker', 'concierge', 'quality-and-packaging'] as const;
export type SkillName = (typeof SKILL_NAMES)[number];

export const REFERENCE_IDS = [
  'css-3d-lab', 'css-3d-lab-envelope', 'css-3d-lab-crystal', 'css-3d-lab-aquarium', 'css-3d-lab-hotair', 'css-3d-lab-confetti',
  'codrops', 'openprocessing', 'wonderworks-jelly', 'wonderworks-bloom', 'wonderworks-cassette',
  'react-bits-holo-card', 'react-bits-sticker-peel', 'rive-marketplace', 'snowglobe-willeastcott', 'christmas-popup-card-dammafra',
] as const;

export const IDEA_FORMS = ['interactive-html', 'video', 'audio', 'image', 'print', 'tool'] as const;
export const IDEA_RENDERS = ['2d', '3d', 'either', 'terminal'] as const;
export type IdeaRender = (typeof IDEA_RENDERS)[number];

const list = z.array(z.string().min(1)).default([]);

export const IdeaFrontmatterSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'kebab-case id'),
  title: z.string().min(1).max(120),
  family: z.enum(IDEA_FAMILIES),
  anchor: z.enum(['day1', 'finale', 'none']).default('none'),
  collection: z.string().regex(/^[a-z0-9-]+$/).nullable().default(null),
  emotion: z.array(z.enum(EMOTIONS)).min(1),
  interaction: z.array(z.string().min(1)).min(1),
  forms: z.array(z.enum(IDEA_FORMS)).min(1),
  tier: z.enum(TIERS),
  capability: z.enum(['chat-ok', 'coding-agent']),
  /** How it's drawn; `either` = the agent's choice by budget. */
  render: z.enum(IDEA_RENDERS),
  summary: z.string().min(1).max(600),
  suitable_if: z.string().min(1).max(600),
  avoid_if: z.string().min(1).max(600),
  share_frame: z.string().min(1).max(600),
  /** What the user can save, in natural formats (replaces `exports`). */
  save: list,
  print: z.boolean().default(false),
  kit: list,
  references: z.array(z.enum(REFERENCE_IDS)).default([]),
  skills: z.array(z.enum(SKILL_NAMES)).min(1),
  minimum_done: z.string().min(1).max(600),
  status: z.enum(['candidate', 'approved']).default('candidate'),
  /** Optional GitHub handle of whoever proposed the idea; rendered as "idea by @handle". */
  credit: z.string().regex(/^[A-Za-z0-9-]{1,39}$/, 'a GitHub handle without the @').optional(),
});
export type IdeaFrontmatter = z.infer<typeof IdeaFrontmatterSchema>;

export interface IdeaIndexEntry {
  id: string;
  title: string;
  family: IdeaFamily;
  anchor: 'day1' | 'finale' | 'none';
  collection: string | null;
  emotion: string[];
  interaction: string[];
  tier: (typeof TIERS)[number];
  capability: 'chat-ok' | 'coding-agent';
  render: IdeaRender;
  summary: string;
  suitable_if: string;
  status: 'candidate' | 'approved';
  credit?: string;
  file: string;
}
