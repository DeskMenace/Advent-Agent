/**
 * lab invalid-gift --harness cc --model haiku [--port 4960]
 * Rehearsal add-on: the first agent round is replaced by a script that leaves an invalid gift (a network call and no
 * share frame); the second round is the real agent with the gate's problems in its brief. Records whether it repaired it.
 */
import { join } from 'node:path';
import { startCompanion } from '../../src/server/companion.js';
import type { Adapter } from '../../src/adapters/types.js';
import { freshHome, outDir, parseFlags, pretend, resolveModel, sleep, useModel, writeJson, YEAR, type Harness } from './common.js';
import { ledgerUsage } from './make-gift.js';

const BAD = `mkdir -p gift && printf '%s' '{"schema":"advent-agent/gift@2","day":14,"title":"Broken on purpose","emotion":"cute","interaction":["tap"],"entry":"index.html"}' > gift/gift.json && printf '%s' '<!doctype html><html><body><p>hi</p><script>fetch("https://example.com/ping")</script></body></html>' > gift/index.html`;

export async function invalidGift(argv: string[]): Promise<number> {
  const f = parseFlags(argv);
  const harness = String(f.harness ?? 'cc') as Harness;
  const model = String(f.model ?? 'haiku');
  const base = Number(f.port ?? 4960);
  const label = `sim-${harness}-${resolveModel(harness, model)}`;
  const out = outDir('simulate', label);
  const home = freshHome('invalid', label, { harness, delivery: 'on_demand', onboardingDone: true });
  const adapter: Adapter = useModel(harness, model);
  const real = adapter.launch;
  let round = 0;
  adapter.launch = (ctx) => (round++ === 0 ? { command: 'sh', args: ['-c', BAD] } : real(ctx));
  pretend(12, 14, 10);
  const c = await startCompanion({ homeRoot: home, appPort: base, giftPort: base + 1, allowRealAgents: true });
  c.scheduler.stop();
  c.service.ensureSeason('live', YEAR);
  const t0 = Date.now();
  c.service.open(14);
  let s = c.service.store.doors(YEAR).read(14);
  while (!['ready', 'failed', 'cancelled'].includes(s.jobState) && Date.now() - t0 < 40 * 60_000) { await sleep(4000); s = c.service.store.doors(YEAR).read(14); }
  for (let i = 0; i < 60 && (c.service as unknown as { runs: Map<string, unknown> }).runs.size > 0; i++) await sleep(2000);
  s = c.service.store.doors(YEAR).read(14);
  const result = {
    door: 14, outcome: s.jobState, repaired: s.jobState === 'ready', rounds: round, gateReports: s.attempts.at(-1)?.gateReports ?? 0,
    failure: s.failure ?? null, title: s.gift?.manifest.title ?? null, wallMs: Date.now() - t0, ...ledgerUsage(home, 14),
  };
  writeJson(join(out, 'invalid-gift.json'), result);
  console.log(`[invalid-gift] ${JSON.stringify(result)}`);
  await c.close();
  return 0;
}
