/**
 * Gift package contract (AGENT_CONNECTIONS.md §5). Agent-authored and untrusted:
 * everything here is validated before use and never rendered as HTML in the app origin.
 */
import { z } from 'zod';

export const GIFT_SCHEMA_ID = 'advent-agent/gift@1';

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

export const GiftManifestSchema = z.object({
  schema: z.literal(GIFT_SCHEMA_ID),
  day: z.number().int().min(1).max(24),
  title: z.string().min(1).max(160),
  category: z.string().max(80).optional(),
  subtitle: z.string().max(300).optional(),
  note: z.string().min(1).max(8000),
  primary: RelativePathSchema.optional(),
  artifacts: z.array(ArtifactSchema).max(200).default([]),
  song: SongSchema.optional(),
  realWorld: RealWorldSchema.optional(),
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
});
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
