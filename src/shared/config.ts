/**
 * Non-secret settings (config.json), season (season.json), and profile (profile.json).
 */
import { z } from 'zod';
import { PersonaSchema } from './list.js';

export const LAUNCHED_ADAPTERS = [
  'claude-code',
  'codex',
  'antigravity',
  'gemini',
  'opencode',
  'cursor',
  'copilot',
  'goose',
  'amp',
  'custom',
] as const;
export type LaunchedAdapterId = (typeof LAUNCHED_ADAPTERS)[number];

export const MoneySchema = z.object({ amount: z.number().nonnegative(), currency: z.string().length(3) });

/** Chat modes (connected, portable) and the Muse adapter were removed in D28: old files read as "no agent chosen yet". */
const legacyMode = (v: unknown) => (v === 'connected' || v === 'portable' ? 'launched' : v);
const legacyAdapter = (v: unknown) => (v === 'muse' ? undefined : v);

export const ConnectionSchema = z.object({
  /** launched: the calendar starts the agent. submit: nothing is launched; a local process submits (tests, scripts). */
  mode: z.preprocess(legacyMode, z.enum(['launched', 'submit'])).default('launched'),
  adapter: z.preprocess(legacyAdapter, z.enum(LAUNCHED_ADAPTERS).optional()),
  /** Custom command template with {prompt} {prompt_file} {workspace} {workshop} {day}. */
  customCommand: z.string().max(2000).optional(),
  /** Opt-in to a more permissive flag set for the chosen adapter; the UI shows a warning. */
  permissive: z.boolean().default(false),
});

export const ProviderSchema = z.object({
  id: z.string().min(1).max(40),
  kind: z.enum(['music', 'image', 'speech', 'video']),
  adapter: z.string().min(1).max(60),
  label: z.string().max(80).default(''),
  enabled: z.boolean().default(false),
  paidUse: z.boolean().default(false),
  capPerGift: MoneySchema.optional(),
  capSeason: MoneySchema.optional(),
  baseUrl: z.string().url().optional(),
  model: z.string().max(120).optional(),
  /** True when a key is stored in the OS keychain for this provider. */
  hasKey: z.boolean().default(false),
});
export type Provider = z.infer<typeof ProviderSchema>;

export const ConfigSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  setupComplete: z.boolean().default(false),
  firstRunShown: z.boolean().default(false),
  /** The 2-step first-launch onboarding (Delivery, Budget) was completed or dismissed. */
  onboardingDone: z.boolean().default(false),
  locale: z.string().default('en'),
  language: z.string().default('en'),
  timeZone: z.string().default('UTC'),
  unlockHour: z.number().int().min(0).max(23).default(0),
  deliveryMode: z.enum(['on_demand', 'scheduled']).default('on_demand'),
  /** Scheduled mode: local wall-clock time HH:MM when preparation starts (previous day allowed via prepareDayBefore). */
  scheduleTime: z.string().regex(/^\d{2}:\d{2}$/).default('03:00'),
  prepareDayBefore: z.boolean().default(true),
  connection: ConnectionSchema.default({ mode: 'launched', permissive: false }),
  budgets: z
    .object({
      /** "How generous is your Secret Santa?" (D16): light = S, standard = M, generous = L. */
      generosity: z.enum(['light', 'standard', 'generous']).default('standard'),
      /** Legacy (pre-D16); the tier decides the token target now. */
      tokenTarget: z.number().int().positive().default(25_000),
      usdCapPerGift: z.number().positive().optional(),
      realWorldSuggestions: z.boolean().default(true),
      priceCeilingPerGift: MoneySchema.optional(),
      priceCeilingSeason: MoneySchema.optional(),
    })
    .default({ generosity: 'standard', tokenTarget: 25_000, realWorldSuggestions: true }),
  permissions: z
    .object({
      webResearch: z.boolean().default(true),
      inspirationFolders: z.array(z.string()).default([]),
      giftNetwork: z.boolean().default(false),
    })
    .default({ webResearch: true, inspirationFolders: [], giftNetwork: false }),
  timeoutMinutes: z.number().int().min(1).max(240).default(20),
  intakeLimits: z
    .object({ maxFiles: z.number().int().positive().default(200), maxTotalMB: z.number().positive().default(200) })
    .default({ maxFiles: 200, maxTotalMB: 200 }),
  gary: z.object({ show: z.boolean().default(true) }).default({ show: true }),
  share: z.object({ mark: z.boolean().default(true) }).default({ mark: true }),
  testDrive: z.object({ enabled: z.boolean().default(false) }).default({ enabled: false }),
  providers: z.array(ProviderSchema).default([]),
  /** "Who is your Secret Santa?": a persona the user picked, or none (just the agent). D28. */
  persona: PersonaSchema.optional(),
  debugKeepWorkspace: z.boolean().default(false),
});
export type Config = z.infer<typeof ConfigSchema>;
export type ConfigInput = z.input<typeof ConfigSchema>;

export const SeasonSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  year: z.number().int().min(2024).max(2100),
  /** Frozen for the season (DESIGN_SPEC §9.2). */
  timeZone: z.string(),
  unlockHour: z.number().int().min(0).max(23),
  deliveryMode: z.enum(['on_demand', 'scheduled']),
  scheduleTime: z.string().optional(),
  prepareDayBefore: z.boolean().default(true),
  connection: ConnectionSchema,
  createdAt: z.string(),
  /** Set when the user starts a later season or archives this one. */
  archivedAt: z.string().optional(),
  /** Lab and demo seasons are flagged so they can never run real agents / touch live data. */
  kind: z.enum(['live', 'demo', 'lab']).default('live'),
});
export type Season = z.infer<typeof SeasonSchema>;

export const PROFILE_FIELDS = [
  'name',
  'hobbies',
  'humour',
  'dislikes',
  'avoid',
  'language',
  'accessibility',
  'people',
  'pets',
  'notes',
] as const;
export type ProfileField = (typeof PROFILE_FIELDS)[number];

export const ProfileSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  /** What to call the recipient. */
  name: z.string().max(80).default(''),
  hobbies: z.array(z.string().max(120)).default([]),
  humour: z.string().max(300).default(''),
  dislikes: z.array(z.string().max(120)).default([]),
  avoid: z.array(z.string().max(120)).default([]),
  language: z.string().max(40).default(''),
  accessibility: z.string().max(300).default(''),
  people: z.array(z.string().max(120)).default([]),
  pets: z.array(z.string().max(120)).default([]),
  notes: z.string().max(2000).default(''),
  /** Fields the user allows to be passed to the agent. Empty profile fields are never passed. */
  share: z.array(z.enum(PROFILE_FIELDS)).default([...PROFILE_FIELDS]),
});
export type Profile = z.infer<typeof ProfileSchema>;


/** Concise record appended to history.jsonl after a reveal (D7, product description §14). */
export const HistoryRecordSchema = z.object({
  day: z.number().int(),
  title: z.string(),
  kind: z.string(),
  category: z.string().optional(),
  ideaId: z.string().nullable().optional(),
  family: z.string().optional(),
  emotion: z.string().optional(),
  interaction: z.array(z.string()).optional(),
  collection: z.object({ set: z.string(), index: z.number().int(), size: z.number().int() }).optional(),
  motifs: z.array(z.string()).default([]),
  thread: z.string().optional(),
  /** The second life the agent offered in its note, if any (D27). */
  followUp: z.object({ offer: z.string(), prompt: z.string() }).optional(),
  /** The list details this gift used (so the next gifts vary them). */
  detailsUsed: z.array(z.string()).optional(),
  revealedAt: z.string(),
  feedback: z.enum(['loved_it', 'not_my_thing', 'too_personal']).optional(),
});
export type HistoryRecord = z.infer<typeof HistoryRecordSchema>;

export const LedgerEntrySchema = z.object({
  at: z.string(),
  day: z.number().int().optional(),
  type: z.enum(['usage', 'provider', 'bought']),
  tokens: z.number().optional(),
  usd: z.number().optional(),
  provider: z.string().optional(),
  amount: MoneySchema.optional(),
  note: z.string().optional(),
});
export type LedgerEntry = z.infer<typeof LedgerEntrySchema>;
