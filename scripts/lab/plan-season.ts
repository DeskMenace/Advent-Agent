/**
 * lab plan-season --harness cc|codex --model <m> --run <n> [--port 4600]
 * Originality test: the production brief and prompt for days 1→24, with one added instruction (choose, don't build).
 * After each day the choice is recorded as a delivered, opened gift so day N sees days 1…N−1 in its history.
 */
import { copyFileSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { startCompanion } from '../../src/server/companion.js';
import { AgentRun, promptForDoor } from '../../src/jobs/runner.js';
import { GiftManifestSchema, GIFT_KINDS } from '../../src/shared/gift.js';
import { DoorStateSchema } from '../../src/shared/door.js';
import { mascotCentred } from './subject.js';
import { adapterId, freshHome, LAB_HOMES, modelFromLog, outDir, parseFlags, pretend, resolveModel, sleep, useModel, writeJson, YEAR, type Harness } from './common.js';

export const planInstruction = (day: number) => `## Lab instruction: choose only, don't build
This is a lab run that tests how you choose gifts across a season. Do everything you normally do to choose this door's gift (read whatever you usually read: the guide, the index, idea files, skills), then STOP before building. Do not create ./gift and do not submit anything.
Instead write ./doors/${String(day).padStart(2, '0')}/plan.json (valid JSON, nothing else) with exactly these fields:
{
  "ideaId": "<library idea id, or null if you invented it>",
  "family": "<family>",
  "title": "<the gift's title>",
  "pitch": "<1–2 sentences: what it is and what happens when they touch it>",
  "emotion": "funny|ridiculous|absurd|cute|touching",
  "interaction": ["<verb>", "..."],
  "form": "interactive-html|video|audio|image|print|tool|...",
  "render": "2d|3d|either|terminal",
  "tier": "S|M|L|XL",
  "personalDetails": ["<the one or two list details you used, as short phrases>"],
  "shareFrame": "<the single image or loop that sums it up>",
  "followUp": "<the second-life offer you would make in your note, or null>",
  "collection": { "set": "<set name>", "index": 1, "size": 3 } or null
}`;

type Plan = {
  ideaId?: string | null; family?: string; title?: string; pitch?: string; emotion?: string; interaction?: string[] | string; form?: string;
  render?: string; tier?: string; personalDetails?: string[]; shareFrame?: string; followUp?: string | { offer?: string; prompt?: string } | null; collection?: { set: string; index: number; size?: number } | null;
};

/** When each door would be prepared in production: Day 1 during onboarding, the finale from Dec 20, others the night before. */
function prepDate(day: number): void {
  if (day === 1) pretend(11, 30, 18);
  else if (day === 24) pretend(12, 20, 3, 5);
  else pretend(12, day - 1, 3, 5);
}

export async function planSeason(argv: string[]): Promise<number> {
  const f = parseFlags(argv);
  const harness = String(f.harness ?? 'cc') as Harness;
  const model = String(f.model ?? 'default');
  const run = String(f.run ?? '1');
  const base = Number(f.port ?? 4600);
  const label = `${harness}-${resolveModel(harness, model)}-${run}`;
  const out = outDir('plan', label);
  const logs = outDir('plan', label, 'logs');
  const from = Number(f.from ?? 1);
  const to = Number(f.to ?? 24);
  // --from N resumes a run in its existing home (days before N are already recorded there).
  const home = from > 1 ? join(LAB_HOMES, 'plan', label) : freshHome('plan', label, { harness, delivery: 'on_demand', onboardingDone: true });
  const adapter = useModel(harness, model);
  pretend(11, 30, 18);
  const companion = await startCompanion({ homeRoot: home, appPort: base, giftPort: base + 1, allowRealAgents: true });
  companion.scheduler.stop(); // choices only: nothing may launch on its own
  const service = companion.service;
  service.ensureSeason('live', YEAR);
  const season = service.requireSeason();
  const meta = { label, harness, adapter: adapterId(harness), model: resolveModel(harness, model), startedAt: new Date().toISOString(), home };
  writeJson(join(out, 'meta.json'), meta);

  // D28: the Secret Santa checks its list before the first door (production does this right after "Start wrapping").
  if (from === 1) {
    prepDate(1);
    const added = await service.checkList('first');
    console.log(`[${label}] checked the list: ${service.list().lines.length} lines (${added} new)`);
  }
  writeJson(join(out, 'list.json'), service.list());
  const listMd = join(service.store.home.seasonWorkspaceDir(season.year), 'list', 'list.md');
  if (existsSync(listMd)) copyFileSync(listMd, join(out, 'list.md'));

  const mascotDays: number[] = [];
  for (let day = from; day <= to; day++) {
    prepDate(day);
    let plan: Plan | undefined;
    let record: Record<string, unknown> = {};
    for (let attempt = 1; attempt <= 3 && !plan; attempt++) {
      const { workspace, cwd } = service.prepareWorkspace(season, day, 'launched');
      const brief = join(workspace, 'BRIEF.md');
      const { appendFileSync } = await import('node:fs');
      appendFileSync(brief, `\n${planInstruction(day)}\n`);
      rmSync(join(workspace, 'gift'), { recursive: true, force: true });
      const logFile = join(logs, `day-${String(day).padStart(2, '0')}.log`);
      const r = new AgentRun({
        adapter, cwd, workspace, logFile, prompt: promptForDoor(day), day, year: season.year, timeoutMs: 20 * 60_000,
        apiToken: service.store.apiToken(), apiUrl: `http://127.0.0.1:${base}`, webResearch: service.config().permissions.webResearch,
        inspirationFolders: [], permissive: false, onPhase: () => undefined,
      });
      const outcome = await r.run();
      record = { day, attempt, exitCode: outcome.exitCode, timedOut: outcome.timedOut, durationMs: outcome.durationMs, tokens: outcome.usage?.tokens, usd: outcome.usage?.usd, diagnosis: outcome.diagnosis, model: modelFromLog(logFile) ?? meta.model, preparedAt: process.env.ADVENT_PRETEND_DATE };
      const file = join(workspace, 'plan.json');
      if (existsSync(file)) {
        try { plan = JSON.parse(readFileSync(file, 'utf8').replace(/^```(?:json)?\s*|\s*```\s*$/g, '')) as Plan; } catch (e) { record.parseError = (e as Error).message; }
      }
      if (!plan && outcome.diagnosis?.code === 'agent_rate_limited') { console.error(`[${label}] day ${day}: rate limited, waiting 5 min`); await sleep(5 * 60_000); }
      if (!plan) console.error(`[${label}] day ${day} attempt ${attempt}: no plan.json (exit ${outcome.exitCode})`);
    }
    const centred = mascotCentred(plan?.title, plan?.pitch);
    if (centred) mascotDays.push(day);
    writeJson(join(out, `day-${String(day).padStart(2, '0')}.json`), { ...record, plan: plan ?? null, mascotCentred: centred });
    console.log(`[${label}] day ${day}: ${plan ? `${plan.title} (${plan.ideaId ?? 'invented'}, ${plan.family}, ${plan.emotion})` : 'NO PLAN'} · ${record.tokens ?? '?'} tokens · ${Math.round(Number(record.durationMs) / 1000)} s`);
    recordAsDelivered(service, season.year, day, plan);
  }
  writeJson(join(out, 'meta.json'), { ...meta, endedAt: new Date().toISOString(), mascotCentredDays: mascotDays });
  await companion.close();
  if (mascotDays.length) { console.error(`[${label}] FAIL: pitches centred on the mascot or its makers on day(s) ${mascotDays.join(', ')}`); return 1; }
  return 0;
}

function followUpOf(v: unknown): { offer: string; prompt: string } | undefined {
  if (!v) return undefined;
  if (typeof v === 'string') return { offer: v.slice(0, 200), prompt: v.slice(0, 2000) };
  const o = v as { offer?: unknown; prompt?: unknown };
  return o.offer ? { offer: String(o.offer).slice(0, 200), prompt: String(o.prompt ?? o.offer).slice(0, 2000) } : undefined;
}

/** Store the choice as a sealed, opened gift so the next brief's history includes it (lab home only). */
function recordAsDelivered(service: import('../../src/jobs/service.js').CalendarService, year: number, day: number, plan: Plan | undefined): void {
  const now = new Date().toISOString();
  const interaction = (Array.isArray(plan?.interaction) ? plan!.interaction : plan?.interaction ? [plan.interaction] : []).map((s) => String(s).slice(0, 40)).filter(Boolean).slice(0, 8);
  const candidate: Record<string, unknown> = {
    schema: 'advent-agent/gift@2', day, title: (plan?.title || `Door ${day}`).slice(0, 160), ideaId: plan?.ideaId ?? null, family: plan?.family?.slice(0, 60),
    emotion: plan?.emotion, interaction: interaction.length ? interaction : undefined, form: plan?.form?.slice(0, 40), tierUsed: plan?.tier,
    collection: plan?.collection ? { set: String(plan.collection.set).slice(0, 60), index: Math.min(3, Math.max(1, Number(plan.collection.index) || 1)), size: Math.min(3, Math.max(2, Number(plan.collection.size) || 3)) } : null,
    followUp: followUpOf(plan?.followUp),
    detailsUsed: (plan?.personalDetails ?? []).map((d) => String(d).slice(0, 160)).filter(Boolean).slice(0, 4),
    primary: 'index.html',
  };
  let parsed = GiftManifestSchema.safeParse(candidate);
  // Drop whatever the agent got wrong (an unknown emotion, a bad tier) rather than lose the day.
  for (const k of ['emotion', 'tierUsed', 'collection', 'followUp', 'interaction', 'form', 'family', 'detailsUsed'] as const) {
    if (parsed.success) break;
    delete candidate[k];
    parsed = GiftManifestSchema.safeParse(candidate);
  }
  if (!parsed.success) return;
  const kind = (GIFT_KINDS as readonly string[]).includes(plan?.form ?? '') ? plan!.form : 'interactive-html';
  const state = DoorStateSchema.parse({
    day, jobState: 'ready', attempt: 1, attempts: [{ n: 1, mode: 'launched', startedAt: now, endedAt: now, outcome: 'ready' }], revealed: true, revealedAt: now,
    gift: { manifest: parsed.data, kind, files: [], sealedAt: now, attempt: 1, mode: 'launched', verification: { render: 'skipped', secretScan: 'clean' }, networkConsent: [] },
    updatedAt: now,
  });
  service.store.doors(year).write(state);
}
