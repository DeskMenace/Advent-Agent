/**
 * Gary on the calendar page only (DESK_MENACE_INTEGRATION §3). gary.js and Gary's assets are served by the
 * companion from the installed npm package; nothing is loaded from a CDN. Hidden under reduced motion unless
 * the user opted in, hidden by the Settings toggle, hidden with ?gary=0 (quality-gate screenshots, visual tests).
 * "Send home" (gary.js's own Remove) is remembered until the next day.
 */
import { useEffect } from 'preact/hooks';
import { prefersReducedMotion } from '../lib/ui.js';

export const GARY_LINES = [
  'Door nine? Let’s circle back on December 9.',
  'I also got a gift. It’s called visibility.',
  'Per my last envelope…',
  'Twenty-four doors. None of them leads to a meeting room. Suspicious.',
  'I’m not saying I peeked. I’m saying I have a strategic overview.',
  'Your Secret Santa works harder than my whole team. Noted for the review.',
  'Let’s align on expectations: it’s an envelope, not a promotion.',
  'I’d open that door, but I’m blocked on a dependency. The date.',
  'Advent? I prefer to call it a 24-day sprint.',
  'Nice calendar. I’ll take credit for it on Monday.',
  'Unwrapping is a two-pizza-team activity. I’ve booked the room.',
  'Patience is a core value. I added it to the slide this morning.',
  'If a door opens and nobody logs it, did it even happen?',
  'I’ve put a hold on December 25. Recurring.',
  'Quick question: is the gift budgeted? Asking for finance.',
  'One door per day. I had notes on the scope.',
];

const DISMISS_KEY = 'advent-agent.gary.sentHomeOn';
const GARY_DISMISSED = 'gary.js:dismissed';

type GaryApi = {
  init(config: unknown): Promise<void>;
  destroy(): void;
  on(name: string, handler: (d?: unknown) => void): () => void;
  reset(): void;
};

declare global {
  interface Window { Gary?: GaryApi; __garyLoading?: Promise<GaryApi | undefined>; }
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function loadGary(): Promise<GaryApi | undefined> {
  if (window.Gary) return Promise.resolve(window.Gary);
  if (window.__garyLoading) return window.__garyLoading;
  window.__garyLoading = new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = '/vendor/gary/dist/gary.core.js';
    s.defer = true;
    s.dataset.autostart = 'false';
    s.onload = () => resolve(window.Gary);
    s.onerror = () => resolve(undefined);
    document.head.appendChild(s);
  });
  return window.__garyLoading;
}

export function garyAllowed(show: boolean, evenWithReducedMotion = false): boolean {
  const params = new URLSearchParams(location.search);
  if (params.get('gary') === '0') return false;
  if (!show) return false;
  if (prefersReducedMotion() && !evenWithReducedMotion) return false;
  // On narrow screens the board fills the width; Gary would inevitably cover envelopes.
  if (window.innerWidth < 780) return false;
  return true;
}

export function Gary(props: { show: boolean; evenWithReducedMotion?: boolean }) {
  useEffect(() => {
    if (!garyAllowed(props.show, props.evenWithReducedMotion)) return;
    let unsub: (() => void) | undefined;
    let destroyed = false;
    void loadGary().then((api) => {
      if (!api || destroyed) return;
      // "Send home" lasts until the next day: clear gary.js's own permanent flag when the day changed.
      try {
        const sentHome = localStorage.getItem(DISMISS_KEY);
        if (sentHome && sentHome !== todayKey()) { localStorage.removeItem(GARY_DISMISSED); localStorage.removeItem(DISMISS_KEY); }
      } catch { /* storage blocked */ }
      unsub = api.on('dismissed', () => { try { localStorage.setItem(DISMISS_KEY, todayKey()); } catch { /* ignore */ } });
      void api.init({
        schemaVersion: 1,
        character: '/vendor/gary/characters/gary/character.json',
        menu: { credit: { label: 'Hire Gary', url: 'https://deskmenace.com/?ref=aa-gary' } },
        lines: { advent: GARY_LINES, hello: ['Oh good. A calendar. I’ll be supervising.', 'Hi. Gary. I manage the envelopes now.'], idle: ['Still staring at the doors? Bold. I respect bold.'] },
        packs: ['advent'],
        // He lives in the left page margin (the intro column starts at ~11% on desktop), may stand on the board's
        // credit line, and never reaches the envelopes or the status panel on his own.
        position: { side: 'left', x: [0.0, 0.08], y: 0.9 },
        entrance: 'arrive',
        scenes: { arrive: [{ enter: 'left', y: 0.9 }, { walkTo: { x: 0.04, y: 0.9 } }, { wait: 0.8 }, { say: '#hello' }] },
        surfaces: '.board-credit',
        dropTo: 'here',
        pace: 'calm',
        height: 170,
        limits: { minGapSeconds: 25, maxLinesPerMinute: 2 },
        triggers: [
          { on: 'load', after: 2, say: '#hello', once: true },
          { on: 'time', after: 40, every: 75, say: '#advent', chance: 0.7 },
          { on: 'idle', after: 50, say: '#idle', cooldown: 120 },
          { on: 'drag', say: '#dragged', cooldown: 2 },
          { on: 'gary-click', count: 1, say: '#advent', cooldown: 8 },
        ],
      });
    });
    return () => {
      destroyed = true;
      unsub?.();
      window.Gary?.destroy();
    };
  }, [props.show, props.evenWithReducedMotion]);
  return null;
}
