/** Idea library entry format (GIFT_WORKSHOP.md §4, D2, D3). */
import { z } from 'zod';

export const IDEA_GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;
export const IDEA_GROUP_NAMES: Record<(typeof IDEA_GROUPS)[number], string> = {
  A: 'Humour, personal parody and fictional identity',
  B: 'Games, playable surprises and puzzles',
  C: 'Visual, illustrated and generative gifts',
  D: 'Audio, music and video',
  E: 'Letters, stories, writing and reflective gifts',
  F: 'Thoughtful everyday utilities and agent redeemables',
  G: 'Real-life adventures, meals and offline surprises',
  H: 'Real purchasable and makeable gifts (user always pays)',
};

export const SKILL_NAMES = [
  'gift-director',
  'storyteller',
  'arcade',
  'art-studio',
  'sound-studio',
  'maker',
  'concierge',
  'quality-and-packaging',
] as const;
export type SkillName = (typeof SKILL_NAMES)[number];

export const IdeaFrontmatterSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'kebab-case id'),
  title: z.string().min(1).max(120),
  group: z.enum(IDEA_GROUPS),
  summary: z.string().min(1).max(400),
  suitable_if: z.string().min(1).max(400),
  avoid_if: z.string().min(1).max(400),
  forms: z.array(z.string().min(1)).min(1),
  minimum_done: z.string().min(1).max(400),
  personalization_hooks: z.array(z.string()).default([]),
  skills: z.array(z.enum(SKILL_NAMES)).min(1),
  effort: z.enum(['low', 'medium', 'high']),
  real_world: z.enum(['none', 'suggest']),
  quality_checks: z.array(z.string()).min(1),
  variations: z.array(z.string()).default([]),
  status: z.enum(['candidate', 'approved']).default('candidate'),
});
export type IdeaFrontmatter = z.infer<typeof IdeaFrontmatterSchema>;

export interface IdeaIndexEntry {
  id: string;
  title: string;
  group: (typeof IDEA_GROUPS)[number];
  summary: string;
  suitable_if: string;
  skills: SkillName[];
  effort: 'low' | 'medium' | 'high';
  real_world: 'none' | 'suggest';
  status: 'candidate' | 'approved';
  file: string;
}
