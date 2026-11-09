/** The persona and "the list" (D28). Shared by the companion and the UI. */
import { z } from 'zod';

export const PERSONA_KINDS = ['claude-agent', 'claude-output-style', 'claude-md', 'codex-agents'] as const;

/** A persona the user picked as their Secret Santa. The text lives in the season workspace as CLAUDE.md and AGENTS.md. */
export const PersonaSchema = z.object({
  /** Stable id: a hash of the source path. */
  id: z.string(),
  name: z.string().max(120),
  kind: z.enum(PERSONA_KINDS),
  sourcePath: z.string(),
  /** The project the persona comes from (a folder path), if any. */
  project: z.string().optional(),
  /** sha256 of the persona text last copied into the workspace. */
  sourceHash: z.string(),
  copiedAt: z.string(),
});
export type Persona = z.infer<typeof PersonaSchema>;

/** One candidate found by the file scan. */
export const PersonaCandidateSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(PERSONA_KINDS),
  sourcePath: z.string(),
  project: z.string().optional(),
  preview: z.string(),
});
export type PersonaCandidate = z.infer<typeof PersonaCandidateSchema>;

export const ListLineSchema = z.object({
  id: z.string(),
  text: z.string().max(400),
  /** Where it came from, e.g. "~/.claude/CLAUDE.md", "pasted", "you". */
  source: z.string().max(200).default(''),
  origin: z.enum(['agent', 'pasted', 'user']).default('agent'),
});
export type ListLine = z.infer<typeof ListLineSchema>;

export const ListSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  lines: z.array(ListLineSchema).default([]),
  /** Lines the user deleted: normalised text, so a later check does not bring them back. */
  deleted: z.array(z.string()).default([]),
  /** Text pasted from another app, merged into the list on the next check. */
  pasted: z.string().max(20_000).default(''),
  /** ISO timestamps of completed checks ("checking it twice" on December 8 and 15). */
  checks: z.array(z.object({ at: z.string(), kind: z.enum(['first', 'refresh']), lines: z.number().int() })).default([]),
});
export type List = z.infer<typeof ListSchema>;

export const MAX_LIST_LINES = 40;
