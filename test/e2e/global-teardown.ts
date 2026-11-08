import { existsSync, readFileSync, rmSync } from 'node:fs';
import { STATE_FILE } from './global-setup.js';

export default async function globalTeardown(): Promise<void> {
  if (!existsSync(STATE_FILE)) return;
  const state = JSON.parse(readFileSync(STATE_FILE, 'utf8')) as { home: string; pid: number; appPort: number; token: string };
  try { await fetch(`http://127.0.0.1:${state.appPort}/api/shutdown`, { headers: { authorization: `Bearer ${state.token}` } }); } catch { /* already gone */ }
  await new Promise((r) => setTimeout(r, 300));
  try { process.kill(state.pid, 'SIGTERM'); } catch { /* gone */ }
  rmSync(state.home, { recursive: true, force: true });
  rmSync(STATE_FILE, { force: true });
}
