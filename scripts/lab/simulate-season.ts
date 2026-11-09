/**
 * lab simulate-season --harness cc --model haiku --messy [--port 4900]
 * Dress rehearsal: onboarding (Scheduled) on Nov 30, then the pretend clock steps through December. Each night the
 * scheduler prepares tomorrow's door; each morning a messy user (Playwright) opens doors. Injected failures: the agent
 * is killed once (door 6), one gift is made invalid once (door 14), and the app restarts once (during door 17).
 */
import { chromium, type Page } from '@playwright/test';
import { cpSync, existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { startCompanion, type Companion } from '../../src/server/companion.js';
import type { DoorState } from '../../src/shared/door.js';
import { adapterId, freshHome, injectBrief, outDir, parseFlags, pretend, pretendNow, resolveModel, sleep, useModel, writeJson, YEAR, type Harness } from './common.js';

const BUSY = new Set(['queued', 'preparing', 'validating']);
const FAULT_DOOR = 14;
const KILL_DOOR = 6;
const RESTART_DOOR = 17;
const FAULT = `## Lab fault injection (testing the calendar, not you)
For this run only, add this line inside a <script> in your index.html: fetch('https://example.com/ping');`;

interface Event { wall: string; pretend: string; type: string; door?: number; detail?: string }

export async function simulateSeason(argv: string[]): Promise<number> {
  const f = parseFlags(argv);
  const harness = String(f.harness ?? 'cc') as Harness;
  const model = String(f.model ?? 'haiku');
  const base = Number(f.port ?? 4900);
  const label = `sim-${harness}-${resolveModel(harness, model)}`;
  const out = outDir('simulate', label);
  const shots = outDir('simulate', label, 'shots');
  const home = freshHome('simulate', label, { harness, delivery: 'on_demand', onboardingDone: false });
  useModel(harness, model);
  const events: Event[] = [];
  const log = (type: string, door?: number, detail?: string) => {
    const e = { wall: new Date().toISOString(), pretend: pretendNow(), type, door, detail };
    events.push(e);
    console.log(`[${label}] ${e.pretend.slice(5, 16)} ${type}${door ? ` door ${door}` : ''}${detail ? `: ${detail}` : ''}`);
    writeJson(join(out, 'timeline.json'), { label, harness, adapter: adapterId(harness), model: resolveModel(harness, model), events });
  };

  pretend(11, 30, 18);
  let companion: Companion = await start();
  async function start(): Promise<Companion> {
    const c = await startCompanion({ homeRoot: home, appPort: base, giftPort: base + 1, allowRealAgents: true, schedulerIntervalMs: 10_000 });
    c.service.ensureSeason('live', YEAR);
    injectBrief(c.service, (d, round) => (d === FAULT_DOOR && round === 0 ? FAULT : undefined));
    return c;
  }
  const doors = () => companion.service.store.doors(YEAR);

  // Watch every door's state and log transitions (prepared, failed, ready, opened).
  const last = new Map<number, string>();
  const watcher = setInterval(() => {
    try {
      for (const d of doors().readAll()) {
        const key = `${d.jobState}${d.revealed ? '+opened' : ''}`;
        if (last.get(d.day) !== key) {
          if (last.has(d.day) || key !== 'not_requested') log('state', d.day, `${key}${d.failure ? ` (${d.failure.code}: ${d.failure.userMessage})` : ''}`);
          last.set(d.day, key);
        }
      }
    } catch { /* restarting */ }
  }, 2000);

  const waitIdle = async (maxMs: number): Promise<boolean> => {
    const t0 = Date.now();
    while (Date.now() - t0 < maxMs) {
      try { if (!doors().readAll().some((d) => BUSY.has(d.jobState))) return true; } catch { /* restarting */ }
      await sleep(5000);
    }
    return false;
  };

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => log('ui-error', undefined, e.message.slice(0, 200)));

  const calendar = async () => { await page.goto(companion.loginUrl('/?gary=0')); await page.locator('.env').first().waitFor({ timeout: 20_000 }); };
  const openDoor = async (day: number): Promise<void> => {
    await calendar();
    await page.locator(`.env[data-day="${day}"]`).click();
    const shown = await Promise.race([
      page.locator('.revealed').waitFor({ timeout: 90_000 }).then(() => 'revealed'),
      page.getByRole('button', { name: 'Try again' }).waitFor({ timeout: 90_000 }).then(() => 'failed'),
    ]).catch(() => 'nothing');
    if (shown === 'failed') {
      log('user-retry', day, 'the pop-up showed a failure; clicked Try again');
      await page.getByRole('button', { name: 'Try again' }).click();
      const ok = await page.locator('.revealed').waitFor({ timeout: 40 * 60_000 }).then(() => true, () => false);
      log(ok ? 'recovered' : 'not-recovered', day);
    } else if (shown === 'nothing') {
      log('open-stuck', day, 'neither a gift nor a retry button after 90 s');
    }
    await page.waitForTimeout(2500);
    await page.screenshot({ path: join(shots, `${String(day).padStart(2, '0')}.png`) });
    log('opened', day, shown === 'revealed' ? undefined : shown);
    await page.keyboard.press('Escape');
  };

  // Nov 30: onboarding with Scheduled delivery. Day 1 starts at once.
  await page.goto(companion.loginUrl('/?gary=0'));
  await page.locator('.onboard').waitFor({ timeout: 20_000 });
  await page.getByRole('radio', { name: /Scheduled/ }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('radio', { name: /Standard/ }).click();
  await page.getByRole('button', { name: 'Start wrapping' }).click();
  log('onboarding', undefined, 'Scheduled, Standard');
  await page.waitForTimeout(4000);
  // Messy: open door 1 while it is being prepared, then close the pop-up.
  pretend(12, 1, 0, 5);
  await calendar();
  await page.locator('.env[data-day="1"]').click();
  await page.waitForTimeout(5000);
  await page.screenshot({ path: join(shots, 'during-preparation.png') });
  const present = await page.locator('.reveal').isVisible();
  log('opened-during-preparation', 1, present ? 'pop-up showed the wrapped present; closed it' : 'no pop-up');
  await page.keyboard.press('Escape');
  pretend(11, 30, 18, 30);
  if (!(await waitIdle(45 * 60_000))) log('timeout', 1, 'door 1 still busy after 45 min');

  for (let day = 1; day <= 24; day++) {
    // Night before: the scheduler prepares tomorrow's door (and the finale from Dec 20).
    pretend(12, day, 3, 5);
    companion.scheduler.tick('manual');
    if (day === KILL_DOOR - 1) {
      const run = await waitForRun(KILL_DOOR);
      await sleep(60_000);
      const child = (run as unknown as { child?: { kill: (s: string) => void; exitCode: number | null } } | undefined)?.child;
      if (child && child.exitCode === null) { child.kill('SIGKILL'); log('fault', KILL_DOOR, 'killed the agent process mid-gift (SIGKILL)'); } else log('fault-skipped', KILL_DOOR, 'the agent had already finished');
    }
    if (day === RESTART_DOOR - 1) {
      await waitForRun(RESTART_DOOR);
      await sleep(60_000);
      log('fault', RESTART_DOOR, 'restarting the app while the door is being prepared');
      await companion.close();
      companion = await start();
      log('restarted', undefined, `door ${RESTART_DOOR}: ${doors().read(RESTART_DOOR).jobState}`);
    }
    if (!(await waitIdle(45 * 60_000))) log('timeout', day + 1, 'still busy after 45 min');

    // Morning: the messy user.
    pretend(12, day, 9);
    if (day >= 9 && day <= 11) { log('skipped', day, 'the user did not open the calendar'); continue; }
    const toOpen = day === 12 ? [9, 10, 11, 12] : [day];
    for (const d of toOpen) {
      try { await openDoor(d); } catch (e) { log('open-error', d, (e as Error).message.slice(0, 200)); }
    }
    try {
      if (day === 7) {
        await page.goto(`http://127.0.0.1:${base}/gifts/7`);
        await page.getByRole('button', { name: 'Share' }).click();
        const ok = await page.locator('.share-preview img').waitFor({ timeout: 90_000 }).then(() => true, () => false);
        log('share', 7, ok ? 'share sheet showed the still' : 'no still in the share sheet');
        await page.keyboard.press('Escape');
      }
      if ([3, 8, 15, 19].includes(day)) {
        await page.goto(`http://127.0.0.1:${base}/gifts/${day}`);
        await page.getByRole('button', { name: 'Save' }).click();
        const dl = page.waitForEvent('download', { timeout: 120_000 });
        await page.getByRole('menuitem').first().click();
        const d = await dl;
        log('save', day, d.suggestedFilename());
      }
    } catch (e) { log('action-error', day, (e as Error).message.slice(0, 200)); }
  }

  // Leftovers: anything not opened gets one more try (every door must end up openable).
  for (const d of doors().readAll()) {
    if (!d.revealed) { log('final-open', d.day, d.jobState); try { await openDoor(d.day); } catch (e) { log('open-error', d.day, (e as Error).message); } }
  }
  clearInterval(watcher);
  await browser.close();

  const all = doors().readAll();
  for (const d of all) if (d.gift) cpSync(companion.service.store.home.giftDir(YEAR, d.day), join(out, 'gifts', String(d.day).padStart(2, '0')), { recursive: true });
  writeJson(join(out, 'summary.json'), summarise(all, events, home));
  log('done');
  await companion.close();
  return 0;

  async function waitForRun(day: number): Promise<unknown> {
    for (let i = 0; i < 120; i++) {
      const run = (companion.service as unknown as { runs: Map<string, unknown> }).runs.get(`${YEAR}:${day}`);
      if (run) return run;
      await sleep(2000);
    }
    return undefined;
  }
}

function summarise(all: DoorState[], events: Event[], home: string) {
  const doorsOut = all.map((d) => {
    const m = d.gift?.manifest;
    return {
      day: d.day, jobState: d.jobState, revealed: d.revealed, attempts: d.attempts.length, failures: d.attempts.filter((a) => a.outcome === 'failed').map((a) => a.error ?? 'failed'),
      tokens: d.attempts.reduce((s, a) => s + (a.usage?.tokens ?? 0), 0), wallMs: d.attempts.reduce((s, a) => s + (a.endedAt ? Date.parse(a.endedAt) - Date.parse(a.startedAt) : 0), 0),
      title: m?.title, ideaId: m?.ideaId ?? null, family: m?.family, emotion: m?.emotion, collection: m?.collection ?? null, note: m?.note ?? null, kind: d.gift?.kind,
      warnings: d.gift?.verification.warnings ?? [], gateRounds: d.attempts.reduce((s, a) => s + a.gateReports, 0),
    };
  });
  // Collections: ≤ 3 items, ≤ 2 sets, ≥ 4 days apart, complete.
  const sets = new Map<string, number[]>();
  for (const d of doorsOut) if (d.collection) sets.set(d.collection.set, [...(sets.get(d.collection.set) ?? []), d.day]);
  const collections = [...sets.entries()].map(([set, days]) => ({ set, days, ok: days.length <= 3 && days.every((x, i) => i === 0 || x - days[i - 1]! >= 4), complete: days.length === (all.find((d) => d.gift?.manifest.collection?.set === set)?.gift?.manifest.collection?.size ?? 3) }));
  // Finale: started on Dec 20, and how many earlier titles it mentions.
  const finaleStart = events.find((e) => e.type === 'state' && e.door === 24 && /preparing|queued/.test(e.detail ?? ''));
  const finaleText = readGiftText(join(home, 'seasons', String(YEAR), 'doors', '24', 'gift'));
  const earlier = doorsOut.filter((d) => d.day < 24 && d.title);
  const callbacks = earlier.filter((d) => keyWords(d.title!).some((w) => finaleText.includes(w))).map((d) => d.day);
  const catchUp = [9, 10, 11].map((day) => ({ day, opened: all.find((d) => d.day === day)?.revealed ?? false, openedOn: events.find((e) => e.type === 'opened' && e.door === day)?.pretend }));
  return {
    doors: doorsOut,
    totals: { tokens: doorsOut.reduce((s, d) => s + d.tokens, 0), agentMs: doorsOut.reduce((s, d) => s + d.wallMs, 0), wallMs: Date.parse(events.at(-1)?.wall ?? '') - Date.parse(events[0]?.wall ?? '') },
    checks: {
      everyDoorOpenable: all.every((d) => d.revealed && d.jobState === 'ready'),
      notOpenable: all.filter((d) => !(d.revealed && d.jobState === 'ready')).map((d) => d.day),
      collections, setsCount: collections.length,
      finaleStartedOn: finaleStart?.pretend, finaleStartedDec20: Boolean(finaleStart?.pretend.startsWith(`${YEAR}-12-20`) || finaleStart?.pretend.startsWith(`${YEAR}-12-19T2`)),
      finaleCallbacks: callbacks,
      catchUp,
    },
  };
}

function keyWords(title: string): string[] {
  return title.toLowerCase().split(/[^a-z0-9']+/).filter((w) => w.length >= 6 && !['december', 'little', 'advent', 'gift'].includes(w));
}

function readGiftText(dir: string): string {
  if (!existsSync(dir)) return '';
  let text = '';
  const walk = (d: string) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(html?|json|md|txt|js|svg)$/i.test(n) && statSync(p).size < 2_000_000) text += readFileSync(p, 'utf8').toLowerCase();
    }
  };
  walk(dir);
  return text;
}
