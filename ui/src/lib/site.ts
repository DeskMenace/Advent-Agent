/** App-wide constants (handoff §1.3) and the calendar events Gary will hook into later. */

/** The project repository (footer GitHub mark). */
export const REPO_URL = 'https://github.com/DeskMenace/Advent-Agent';

/** Calendar events, dispatched on `window` as CustomEvents with `{ day }` in `detail`. */
export type AdventEvent = 'door:locked-click' | 'gift:preparing' | 'gift:ready' | 'gift:revealed';
export function emitAdvent(name: AdventEvent, day: number): void {
  window.dispatchEvent(new CustomEvent(name, { detail: { day } }));
}
