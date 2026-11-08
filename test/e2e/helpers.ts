import { readFileSync } from 'node:fs';
import type { Page, APIRequestContext } from '@playwright/test';
import { STATE_FILE } from './global-setup.js';

export interface E2EState { home: string; demoHome: string; token: string; appPort: number; giftPort: number }

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

export async function noHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
}

export type { APIRequestContext };
