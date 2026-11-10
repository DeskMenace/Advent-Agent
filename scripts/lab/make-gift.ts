/**
 * lab make-gift --idea <id> | --free --harness cc|codex --model <m> [--persona NAME [--persona-from PATH-PART]] [--day N] [--label L] [--port P]
 * Quality test: the full production workflow (launched agent → gate → seal) into a fresh lab calendar, then the
 * automated checks. --idea adds "make this idea" to the brief; --free adds nothing. The tier follows production rules.
 */
import { cpSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { startCompanion } from '../../src/server/companion.js';
import { runChecks } from './checks.js';
import { IDEA_INSTRUCTION, adapterId, freshHome, injectBrief, modelFromLog, outDir, parseFlags, pretend, resolveModel, sleep, useModel, writeJson, YEAR, type Harness } from './common.js';

const DONE = new Set(['ready', 'failed', 'cancelled']);

export async function makeGift(argv: string[]): Promise<number> {
  const f = parseFlags(argv);
  const harness = String(f.harness ?? 'cc') as Harness;
  const model = String(f.model ?? 'default');
  const idea = typeof f.idea === 'string' ? f.idea : undefined;
  const day = Number(f.day ?? 5);
  const label = String(f.label ?? `${idea ?? 'free'}-d${day}-${harness}`);
  const base = Number(f.port ?? 4700);
  const out = outDir('make', label);
  const home = freshHome('make', label, { harness, delivery: 'on_demand', onboardingDone: true });
  useModel(harness, model);
  if (f.timeout) { const { Store } = await import('../../src/core/store.js'); new Store(home).saveConfig((c) => ({ ...c, timeoutMinutes: Number(f.timeout) })); }
  // Production timing: Day 1 is prepared during onboarding, the finale from Dec 20, other doors on their day.
  if (day === 1) pretend(11, 30, 18); else if (day === 24) pretend(12, 20, 10); else pretend(12, day, 10);
  const companion = await startCompanion({ homeRoot: home, appPort: base, giftPort: base + 1, allowRealAgents: true });
  companion.scheduler.stop();
  const service = companion.service;
  service.ensureSeason('live', YEAR);
  // D28: --persona "<name>" picks one of the user's personas the way the setup picker would (a scan, then a choice).
  if (typeof f.persona === 'string') {
    const wanted = f.persona.toLowerCase();
    const found = service.personaCandidates().find((c) => c.name.toLowerCase() === wanted && (typeof f["persona-from"] !== "string" || c.sourcePath.includes(f["persona-from"])));
    if (!found) { console.error(`No persona named "${f.persona}". Found: ${service.personaCandidates().map((c) => c.name).join(', ') || 'none'}`); return 2; }
    service.setPersona({ candidateId: found.id });
    console.log(`[${label}] persona: ${found.name} (${found.sourcePath})`);
  }
  if (idea) injectBrief(service, (d) => (d === day ? IDEA_INSTRUCTION(idea) : undefined));
  const startedAt = Date.now();
  const meta = { label, timeoutMinutes: Number(f.timeout ?? 20), idea: idea ?? null, free: !idea, day, harness, adapter: adapterId(harness), model: resolveModel(harness, model), startedAt: new Date(startedAt).toISOString() };
  writeJson(join(out, 'meta.json'), meta);
  console.log(`[${label}] making door ${day} with ${meta.adapter} (${meta.model})`);

  if (day === 1 || day === 24) service.prepareEarly(day); else service.open(day);
  const season = service.requireSeason();
  let state = service.store.doors(season.year).read(day);
  while (!DONE.has(state.jobState) && Date.now() - startedAt < 75 * 60_000) {
    await sleep(5000);
    state = service.store.doors(season.year).read(day);
  }
  const wallMs = Date.now() - startedAt;
  // The agent usually submits through the CLI before it exits; usage lands in the ledger when the process ends.
  for (let i = 0; i < 120 && (service as unknown as { runs: Map<string, unknown> }).runs.size > 0; i++) await sleep(2000);
  state = service.store.doors(season.year).read(day);
  const { tokens, usd } = ledgerUsage(home, day);
  const logFile = service.store.home.logFile(season.year, day);
  const result: Record<string, unknown> = {
    ...meta, jobState: state.jobState, failure: state.failure, attempts: state.attempts.length, gateRounds: state.attempts.at(-1)?.gateReports ?? 0,
    tokens, usd, wallMs, modelUsed: modelFromLog(logFile) ?? meta.model,
  };
  if (existsSync(logFile)) cpSync(logFile, join(out, 'agent.log'));
  if (state.jobState === 'ready' && state.gift) {
    const m = state.gift.manifest;
    cpSync(service.store.home.giftDir(season.year, day), join(out, 'gift'), { recursive: true });
    Object.assign(result, {
      title: m.title, note: m.note ?? null, signature: m.signature ?? null, ideaUsed: m.ideaId ?? null, family: m.family, emotion: m.emotion, interaction: m.interaction,
      form: m.form, kind: state.gift.kind, entry: m.primary, followUp: m.followUp ?? null, warnings: state.gift.verification.warnings, tierUsed: m.tierUsed,
    });
    pretend(12, day, 10); // open it on its own day
    const checks = await runChecks({
      appUrl: `http://127.0.0.1:${base}`, token: service.store.apiToken(), loginUrl: companion.loginUrl, day,
      manifest: m as never, kind: state.gift.kind, out,
    });
    result.checks = checks.checks;
    result.screenshot = checks.still ?? checks.screenshot;
  }
  // D28: what the Secret Santa found out about the user before making this gift (stays local, for review).
  writeJson(join(out, 'list.json'), service.list());
  const listMd = join(service.store.home.seasonWorkspaceDir(season.year), 'list', 'list.md');
  if (existsSync(listMd)) cpSync(listMd, join(out, 'list.md'));
  result.persona = service.config().persona?.name ?? null;
  result.listLines = service.list().lines.length;
  const seen = join(service.store.home.seasonWorkspaceDir(season.year), 'CLAUDE.md');
  result.personaFileInWorkspace = existsSync(seen);
  writeJson(join(out, 'result.json'), result);
  console.log(`[${label}] ${state.jobState}${result.title ? `: ${result.title}` : ''} · ${tokens} tokens · ${Math.round(wallMs / 60000)} min${state.failure ? ` · ${state.failure.userMessage}` : ''}`);
  await companion.close();
  return state.jobState === 'ready' ? 0 : 1;
}

/** Sum of the calendar's own usage ledger for a door (every agent run, gate repairs included). */
export function ledgerUsage(home: string, day: number): { tokens: number; usd: number } {
  const file = join(home, 'seasons', String(YEAR), 'ledger.jsonl');
  if (!existsSync(file)) return { tokens: 0, usd: 0 };
  const rows = readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l) as { day: number; type: string; tokens?: number; usd?: number }; } catch { return undefined; } });
  const mine = rows.filter((r) => r && r.type === 'usage' && r.day === day) as Array<{ tokens?: number; usd?: number }>;
  return { tokens: mine.reduce((s, r) => s + (r.tokens ?? 0), 0), usd: mine.reduce((s, r) => s + (r.usd ?? 0), 0) };
}
