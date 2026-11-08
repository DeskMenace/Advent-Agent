/** Voucher slip visibility (DESK_MENACE_INTEGRATION §4). Shown by the makers, never by the agent. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PromoSchema, type Promo } from '../shared/config.js';

let cached: Promo | undefined | null = null;

export function loadPromo(file?: string): Promo | undefined {
  if (!file && cached !== null) return cached;
  const path = file ?? fileURLToPath(new URL('../promo/promo.json', import.meta.url));
  try {
    const parsed = PromoSchema.safeParse(JSON.parse(readFileSync(path, 'utf8')));
    const value = parsed.success ? parsed.data : undefined;
    if (!file) cached = value;
    return value;
  } catch {
    if (!file) cached = undefined;
    return undefined;
  }
}

export interface PromoDecision {
  code: string;
  percent: number;
  url: string;
  expires: string;
}

/**
 * @param todayIso the current date (YYYY-MM-DD) in the season timezone
 */
export function promoFor(promo: Promo | undefined, day: number, revealed: boolean, todayIso: string): PromoDecision | undefined {
  if (!promo || !promo.enabled) return undefined;
  if (!promo.code || promo.code.trim() === '' || promo.code.includes('<SET AT RELEASE>')) return undefined;
  if (!revealed) return undefined;
  if (day !== promo.day) return undefined;
  if (todayIso > promo.expires) return undefined;
  return { code: promo.code, percent: promo.percent, url: promo.url.replace('<code>', encodeURIComponent(promo.code)), expires: promo.expires };
}
