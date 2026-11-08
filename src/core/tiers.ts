/** Budget tiers (D16, workshop/skills/gift-director/references/budget-tiers.md). Token figures are advisory. */
import type { ConnectionMode } from '../shared/door.js';

export type Tier = 'S' | 'M' | 'L' | 'XL';
export type Generosity = 'light' | 'standard' | 'generous';

export const GENEROSITY_TIER: Record<Generosity, Exclude<Tier, 'XL'>> = { light: 'S', standard: 'M', generous: 'L' };
/** Upper end of each advisory range. */
export const TIER_TOKENS: Record<Exclude<Tier, 'XL'>, number> = { S: 30_000, M: 100_000, L: 300_000 };
const ORDER: Tier[] = ['S', 'M', 'L', 'XL'];

export type Anchor = 'day1' | 'finale' | null;

export function anchorFor(day: number): Anchor {
  return day === 1 ? 'day1' : day === 24 ? 'finale' : null;
}

export interface TierDecision {
  tier: Tier;
  tokens: number;
  /** Multiplier for a USD cap (XL = 3×). */
  capMultiplier: number;
  note?: string;
}

/**
 * Day 1 and December 24 get XL: 3× the daily budget, at least L.
 * Portable mode (chat LLMs without tools) is capped at M: those agents can't test or iterate (D23).
 */
export function tierFor(day: number, generosity: Generosity, mode: ConnectionMode): TierDecision {
  const daily = GENEROSITY_TIER[generosity];
  const dailyTokens = TIER_TOKENS[daily];
  if (mode === 'portable') {
    const tier = ORDER.indexOf(daily) > ORDER.indexOf('M') ? 'M' : daily;
    return { tier, tokens: TIER_TOKENS[tier], capMultiplier: 1, note: 'Chat assistants stay in tier S or M forms: one self-contained page, made flawless.' };
  }
  if (anchorFor(day)) return { tier: 'XL', tokens: Math.max(3 * dailyTokens, TIER_TOKENS.L), capMultiplier: 3 };
  return { tier: daily, tokens: dailyTokens, capMultiplier: 1 };
}

export function tierAtLeast(a: Tier, b: Tier): boolean {
  return ORDER.indexOf(a) >= ORDER.indexOf(b);
}
