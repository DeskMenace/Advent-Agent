/**
 * Door state model (ARCHITECTURE §5). Eligibility, job state, readiness and reveal are kept separate.
 */
import { z } from 'zod';
import { DoorPhaseSchema, GiftKindSchema, GiftManifestSchema } from './gift.js';

export const JOB_STATES = [
  'not_requested',
  'queued',
  'preparing',
  'waiting_for_agent',
  'waiting_for_drop',
  'waiting_for_permission',
  'validating',
  'ready',
  'failed',
  'cancelled',
] as const;
export type JobState = (typeof JOB_STATES)[number];
export const JobStateSchema = z.enum(JOB_STATES);

/** launched = the calendar starts a terminal agent; submit = any local process submits through the CLI or localhost API. */
export const CONNECTION_MODES = ['launched', 'submit'] as const;
export type ConnectionMode = (typeof CONNECTION_MODES)[number];
/** Records written before D28 may say connected or portable (chat modes, since removed): they read as submit. */
export const ConnectionModeSchema = z.preprocess((v) => (v === 'connected' || v === 'portable' ? 'submit' : v), z.enum(CONNECTION_MODES));

export const VerificationSchema = z.object({
  render: z.enum(['passed', 'failed', 'skipped']),
  renderNotes: z.array(z.string()).default([]),
  media: z.enum(['passed', 'failed', 'skipped']).default('skipped'),
  secretScan: z.enum(['clean', 'rejected']),
  warnings: z.array(z.string()).default([]),
});
export type Verification = z.infer<typeof VerificationSchema>;

export const SealedFileSchema = z.object({
  path: z.string(),
  bytes: z.number().int().nonnegative(),
  sha256: z.string().length(64),
  mime: z.string(),
  /** Stored download-only, never served inline. */
  downloadOnly: z.boolean().default(false),
});
export type SealedFile = z.infer<typeof SealedFileSchema>;

/** Server-side record of a sealed gift. Lives in doors/NN/gift/manifest.sealed.json. */
export const SealedGiftSchema = z.object({
  manifest: GiftManifestSchema,
  /** Resolved primary renderer kind. */
  kind: GiftKindSchema,
  files: z.array(SealedFileSchema),
  sealedAt: z.string(),
  attempt: z.number().int().positive(),
  mode: ConnectionModeSchema,
  adapter: z.string().optional(),
  verification: VerificationSchema,
  /** Relative path (inside gift/) of a private thumbnail for the shelf, if any. */
  thumbnail: z.string().optional(),
  /** Network origins the user has consented to for this gift. */
  networkConsent: z.array(z.string()).default([]),
});
export type SealedGift = z.infer<typeof SealedGiftSchema>;

export const AttemptSchema = z.object({
  n: z.number().int().positive(),
  mode: ConnectionModeSchema,
  adapter: z.string().optional(),
  startedAt: z.string(),
  endedAt: z.string().optional(),
  outcome: z.enum(['running', 'ready', 'failed', 'cancelled']).default('running'),
  error: z.string().optional(),
  usage: z.object({ tokens: z.number().optional(), usd: z.number().optional() }).optional(),
  /** Whether the preparation ran later than scheduled and why. */
  late: z.object({ scheduledFor: z.string(), reason: z.string() }).optional(),
  /** Gate problems reported back to the agent in this attempt. */
  gateReports: z.number().int().nonnegative().default(0),
});
export type Attempt = z.infer<typeof AttemptSchema>;

export const FeedbackSchema = z.object({
  reaction: z.enum(['loved_it', 'not_my_thing', 'too_personal']).optional(),
  note: z.string().max(2000).optional(),
  at: z.string(),
});

export const DoorStateSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  day: z.number().int().min(1).max(24),
  jobState: JobStateSchema.default('not_requested'),
  attempt: z.number().int().nonnegative().default(0),
  attempts: z.array(AttemptSchema).default([]),
  phase: DoorPhaseSchema.optional(),
  revealed: z.boolean().default(false),
  revealedAt: z.string().optional(),
  failure: z
    .object({ code: z.string(), userMessage: z.string(), canRetry: z.boolean() })
    .optional(),
  /** Set when a permission (e.g. gift network access) is awaited. Spoiler-free text only. */
  permission: z.object({ kind: z.string(), origins: z.array(z.string()).optional(), message: z.string() }).optional(),
  gift: SealedGiftSchema.optional(),
  feedback: FeedbackSchema.optional(),
  bought: z.object({ at: z.string(), note: z.string().max(500).optional() }).optional(),
  updatedAt: z.string(),
});
export type DoorState = z.infer<typeof DoorStateSchema>;

/** Envelope states shown by the UI (DESIGN_SPEC §4.4), derived from eligibility + door state. */
export const ENVELOPE_STATES = [
  'locked',
  'available',
  'today',
  'generating',
  'waiting',
  'ready_unopened',
  'opened',
  'failed',
] as const;
export type EnvelopeState = (typeof ENVELOPE_STATES)[number];

/** Spoiler-free projection of a door for /api/calendar and SSE. Never carries gift data. */
export const PublicDoorSchema = z.object({
  day: z.number().int(),
  eligible: z.boolean(),
  isToday: z.boolean(),
  envelope: z.enum(ENVELOPE_STATES),
  jobState: JobStateSchema,
  attempt: z.number().int(),
  phase: DoorPhaseSchema.optional(),
  revealed: z.boolean(),
  revealedAt: z.string().optional(),
  late: z.object({ scheduledFor: z.string(), reason: z.string(), preparedAt: z.string() }).optional(),
  failure: z.object({ userMessage: z.string(), canRetry: z.boolean() }).optional(),
  permission: z.object({ kind: z.string(), origins: z.array(z.string()).optional(), message: z.string() }).optional(),
  hasFeedback: z.boolean(),
  bought: z.boolean(),
  /** A locked door whose gift is being prepared early (Day 1 at setup, the finale): show wrapping, nothing else. */
  wrapping: z.boolean().default(false),
  /** Opened doors only (already revealed, so no spoiler): title and thumbnail for the envelope and its label. */
  title: z.string().optional(),
  thumbnailUrl: z.string().optional(),
});
export type PublicDoor = z.infer<typeof PublicDoorSchema>;
