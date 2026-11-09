/** Starts the internal fixture calendar (fixture gifts, simulated December 8) in a temp home for the e2e suite. */
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const E2E_APP_PORT = 4724;
export const E2E_GIFT_PORT = 4725;
export const STATE_FILE = join(tmpdir(), 'advent-agent-e2e-state.json');

export default async function globalSetup(): Promise<void> {
  const home = mkdtempSync(join(tmpdir(), 'aa-e2e-'));
  const child = spawn(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'scripts/fixture-calendar.ts', '--allow-shutdown', '--port', String(E2E_APP_PORT), '--gift-port', String(E2E_GIFT_PORT), '--day', '8'], {
    env: { ...process.env, ADVENT_AGENT_HOME: home, ADVENT_AGENT_E2E: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
    detached: true,
  });
  let log = '';
  child.stdout.on('data', (d) => (log += d.toString()));
  child.stderr.on('data', (d) => (log += d.toString()));
  child.unref();
  const deadline = Date.now() + 60_000;
  const demoHome = join(home, 'demo');
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`http://127.0.0.1:${E2E_APP_PORT}/api/whoami`);
      if (r.status === 401 && existsSync(join(demoHome, 'api.token'))) break;
    } catch { /* not yet */ }
    await new Promise((r) => setTimeout(r, 300));
  }
  if (!existsSync(join(demoHome, 'api.token'))) throw new Error(`demo companion did not start:\n${log}`);
  const token = readFileSync(join(demoHome, 'api.token'), 'utf8').trim();
  // The 2-step onboarding is covered by its own test; everything else starts with it done.
  await fetch(`http://127.0.0.1:${E2E_APP_PORT}/api/settings`, { method: 'PUT', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ onboardingDone: true }) });
  writeFileSync(STATE_FILE, JSON.stringify({ home, demoHome, token, pid: child.pid, appPort: E2E_APP_PORT, giftPort: E2E_GIFT_PORT }));
}
