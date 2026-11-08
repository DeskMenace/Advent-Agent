/**
 * Companion process: both HTTP origins, the scheduler, the lock file. One per home.
 */
import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { serve, type ServerType } from '@hono/node-server';
import { writeJsonAtomic } from '../core/fsutil.js';
import { APP_PORT, GIFT_PORT } from '../core/paths.js';
import { CalendarService } from '../jobs/service.js';
import { Scheduler } from '../jobs/scheduler.js';
import { createApp } from './app.js';
import { Auth } from './auth.js';
import { createGiftApp } from './gift-origin.js';

export interface CompanionOptions {
  homeRoot?: string;
  appPort?: number;
  giftPort?: number;
  allowRealAgents?: boolean;
  /** Enables GET /api/shutdown (tests). */
  allowShutdown?: boolean;
  schedulerIntervalMs?: number;
}

export interface Companion {
  service: CalendarService;
  auth: Auth;
  scheduler: Scheduler;
  appPort: number;
  giftPort: number;
  loginUrl(path?: string): string;
  close(): Promise<void>;
}

export interface LockInfo {
  pid: number;
  appPort: number;
  giftPort: number;
  startedAt: string;
}

export function readLock(lockFile: string): LockInfo | undefined {
  if (!existsSync(lockFile)) return undefined;
  try {
    return JSON.parse(readFileSync(lockFile, 'utf8')) as LockInfo;
  } catch {
    return undefined;
  }
}

export function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === 'EPERM';
  }
}

function listen(app: { fetch: (req: Request, env?: unknown) => Response | Promise<Response> }, port: number): Promise<ServerType> {
  return new Promise((resolve, reject) => {
    const server = serve({ fetch: app.fetch, port, hostname: '127.0.0.1' }, () => resolve(server));
    server.on('error', reject);
  });
}

export async function startCompanion(opts: CompanionOptions = {}): Promise<Companion> {
  const appPort = opts.appPort ?? APP_PORT;
  const giftPort = opts.giftPort ?? GIFT_PORT;
  const service = new CalendarService({ homeRoot: opts.homeRoot, appPort, giftPort, allowRealAgents: opts.allowRealAgents });
  const auth = new Auth(service.store.sessionKey(), service.store.apiToken(), appPort);
  let servers: ServerType[] = [];
  const close = async () => {
    scheduler.stop();
    service.shutdown();
    await Promise.all(servers.map((s) => new Promise<void>((r) => s.close(() => r()))));
    servers = [];
    const lock = readLock(service.store.home.lockFile);
    if (lock && lock.pid === process.pid) { try { unlinkSync(service.store.home.lockFile); } catch { /* gone */ } }
  };
  const app = createApp({ service, auth, onShutdown: opts.allowShutdown ? () => { void close().then(() => process.exit(0)); } : undefined });
  const gift = createGiftApp(service);
  servers = [await listen(app, appPort), await listen(gift, giftPort)];
  writeJsonAtomic(service.store.home.lockFile, { pid: process.pid, appPort, giftPort, startedAt: new Date().toISOString() } satisfies LockInfo, 0o600);
  const scheduler = new Scheduler(service, { intervalMs: opts.schedulerIntervalMs });
  scheduler.start();
  const onSignal = () => { void close().then(() => process.exit(0)); };
  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);
  return {
    service,
    auth,
    scheduler,
    appPort,
    giftPort,
    loginUrl: (path = '/') => `http://127.0.0.1:${appPort}/auth?t=${auth.issueLoginToken()}&to=${encodeURIComponent(path)}`,
    close,
  };
}
