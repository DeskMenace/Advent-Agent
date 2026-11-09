import { readFileSync } from 'node:fs';
import type { Page, APIRequestContext } from '@playwright/test';
import { STATE_FILE } from './global-setup.js';

export interface E2EState { home: string; userHome: string; demoHome: string; token: string; appPort: number; giftPort: number }

export function state(): E2EState {
  return JSON.parse(readFileSync(STATE_FILE, 'utf8')) as E2EState;
}

export function appUrl(): string { return `http://127.0.0.1:${state().appPort}`; }
export function giftUrl(): string { return `http://127.0.0.1:${state().giftPort}`; }

/** Get a session cookie through the one-time login link. */
export async function login(page: Page, to = '/'): Promise<void> {
  const s = state();
  const r = await fetch(`${appUrl()}/api/auth/token`, { method: 'POST', headers: { authorization: `Bearer ${s.token}` } });
  const { token } = (await r.json()) as { token: string };
  await page.goto(`${appUrl()}/auth?t=${token}&to=${encodeURIComponent(to)}`);
}

export async function api<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  const r = await fetch(`${appUrl()}${path}`, { method, headers: { authorization: `Bearer ${state().token}`, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined });
  const text = await r.text();
  try { return JSON.parse(text) as T; } catch { return text as unknown as T; }
}

export async function setDemoDay(day: number): Promise<void> {
  await api('POST', '/api/demo/day', { day });
}

/** Reset reveal state of a door so a test can open it fresh (demo home only). */
export async function resetDoor(day: number): Promise<void> {
  const s = state();
  const { readFileSync: rf, writeFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const file = join(s.demoHome, 'seasons', '2026', 'doors', String(day).padStart(2, '0'), 'state.json');
  const st = JSON.parse(rf(file, 'utf8')) as Record<string, unknown>;
  st.revealed = false;
  delete st.revealedAt;
  delete st.feedback;
  delete st.bought;
  writeFileSync(file, JSON.stringify(st, null, 2));
}

/** Put a door back to "not requested" (no gift) so a flow can start from the envelope. Demo home only. */
export async function clearDoor(day: number): Promise<void> {
  const { writeFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const dir = join(state().demoHome, 'seasons', '2026', 'doors', String(day).padStart(2, '0'));
  writeFileSync(join(dir, 'state.json'), JSON.stringify({ schemaVersion: 1, day, jobState: 'not_requested', attempt: 0, attempts: [], revealed: false, updatedAt: new Date().toISOString() }));
}

export async function reveal(day: number): Promise<void> {
  await api('POST', `/api/doors/${day}/reveal`).catch(() => undefined);
}

/** Submit a gift package through the agent API (files as text or base64) and optionally reveal it. */
export async function submitGift(day: number, files: Array<{ name: string; text?: string; base64?: string }>, opts: { reveal?: boolean } = {}): Promise<void> {
  await clearDoor(day);
  const r = await api<{ ok: boolean; problems: unknown[] }>('POST', `/api/agent/submit?day=${day}`, { files });
  if (!r.ok) throw new Error(`submit failed: ${JSON.stringify(r.problems)}`);
  if (opts.reveal) await api('POST', `/api/doors/${day}/reveal`);
}

export const env = (day: number) => `.env[data-day="${day}"]`;

export async function noHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
}

export type { APIRequestContext };
