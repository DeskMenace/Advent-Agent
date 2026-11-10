/**
 * Lab checks on what a pitch is ABOUT (D10, D32): the calendar's mascot and its makers must never be the subject of a gift,
 * and one subject must not run through the whole season. Heuristics, stated as such in the report.
 */
import { MASCOT } from '../../src/shared/list.js';

const GLOBAL_MASCOT = new RegExp(MASCOT.source, 'gi');

/** A pitch is centred on the mascot or its makers when the title names them, the first sentence does, or they come up twice or more. */
export function mascotCentred(title: string | undefined, pitch: string | undefined): boolean {
  const t = title ?? '';
  const p = pitch ?? '';
  if (MASCOT.test(t)) return true;
  const first = p.split(/(?<=[.!?])\s+/)[0] ?? '';
  if (MASCOT.test(first)) return true;
  return (p.match(GLOBAL_MASCOT) ?? []).length >= 2;
}

/** Capitalised or dotted names that occur in the list (project, product and person names), lower-cased, longest first. */
export function listEntities(listMd: string): string[] {
  const names = new Set<string>();
  for (const line of listMd.split(/\r?\n/)) {
    const text = line.replace(/^\s*[-*]\s*/, '').replace(/\[source:[^\]]*\]/i, '');
    // Skip the first word of a sentence: it is capitalised only because it starts the line.
    const rest = text.replace(/^\S+\s+/, ' ');
    for (const m of rest.matchAll(/\b[A-Z][\w.-]{3,}(?: [A-Z][\w.-]{2,})*\b/g)) names.add(m[0].toLowerCase());
  }
  return [...names].sort((a, b) => b.length - a.length);
}

/** The single entity from the list that the most pitches mention, and the share of pitches that do. */
export function sameSubjectShare(pitches: Array<{ title?: string; pitch?: string }>, listMd: string): { entity: string; count: number; share: number } {
  const entities = listEntities(listMd);
  let best = { entity: '', count: 0, share: 0 };
  for (const e of entities) {
    const re = new RegExp(`(^|[^a-z0-9])${e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
    const count = pitches.filter((p) => re.test(`${p.title ?? ''} ${p.pitch ?? ''}`)).length;
    if (count > best.count) best = { entity: e, count, share: pitches.length ? count / pitches.length : 0 };
  }
  return best;
}
