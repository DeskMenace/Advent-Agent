/** Small shared helpers: reduced motion, live region, toast, dates. */

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

let lastAnnounce = '';
let announceTimer: number | undefined;
/** Accessible live-region message. Repeats of the same text are coalesced. */
export function announce(message: string): void {
  const el = document.getElementById('live');
  if (!el) return;
  if (message === lastAnnounce) { el.textContent = ''; }
  lastAnnounce = message;
  window.clearTimeout(announceTimer);
  announceTimer = window.setTimeout(() => { el.textContent = message; }, 30);
}

type ToastListener = (message: string | null) => void;
const toastListeners = new Set<ToastListener>();
let toastTimer: number | undefined;
export function toast(message: string, ms = 3400): void {
  for (const l of toastListeners) l(message);
  announce(message);
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { for (const l of toastListeners) l(null); }, ms);
}
export function onToast(l: ToastListener): () => void {
  toastListeners.add(l);
  return () => toastListeners.delete(l);
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function formatDate(iso: string, timeZone?: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, { month: 'long', day: 'numeric', year: 'numeric', timeZone }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

export function formatDateTime(iso: string, timeZone?: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function formatTodayInZone(iso: string, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', timeZone }).format(new Date(iso));
  } catch {
    const d = new Date(iso);
    return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function envelopePattern(day: number): string {
  const patterns = ['pattern-red', 'pattern-dots-red', 'pattern-forest', 'pattern-candy', 'pattern-ivory', 'pattern-kraft', 'pattern-ivory', 'pattern-red', 'pattern-green-dots', 'pattern-ivory', 'pattern-red', 'pattern-gold-dots', 'pattern-kraft', 'pattern-forest', 'pattern-green-stripes', 'pattern-red', 'pattern-ivory', 'pattern-red', 'pattern-green-tiny', 'pattern-kraft', 'pattern-red-dots', 'pattern-ivory', 'pattern-forest', 'pattern-gold-stripes'];
  return patterns[(day - 1) % 24]!;
}

export function ordinalDate(day: number): string {
  return `December ${day}`;
}

export function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text).then(() => true).catch(() => false);
  return Promise.resolve(false);
}

export function fileNameOf(path: string): string {
  return path.split('/').pop() ?? path;
}
