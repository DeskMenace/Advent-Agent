/** Typed fetch wrappers for the companion API (same origin, cookie auth) and the SSE stream. */
import type { CalendarResponse, GateReport, RevealedGift, ShelfItem, SseEvent } from '../../src/shared/api.js';
import type { PublicDoor } from '../../src/shared/door.js';
import type { Config, Profile } from '../../src/shared/config.js';
import type { List, Persona, PersonaCandidate } from '../../src/shared/list.js';

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {};
  let payload: BodyInit | undefined;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) { headers['content-type'] = 'application/json'; payload = JSON.stringify(body); }
  const r = await fetch(`/api${path}`, { method, headers, body: payload, credentials: 'same-origin', ...init });
  const text = await r.text();
  let data: unknown = text;
  try { data = text ? JSON.parse(text) : {}; } catch { /* text */ }
  if (!r.ok) {
    const d = (data ?? {}) as { error?: string; message?: string };
    throw new ApiError(r.status, d.error ?? 'error', d.message ?? (typeof data === 'string' ? data : `HTTP ${r.status}`));
  }
  return data as T;
}

export const api = {
  calendar: () => request<CalendarResponse>('GET', '/calendar'),
  door: (day: number) => request<PublicDoor>('GET', `/doors/${day}`),
  open: (day: number) => request<PublicDoor>('POST', `/doors/${day}/open`),
  retry: (day: number) => request<PublicDoor>('POST', `/doors/${day}/retry`),
  cancel: (day: number) => request<PublicDoor>('POST', `/doors/${day}/cancel`),
  reveal: (day: number) => request<RevealedGift>('POST', `/doors/${day}/reveal`),
  gift: (day: number) => request<RevealedGift>('GET', `/doors/${day}/gift`),
  archiveGift: (season: number, day: number) => request<RevealedGift>('GET', `/archive/${season}/${day}`),
  feedback: (day: number, body: { reaction?: string; note?: string }) => request<PublicDoor>('POST', `/doors/${day}/feedback`, body),
  bought: (day: number, bought: boolean, note?: string) => request<{ bought: { at: string; note?: string } | null }>('POST', `/doors/${day}/bought`, { bought, note }),
  consentNetwork: (day: number, origins: string[]) => request<{ allowed: string[] }>('POST', `/doors/${day}/network`, { origins }),
  shelf: () => request<{ season: number | null; items: ShelfItem[] }>('GET', '/gifts'),
  settings: () => request<Config>('GET', '/settings'),
  saveSettings: (patch: Partial<Config>) => request<Config>('PUT', '/settings', patch),
  completeSetup: (patch: Partial<Config>) => request<Config>('POST', '/setup/complete', patch),
  completeOnboarding: (body: { deliveryMode?: 'on_demand' | 'scheduled'; scheduleTime?: string; unlockHour?: number; generosity?: 'light' | 'standard' | 'generous' }) => request<Config>('POST', '/onboarding/complete', body),
  profile: () => request<Profile>('GET', '/profile'),
  saveProfile: (patch: Partial<Profile>) => request<Profile>('PUT', '/profile', patch),
  detect: () => request<{ adapters: Array<{ id: string; label: string; detection: { installed: boolean; version?: string; path?: string; note?: string }; capabilities: { headless: boolean; budgetEnforced: boolean; verified: boolean; canRunCommands: boolean; notes: string[] } }>; deviceTimeZone: string; platform: string }>('GET', '/setup/detect'),
  doctor: () => request<Record<string, unknown>>('GET', '/doctor'),
  service: () => request<{ installed: boolean; running: boolean; detail: string; definition: { path: string; platform: string } }>('GET', '/service'),
  serviceInstall: () => request<{ ok: boolean; message: string }>('POST', '/service/install'),
  serviceUninstall: () => request<{ ok: boolean; message: string }>('POST', '/service/uninstall'),
  testDriveInstall: () => request<{ ok: boolean; message: string; lines: string[] }>('POST', '/testdrive/install'),
  keychain: () => request<{ available: boolean }>('GET', '/providers/keychain'),
  setKey: (id: string, key: string) => request<{ ok: boolean; message: string }>('POST', `/providers/${encodeURIComponent(id)}/key`, { key }),
  deleteKey: (id: string) => request<{ ok: boolean; message: string }>('DELETE', `/providers/${encodeURIComponent(id)}/key`),
  backup: () => request<{ folder: string }>('POST', '/backup'),
  importZip: (form: FormData) => request<{ files: number }>('POST', '/import', form),
  persona: () => request<{ persona: Persona | null }>('GET', '/persona'),
  personaCandidates: () => request<{ candidates: PersonaCandidate[] }>('GET', '/persona/candidates'),
  setPersona: (choice: { candidateId: string } | { fileName: string; text: string } | null) => request<{ persona: Persona | null }>('PUT', '/persona', choice),
  refreshPersona: () => request<{ persona: Persona | null }>('POST', '/persona/refresh'),
  list: () => request<List & { checking: boolean }>('GET', '/list'),
  saveList: (body: { lines?: Array<{ id?: string; text: string }>; pasted?: string }) => request<List & { checking: boolean }>('PUT', '/list', body),
  checkList: () => request<{ started: boolean; checking: boolean }>('POST', '/list/check'),
  labSheet: () => request<{ season: number | null; items: Array<{ day: number; title?: string; kind?: string; idea?: string; agent?: string; state: string; revealed: boolean }>; reviewsFile: string }>('GET', '/lab/review'),
  labSave: (body: unknown) => request<{ saved: string; approved?: string }>('POST', '/lab/review', body),
};

export async function downloadBlob(url: string, filename: string): Promise<void> {
  const r = await fetch(url, { credentials: 'same-origin' });
  if (!r.ok) throw new Error(`Download failed (${r.status})`);
  const blob = await r.blob();
  saveBlob(blob, filename);
}

export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** Server-sent events with automatic reconnect. */
export function subscribe(onEvent: (e: SseEvent) => void): () => void {
  let es: EventSource | undefined;
  let closed = false;
  let retry = 1000;
  const connect = () => {
    if (closed) return;
    es = new EventSource('/api/events', { withCredentials: true });
    const handler = (ev: MessageEvent) => {
      try { onEvent(JSON.parse(ev.data) as SseEvent); } catch { /* ignore */ }
    };
    for (const type of ['door', 'rollover', 'calendar', 'ping']) es.addEventListener(type, handler as EventListener);
    es.onopen = () => { retry = 1000; };
    es.onerror = () => {
      es?.close();
      if (!closed) setTimeout(connect, retry);
      retry = Math.min(retry * 2, 30_000);
    };
  };
  connect();
  return () => { closed = true; es?.close(); };
}
