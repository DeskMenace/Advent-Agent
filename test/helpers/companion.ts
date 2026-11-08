/** Test helper: a companion in a temp home with free ports, a configured season and a pinned clock. */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { startCompanion, type Companion } from '../../src/server/companion.js';
import type { Config } from '../../src/shared/config.js';

export const FAKE_AGENT = resolve(process.cwd(), 'test/fake-agent/fake-agent.mjs');

export async function freePort(): Promise<number> {
  return new Promise((res, rej) => {
    const s = createServer();
    s.listen(0, '127.0.0.1', () => { const a = s.address(); s.close(() => (a && typeof a !== 'string' ? res(a.port) : rej(new Error('no port')))); });
  });
}

export interface TestCompanion {
  companion: Companion;
  home: string;
  appUrl: string;
  giftUrl: string;
  token: string;
  cookie: string;
  api<T = unknown>(method: string, path: string, body?: unknown, extraHeaders?: Record<string, string>): Promise<{ status: number; data: T; headers: Headers }>;
  close(): Promise<void>;
}

export interface TestCompanionOptions {
  now?: string;
  config?: Partial<Config>;
  seasonKind?: 'live' | 'demo' | 'lab';
  scenario?: string;
  allowRealAgents?: boolean;
  schedulerIntervalMs?: number;
}

export async function testCompanion(opts: TestCompanionOptions = {}): Promise<TestCompanion> {
  const home = mkdtempSync(join(tmpdir(), 'aa-home-'));
  process.env.ADVENT_AGENT_FAKE_NOW = opts.now ?? '2026-12-08T12:00:00Z';
  if (opts.scenario) process.env.FAKE_AGENT_SCENARIO = opts.scenario;
  const appPort = await freePort();
  const giftPort = await freePort();
  const companion = await startCompanion({ homeRoot: home, appPort, giftPort, allowRealAgents: opts.allowRealAgents ?? true, schedulerIntervalMs: opts.schedulerIntervalMs ?? 3_600_000 });
  const store = companion.service.store;
  store.saveConfig({
    setupComplete: true,
    timeZone: 'Europe/Zurich',
    unlockHour: 0,
    connection: { mode: 'launched', adapter: 'custom', customCommand: `"${process.execPath}" "${FAKE_AGENT}" {prompt_file} {workspace} {day}`, permissive: false },
    timeoutMinutes: 1,
    ...opts.config,
  });
  companion.service.ensureSeason(opts.seasonKind ?? 'live', 2026);
  companion.service.updateSeasonFromConfig();
  if (opts.seasonKind && opts.seasonKind !== 'live') writeFileSync(store.home.demoFile, JSON.stringify({ simulatedDay: 8 }));
  const token = store.apiToken();
  const cookie = `aa_session=${companion.auth.makeSessionCookieValue()}`;
  const appUrl = `http://127.0.0.1:${appPort}`;
  return {
    companion,
    home,
    appUrl,
    giftUrl: `http://127.0.0.1:${giftPort}`,
    token,
    cookie,
    async api(method, path, body, extraHeaders = {}) {
      const r = await fetch(`${appUrl}${path}`, {
        method,
        headers: { authorization: `Bearer ${token}`, ...(body !== undefined && !(body instanceof FormData) ? { 'content-type': 'application/json' } : {}), ...extraHeaders },
        body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
      });
      const text = await r.text();
      let data: unknown = text;
      try { data = JSON.parse(text); } catch { /* text */ }
      return { status: r.status, data: data as never, headers: r.headers };
    },
    async close() {
      await companion.close();
      rmSync(home, { recursive: true, force: true });
      delete process.env.FAKE_AGENT_SCENARIO;
    },
  };
}

export async function waitFor<T>(fn: () => Promise<T> | T, pred: (v: T) => boolean, timeoutMs = 20_000, every = 150): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let last: T;
  for (;;) {
    last = await fn();
    if (pred(last)) return last;
    if (Date.now() > deadline) throw new Error(`waitFor timed out; last value: ${JSON.stringify(last).slice(0, 300)}`);
    await new Promise((r) => setTimeout(r, every));
  }
}

/** Run the CLI (via tsx) asynchronously: spawnSync would block the in-process companion. */
export function runCli(args: string[], env: Record<string, string | undefined>, timeoutMs = 60_000): Promise<{ status: number | null; stdout: string; stderr: string }> {
  return new Promise((res) => {
    const child = spawn(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'src/cli/main.ts', ...args], { env: { ...process.env, ...env } as NodeJS.ProcessEnv, shell: false, cwd: process.cwd() });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.on('close', (status) => { clearTimeout(timer); res({ status, stdout, stderr }); });
  });
}
