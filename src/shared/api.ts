/** Shapes exchanged between the companion and the UI / CLI / MCP. Spoiler-free unless the door is revealed. */
import { z } from 'zod';
import { PublicDoorSchema, SealedGiftSchema } from './door.js';
import { ProgressPhaseSchema } from './gift.js';

export const CalendarResponseSchema = z.object({
  season: z.object({
    year: z.number().int(),
    timeZone: z.string(),
    unlockHour: z.number().int(),
    deliveryMode: z.enum(['on_demand', 'scheduled']),
    mode: z.enum(['launched', 'connected', 'portable', 'submit']),
    adapter: z.string().optional(),
    kind: z.enum(['live', 'demo', 'lab']),
  }),
  now: z.string(),
  /** 0 before December 1, 1–24 during the season, 24 after. */
  eligibleThrough: z.number().int().min(0).max(24),
  todayDay: z.number().int().min(0).max(24),
  nextUnlockAt: z.string().optional(),
  countdownDays: z.number().int().optional(),
  opened: z.number().int(),
  available: z.number().int(),
  doors: z.array(PublicDoorSchema).length(24),
  gary: z.object({ show: z.boolean() }),
  setupComplete: z.boolean(),
  demo: z.object({ simulatedDay: z.number().int().min(0).max(24).optional() }).optional(),
});
export type CalendarResponse = z.infer<typeof CalendarResponseSchema>;

/** Revealed gift as sent to the UI: sealed manifest + URLs on the gift origin. */
export const RevealedGiftSchema = z.object({
  day: z.number().int(),
  season: z.number().int(),
  revealedAt: z.string(),
  gift: SealedGiftSchema,
  /** Base URL of this gift's files on the gift origin (includes the per-gift token path). */
  baseUrl: z.string(),
  promo: z
    .object({ code: z.string(), percent: z.number(), url: z.string(), expires: z.string() })
    .optional(),
  bought: z.object({ at: z.string(), note: z.string().optional() }).optional(),
  feedback: z.object({ reaction: z.string().optional(), note: z.string().optional() }).optional(),
  shareMark: z.boolean(),
});
export type RevealedGift = z.infer<typeof RevealedGiftSchema>;

export const ShelfItemSchema = z.object({
  day: z.number().int(),
  season: z.number().int(),
  title: z.string(),
  kind: z.string(),
  category: z.string().optional(),
  revealedAt: z.string(),
  thumbnailUrl: z.string().optional(),
  collection: z.object({ set: z.string(), index: z.number().int(), size: z.number().int() }).optional(),
});
export type ShelfItem = z.infer<typeof ShelfItemSchema>;

export const SseEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('door'), door: PublicDoorSchema }),
  z.object({ type: z.literal('rollover'), eligibleThrough: z.number().int(), todayDay: z.number().int() }),
  z.object({ type: z.literal('calendar') }),
  z.object({ type: z.literal('ping') }),
]);
export type SseEvent = z.infer<typeof SseEventSchema>;

/** Structured problem reported by the quality gate. */
export const GateProblemSchema = z.object({
  code: z.string(),
  message: z.string(),
  path: z.string().optional(),
  severity: z.enum(['error', 'warning']),
});
export type GateProblem = z.infer<typeof GateProblemSchema>;

export const GateReportSchema = z.object({
  ok: z.boolean(),
  problems: z.array(GateProblemSchema),
  kind: z.string().optional(),
  files: z.number().int().optional(),
  render: z.enum(['passed', 'failed', 'skipped']).optional(),
});
export type GateReport = z.infer<typeof GateReportSchema>;

export const ProgressRequestSchema = z.object({ day: z.number().int().min(1).max(24), phase: ProgressPhaseSchema });

export const AgentContextSchema = z.object({
  season: z.object({
    year: z.number().int(),
    /** D15: "day1" or "finale" restricts the choice to anchor ideas (or something of that size for the finale). */
    anchor: z.enum(['day1', 'finale']).nullable(),
    /** D18: this door is being made after its own day (missed or late install). Make it a little lighter. */
    isCatchUp: z.boolean(),
    /** Doors made on the same occasion (catch-up pile). */
    pile: z.number().int().optional(),
  }),
  day: z.number().int(),
  date: z.string(),
  locale: z.string(),
  language: z.string(),
  timeZone: z.string(),
  mode: z.enum(['launched', 'connected', 'portable', 'submit']),
  recipient: z.record(z.string(), z.unknown()).optional(),
  history: z.array(
    z.object({
      day: z.number().int(),
      title: z.string(),
      kind: z.string(),
      category: z.string().optional(),
      ideaId: z.string().nullable().optional(),
      family: z.string().optional(),
      emotion: z.string().optional(),
      interaction: z.array(z.string()).optional(),
      collection: z.object({ set: z.string(), index: z.number().int(), size: z.number().int() }).optional(),
      motifs: z.array(z.string()),
      thread: z.string().optional(),
      feedback: z.string().optional(),
      opened: z.boolean().optional(),
    }),
  ),
  /** D15: sets started this season and their items. */
  collections: z.array(z.object({ set: z.string(), size: z.number().int(), days: z.array(z.number().int()), complete: z.boolean() })),
  /** D15: when the season shape restricts the choice (Day 1, December 24), the allowed library ideas. */
  anchorIdeas: z.array(z.object({ id: z.string(), title: z.string(), tier: z.string(), capability: z.string() })).optional(),
  budget: z.object({ tier: z.enum(['S', 'M', 'L', 'XL']), tokens: z.number().int(), note: z.string().optional() }),
  budgets: z.object({
    tokenTarget: z.number().int(),
    tokenEnforced: z.boolean(),
    usdCapPerGift: z.number().optional(),
    realWorldSuggestions: z.boolean(),
    priceCeilingPerGift: z.object({ amount: z.number(), currency: z.string() }).optional(),
    priceCeilingSeason: z.object({ amount: z.number(), currency: z.string() }).optional(),
    rule: z.string(),
  }),
  permissions: z.object({
    webResearch: z.boolean(),
    inspirationFolders: z.array(z.string()),
    giftNetwork: z.boolean(),
  }),
  capabilities: z.object({
    renderers: z.array(z.string()),
    workshopPath: z.string().optional(),
    skills: z.array(z.object({ name: z.string(), description: z.string() })),
    providers: z.array(z.object({ id: z.string(), kind: z.string(), paidUse: z.boolean() })),
  }),
  modeNotes: z.array(z.string()),
  library: z.object({ howTo: z.string(), count: z.number().int() }),
  packaging: z.object({ format: z.string(), check: z.string(), submit: z.string(), progress: z.string() }),
  workspace: z.string().optional(),
  attempt: z.number().int(),
  previousProblems: z.array(GateProblemSchema).optional(),
});
export type AgentContext = z.infer<typeof AgentContextSchema>;
