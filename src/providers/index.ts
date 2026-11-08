/**
 * Optional creative providers (D9, GIFT_WORKSHOP §5). Narrow operations only; keys never leave the companion.
 * Paid use is off until the user enables it with a cap; usage goes to ledger.jsonl.
 * Reference implementation: one generic OpenAI-compatible image adapter. Contributors add adapters here.
 */
import type { Provider } from '../shared/config.js';
import { getProviderKey } from './keychain.js';

export interface GenerateImageParams {
  prompt: string;
  size?: '1024x1024' | '1024x1536' | '1536x1024' | '512x512';
  n?: number;
}

export interface GeneratedFile {
  /** Base64 bytes. */
  base64: string;
  mime: string;
  /** Estimated cost in the provider's currency (USD unless stated); undefined when unknown. */
  estimatedUsd?: number;
}

export interface ProviderAdapter {
  id: string;
  kind: Provider['kind'];
  label: string;
  /** What is sent to the provider, for the consent text. */
  dataSent: string;
  generateImage?(provider: Provider, key: string, params: GenerateImageParams): Promise<GeneratedFile[]>;
  generateAudio?(provider: Provider, key: string, params: Record<string, unknown>): Promise<GeneratedFile[]>;
  synthesizeSpeech?(provider: Provider, key: string, params: Record<string, unknown>): Promise<GeneratedFile[]>;
  generateVideo?(provider: Provider, key: string, params: Record<string, unknown>): Promise<GeneratedFile[]>;
}

/** Generic OpenAI-compatible `POST {baseUrl}/images/generations` adapter. Works with any server that mirrors that shape. */
export const openAiCompatibleImage: ProviderAdapter = {
  id: 'openai-compatible-image',
  kind: 'image',
  label: 'OpenAI-compatible image API',
  dataSent: 'Your prompt and size parameters. Nothing from your calendar or profile unless the agent puts it in the prompt.',
  async generateImage(provider, key, params) {
    const base = (provider.baseUrl ?? 'https://api.openai.com/v1').replace(/\/+$/, '');
    const body = { model: provider.model ?? 'gpt-image-1', prompt: params.prompt, n: Math.min(4, Math.max(1, params.n ?? 1)), size: params.size ?? '1024x1024', response_format: 'b64_json' };
    const r = await fetch(`${base}/images/generations`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` }, body: JSON.stringify(body), signal: AbortSignal.timeout(120_000) });
    if (!r.ok) throw new Error(`The image provider answered ${r.status}: ${(await r.text()).slice(0, 300)}`);
    const json = (await r.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
    const out: GeneratedFile[] = [];
    for (const d of json.data ?? []) {
      if (d.b64_json) out.push({ base64: d.b64_json, mime: 'image/png', estimatedUsd: 0.04 });
      else if (d.url) {
        const img = await fetch(d.url, { signal: AbortSignal.timeout(60_000) });
        out.push({ base64: Buffer.from(await img.arrayBuffer()).toString('base64'), mime: img.headers.get('content-type') ?? 'image/png', estimatedUsd: 0.04 });
      }
    }
    if (!out.length) throw new Error('The image provider returned no images.');
    return out;
  },
};

const ADAPTERS: Record<string, ProviderAdapter> = { [openAiCompatibleImage.id]: openAiCompatibleImage };

export function registerProviderAdapter(a: ProviderAdapter): void { ADAPTERS[a.id] = a; }
export function getProviderAdapter(id: string): ProviderAdapter | undefined { return ADAPTERS[id]; }
export function listProviderAdapters(): ProviderAdapter[] { return Object.values(ADAPTERS); }

export class ProviderRefused extends Error {
  constructor(public readonly code: string, message: string) { super(message); this.name = 'ProviderRefused'; }
}

export interface SpendCheck {
  spentSeason: number;
  spentGift: number;
}

/** The single gate every paid call passes through. */
export async function runProvider<T extends keyof Omit<ProviderAdapter, 'id' | 'kind' | 'label' | 'dataSent'>>(
  provider: Provider | undefined,
  op: T,
  params: unknown,
  spend: SpendCheck,
  estimateUsd: number,
): Promise<GeneratedFile[]> {
  if (!provider) throw new ProviderRefused('no_provider', 'No such provider is configured.');
  if (!provider.enabled) throw new ProviderRefused('disabled', `${provider.label || provider.id} is disabled in Settings.`);
  if (!provider.paidUse) throw new ProviderRefused('paid_use_off', `Paid use is off for ${provider.label || provider.id}. The recipient must enable it in Settings with a cap.`);
  if (!provider.capPerGift) throw new ProviderRefused('no_cap', 'Paid use needs a per-gift cap in Settings.');
  if (spend.spentGift + estimateUsd > provider.capPerGift.amount) throw new ProviderRefused('cap_gift', `This call would exceed the per-gift cap of ${provider.capPerGift.amount} ${provider.capPerGift.currency}.`);
  if (provider.capSeason && spend.spentSeason + estimateUsd > provider.capSeason.amount) throw new ProviderRefused('cap_season', `This call would exceed the season cap of ${provider.capSeason.amount} ${provider.capSeason.currency}.`);
  const adapter = getProviderAdapter(provider.adapter);
  if (!adapter) throw new ProviderRefused('no_adapter', `No adapter named ${provider.adapter} is bundled.`);
  const fn = adapter[op] as ((p: Provider, k: string, params: unknown) => Promise<GeneratedFile[]>) | undefined;
  if (!fn) throw new ProviderRefused('unsupported', `${adapter.label} cannot ${String(op)}.`);
  const key = await getProviderKey(provider.id);
  if (!key) throw new ProviderRefused('no_key', `No key is stored in the keychain for ${provider.label || provider.id}.`);
  return fn.call(adapter, provider, key, params);
}
