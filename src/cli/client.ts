/** Talk to a running companion from the CLI or the MCP server; start one when needed. */
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { makeHome, resolveHomeRoot, APP_PORT, GIFT_PORT } from '../core/paths.js';
import { binPath } from '../core/package-paths.js';
import { pidAlive, readLock } from '../server/companion.js';

export interface ClientOptions {
  homeRoot?: string;
  appPort?: number;
}

export class CompanionClient {
  readonly home;
  readonly appPort: number;
  constructor(opts: ClientOptions = {}) {
    this.home = makeHome(resolveHomeRoot(opts.homeRoot));
    const lock = readLock(this.home.lockFile);
    this.appPort = opts.appPort ?? (process.env.ADVENT_AGENT_URL ? Number(new URL(process.env.ADVENT_AGENT_URL).port) : lock?.appPort ?? APP_PORT);
  }

  get baseUrl(): string {
    return process.env.ADVENT_AGENT_URL ?? `http://127.0.0.1:${this.appPort}`;
  }

  token(): string | undefined {
    if (process.env.ADVENT_AGENT_TOKEN) return process.env.ADVENT_AGENT_TOKEN;
    return existsSync(this.home.apiTokenFile) ? readFileSync(this.home.apiTokenFile, 'utf8').trim() : undefined;
  }

  async isRunning(): Promise<boolean> {
    try {
      const r = await fetch(`${this.baseUrl}/api/whoami`, { headers: this.headers(), signal: AbortSignal.timeout(1500) });
      // 401 means a companion answers but our token is wrong: it is running, and the next call will report the error.
      return r.ok || r.status === 401;
    } catch {
      return false;
    }
  }

  headers(extra: Record<string, string> = {}): Record<string, string> {
    const t = this.token();
    return { ...(t ? { authorization: `Bearer ${t}` } : {}), ...extra };
  }

  /** Start a detached companion if none answers, then wait for it. */
  async ensureRunning(opts: { timeoutMs?: number; extraArgs?: string[] } = {}): Promise<void> {
    if (await this.isRunning()) return;
    const lock = readLock(this.home.lockFile);
    if (lock && pidAlive(lock.pid) && (await this.isRunning())) return;
    const child = spawn(process.execPath, [binPath(), 'start', '--no-open', ...(opts.extraArgs ?? [])], {
      detached: true,
      stdio: 'ignore',
      shell: false,
      env: { ...process.env, ADVENT_AGENT_HOME: this.home.root },
      windowsHide: true,
    });
    child.unref();
    const deadline = Date.now() + (opts.timeoutMs ?? 15_000);
    while (Date.now() < deadline) {
      if (await this.isRunning()) return;
      await new Promise((r) => setTimeout(r, 250));
    }
    throw new Error(`The calendar companion did not start on ${this.baseUrl}.`);
  }

  async json<T>(method: string, path: string, body?: unknown): Promise<T> {
    const r = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: this.headers(body !== undefined ? { 'content-type': 'application/json' } : {}),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await r.text();
    let data: unknown;
    try { data = text ? JSON.parse(text) : {}; } catch { data = { message: text }; }
    if (!r.ok) {
      const d = data as { error?: string; message?: string };
      const err = new Error(d.message ?? `HTTP ${r.status}`) as Error & { status: number; code?: string; data?: unknown };
      err.status = r.status;
      err.code = d.error;
      err.data = data;
      throw err;
    }
    return data as T;
  }

  async text(path: string): Promise<string> {
    const r = await fetch(`${this.baseUrl}${path}`, { headers: this.headers() });
    if (!r.ok) throw new Error(`HTTP ${r.status} for ${path}`);
    return r.text();
  }

  async loginUrl(path = '/'): Promise<string> {
    const { token } = await this.json<{ token: string }>('POST', '/api/auth/token');
    return `${this.baseUrl}/auth?t=${token}&to=${encodeURIComponent(path)}`;
  }
}

export const DEMO_PORTS = { app: 4324, gift: 4325 };
export const LAB_PORTS = { app: 4424, gift: 4425 };
export { GIFT_PORT };
