/**
 * lab list-check --harness cc|codex --model <m> [--persona NAME [--persona-from PATH-PART]] [--label L] [--port P]
 * Runs only "checking the list" in a fresh lab calendar and reports what it cost. Output stays under lab/out/list-check/<label>/.
 */
import { cpSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { startCompanion } from '../../src/server/companion.js';
import { adapterId, freshHome, outDir, parseFlags, pretend, resolveModel, useModel, writeJson, YEAR, type Harness } from './common.js';

export async function listCheck(argv: string[]): Promise<number> {
  const f = parseFlags(argv);
  const harness = String(f.harness ?? 'cc') as Harness;
  const model = String(f.model ?? 'default');
  const label = String(f.label ?? `list-check-${harness}`);
  const base = Number(f.port ?? 4740);
  const out = outDir('list-check', label);
  const home = freshHome('list-check', label, { harness, delivery: 'on_demand', onboardingDone: true });
  useModel(harness, model);
  pretend(11, 30, 18);
  const companion = await startCompanion({ homeRoot: home, appPort: base, giftPort: base + 1, allowRealAgents: true });
  companion.scheduler.stop();
  const service = companion.service;
  service.ensureSeason('live', YEAR);
  if (typeof f.persona === 'string') {
    const wanted = f.persona.toLowerCase();
    const found = service.personaCandidates().find((c) => c.name.toLowerCase() === wanted && (typeof f['persona-from'] !== 'string' || c.sourcePath.includes(f['persona-from'])));
    if (!found) { console.error(`No persona named "${f.persona}".`); await companion.close(); return 2; }
    service.setPersona({ candidateId: found.id });
  }
  const started = Date.now();
  const added = await service.checkList('first');
  const rows = readFileSync(join(home, 'seasons', String(YEAR), 'ledger.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as { tokens?: number; usd?: number; note?: string });
  const mine = rows.filter((r) => /checking the list/.test(r.note ?? ''));
  const tokens = mine.reduce((n, r) => n + (r.tokens ?? 0), 0);
  const usd = Number(mine.reduce((n, r) => n + (r.usd ?? 0), 0).toFixed(4));
  const season = service.requireSeason();
  const listLog = join(service.store.home.seasonWorkspaceDir(season.year), '..', 'list', 'log.txt');
  const result = { label, adapter: adapterId(harness), model: resolveModel(harness, model), persona: service.config().persona?.name ?? null, linesAdded: added, lines: service.list().lines.length, tokens, usd, seconds: Math.round((Date.now() - started) / 1000) };
  writeJson(join(out, 'result.json'), result);
  if (existsSync(listLog)) cpSync(listLog, join(out, 'list-log.txt'));
  const md = join(service.store.home.seasonWorkspaceDir(season.year), 'list', 'list.md');
  if (existsSync(md)) cpSync(md, join(out, 'list.md'));
  console.log(JSON.stringify(result));
  await companion.close();
  return added > 0 ? 0 : 1;
}
