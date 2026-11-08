/**
 * Gift package contract (AGENT_CONNECTIONS.md §5). Agent-authored and untrusted:
 * everything here is validated before use and never rendered as HTML in the app origin.
 */
import { z } from 'zod';

export const GIFT_SCHEMA_ID = 'advent-agent/gift@2';
export const GIFT_SCHEMA_V1 = 'advent-agent/gift@1';
export const GIFT_SCHEMAS = [GIFT_SCHEMA_V1, GIFT_SCHEMA_ID] as const;

/** Renderer kinds the calendar knows (ARCHITECTURE §8). Unknown kinds fall back to `download`. */
export const GIFT_KINDS = [
  'interactive-html',
  'image',
  'audio',
  'video',
  'document',
  'card',
  'song',
  'real-world',
  'link',
  'download',
] as const;
export type GiftKind = (typeof GIFT_KINDS)[number];
export const GiftKindSchema = z.enum(GIFT_KINDS);

/** Relative, forward-slash path inside the package. No traversal, no absolute paths. */
export const RelativePathSchema = z
  .string()
  .min(1)
  .max(512)
  .refine((p) => !p.startsWith('/') && !/^[a-zA-Z]:/.test(p) && !p.includes('\\'), 'path must be relative and use forward slashes')
  .refine((p) => !p.split('/').some((seg) => seg === '..' || seg === '' || seg === '.'), 'path must not contain . or .. segments');

export const HttpsUrlSchema = z
  .string()
  .url()
  .refine((u) => {
    try {
      const url = new URL(u);
      return url.protocol === 'https:' && !url.username && !url.password;
    } catch {
      return false;
    }
  }, 'must be an https URL without credentials');

export const ArtifactSchema = z.object({
  path: RelativePathSchema,
  kind: z.string().min(1).max(64),
  title: z.string().max(200).optional(),
  role: z.enum(['primary', 'download', 'asset', 'thumbnail', 'print', 'transcript', 'caption']).optional(),
  alt: z.string().max(1000).optional(),
  mime: z.string().max(100).optional(),
});
export type Artifact = z.infer<typeof ArtifactSchema>;

export const RealWorldItemSchema = z.object({
  name: z.string().min(1).max(200),
  vendor: z.string().min(1).max(200),
  url: HttpsUrlSchema,
  price: z.number().nonnegative().optional(),
  currency: z.string().length(3).optional(),
  checkedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'checkedAt must be YYYY-MM-DD'),
  notes: z.string().max(1000).optional(),
});
export type RealWorldItem = z.infer<typeof RealWorldItemSchema>;

export const RealWorldSchema = z.object({
  items: z.array(RealWorldItemSchema).min(1).max(20),
  whatsLeft: z.string().min(1).max(2000),
});

export const SongSchema = z.object({
  score: RelativePathSchema,
  renderSheet: RelativePathSchema.optional(),
  wav: RelativePathSchema.optional(),
});

export const LinkSchema = z.object({ label: z.string().min(1).max(200), url: HttpsUrlSchema });

/** D13/D15/D16 vocabularies (SPEC_CHANGES, gift-library README). */
export const EMOTIONS = ['funny', 'ridiculous', 'absurd', 'cute', 'touching'] as const;
export const EmotionSchema = z.enum(EMOTIONS);
export const TIERS = ['S', 'M', 'L', 'XL'] as const;
export const TierSchema = z.enum(TIERS);
export const FAMILIES = ['paper-and-pop-ups', 'tactile-toys', 'living-things', 'sound', 'games', 'deadpan-documents', 'printables', 'heart', 'real-world', 'finale'] as const;

/** Licences whose code/art may be copied into a gift (inspiration-sources.md). Compared case-insensitively. */
export const ALLOWED_CREDIT_LICENSES = ['MIT', 'BSD', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', 'Apache-2.0', 'CC0', 'CC0-1.0', 'Unlicense', 'CC BY', 'CC-BY', 'CC BY 3.0', 'CC BY 4.0', 'CC-BY-3.0', 'CC-BY-4.0', 'OFL', 'OFL-1.1', 'SIL OFL 1.1', 'Public domain'];

/** A share still or loop: a file in the package, or a capture request served by window.adventCapture.prepare(kind). */
export const ShareFrameSchema = z.union([
  RelativePathSchema,
  z.object({ capture: z.literal('still') }),
]);
export const ShareLoopSchema = z.union([
  RelativePathSchema,
  z.object({ capture: z.literal('loop'), durationMs: z.number().int().min(3000).max(10000).default(6000) }),
]);
export const ShareSchema = z.object({
  still: ShareFrameSchema,
  loop: ShareLoopSchema.optional(),
  caption: z.string().max(300).optional(),
  /** Text that the privacy preview offers to blur (names, places). */
  privateText: z.array(z.string().min(1).max(200)).max(50).default([]),
});
export type Share = z.infer<typeof ShareSchema>;

export const CreditSchema = z.object({
  what: z.string().min(1).max(200),
  source: z.string().min(1).max(200),
  license: z.string().min(1).max(60),
  url: z.string().url().optional(),
});

export const DownloadSchema = z.object({ label: z.string().min(1).max(120), file: RelativePathSchema });

/** Real print services (never purchased, D1). */
export const PrintOptionSchema = z.object({
  service: z.string().min(1).max(120),
  url: HttpsUrlSchema,
  product: z.string().max(200).optional(),
  price: z.number().nonnegative().optional(),
  currency: z.string().length(3).optional(),
  checkedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  shipsTo: z.string().max(120).optional(),
  file: RelativePathSchema.optional(),
});

export const CollectionRefSchema = z.object({
  set: z.string().min(1).max(60),
  index: z.number().int().min(1).max(3),
  size: z.number().int().min(2).max(3).default(3),
});

export const GiftManifestSchema = z.object({
  schema: z.enum(GIFT_SCHEMAS),
  day: z.number().int().min(1).max(24),
  title: z.string().min(1).max(160),
  category: z.string().max(80).optional(),
  subtitle: z.string().max(300).optional(),
  note: z.string().min(1).max(8000),
  primary: RelativePathSchema.optional(),
  artifacts: z.array(ArtifactSchema).max(200).default([]),
  song: SongSchema.optional(),
  realWorld: RealWorldSchema.nullable().optional(),
  links: z.array(LinkSchema).max(30).optional(),
  network: z.array(HttpsUrlSchema).max(10).default([]),
  incomplete: z.array(z.string().max(500)).max(30).default([]),
  continuity: z
    .object({ thread: z.string().max(80).optional(), motifs: z.array(z.string().max(60)).max(20).optional() })
    .optional(),
  agent: z.object({ name: z.string().max(80).optional(), version: z.string().max(40).optional() }).optional(),
  usage: z
    .object({ tokens: z.number().int().nonnegative().optional(), usd: z.number().nonnegative().optional() })
    .optional(),
  // ---- gift@2 (D13–D22) ----
  ideaId: z.string().max(80).nullable().optional(),
  family: z.string().max(60).optional(),
  emotion: EmotionSchema.optional(),
  interaction: z.union([z.string().min(1).max(40), z.array(z.string().min(1).max(40)).min(1).max(8)]).optional(),
  form: z.string().max(40).optional(),
  tierUsed: TierSchema.optional(),
  collection: CollectionRefSchema.nullable().optional(),
  /** gift@2 name for `primary`. */
  entry: RelativePathSchema.optional(),
  share: ShareSchema.optional(),
  downloads: z.array(DownloadSchema).max(40).default([]),
  print: z.array(PrintOptionSchema).max(10).default([]),
  credits: z.array(CreditSchema).max(40).default([]),
}).transform((m) => ({ ...m, primary: m.primary ?? m.entry, realWorld: m.realWorld ?? undefined, collection: m.collection ?? undefined }));
export type GiftManifest = z.infer<typeof GiftManifestSchema>;
export type GiftManifestInput = z.input<typeof GiftManifestSchema>;

/** Words that may never appear in agent text about real-world items (D1). Checked case-insensitively. */
export const FORBIDDEN_PURCHASE_CLAIMS = ['bought', 'ordered', 'booked', 'purchased', 'reserved for you', 'paid for'];

/** Phases an agent may report. Spoiler-free by construction. */
export const PROGRESS_PHASES = ['thinking', 'making', 'testing', 'wrapping'] as const;
export type ProgressPhase = (typeof PROGRESS_PHASES)[number];
export const ProgressPhaseSchema = z.enum(PROGRESS_PHASES);

/** Inline file for hosts that cannot write to disk (MCP submit_gift(day, files[])). */
export const InlineFileSchema = z.object({
  name: RelativePathSchema,
  text: z.string().optional(),
  base64: z.string().optional(),
}).refine((f) => (f.text === undefined) !== (f.base64 === undefined), 'exactly one of text or base64');
export type InlineFile = z.infer<typeof InlineFileSchema>;
