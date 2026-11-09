/**
 * Lab helpers (developer-only, never shipped). Lab homes live outside the repo (~/.advent-agent-lab/…) so the agents
 * don't load the repo's developer CLAUDE.md; outputs go to lab/out/ (gitignored). Production code is not changed:
 * the model switch and the lab instructions are applied here, in the lab process only.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADAPTERS } from '../../src/adapters/index.js';
import type { Adapter } from '../../src/adapters/types.js';
import { Store } from '../../src/core/store.js';
import { zonedTimeToUtc } from '../../src/core/time.js';
import type { CalendarService } from '../../src/jobs/service.js';

export const REPO = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
export const OUT = join(REPO, 'lab', 'out');
export const LAB_HOMES = join(homedir(), '.advent-agent-lab');
export const YEAR = 2026;
export const TZ = 'Europe/Zurich';

export type Harness = 'cc' | 'codex';
export const adapterId = (h: Harness) => (h === 'cc' ? 'claude-code' : 'codex') as 'claude-code' | 'codex';
/** Codex's configured default (gpt-5.4) is retired on this account, so "default" means Codex's top listed model. */
export const CODEX_DEFAULT = 'gpt-6.1-sol';
export const resolveModel = (h: Harness, model: string) => (h === 'codex' && (model === 'default' || !model) ? CODEX_DEFAULT : model);

export function parseFlags(argv: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) { out[key] = next; i++; } else out[key] = true;
  }
  return out;
}

/** Lab-only model switch: appends --model (Claude Code) or -m (Codex) to the production launch command. */
export function useModel(h: Harness, model: string): Adapter {
  const a = ADAPTERS[adapterId(h)];
  const m = resolveModel(h, model);
  const orig = (a as Adapter & { __origLaunch?: Adapter['launch'] }).__origLaunch ?? a.launch.bind(a);
  (a as Adapter & { __origLaunch?: Adapter['launch'] }).__origLaunch = orig;
  a.launch = (ctx) => {
    const spec = orig(ctx);
    if (!m || m === 'default') return spec;
    if (h === 'codex') spec.args.splice(spec.args.length - 1, 0, '-m', m);
    else spec.args.push('--model', m);
    return spec;
  };
  return a;
}

/** Pin the pretend clock (the developer-only ADVENT_PRETEND_DATE) to a local wall time in Zurich. */
export function pretend(month: number, day: number, hour = 10, minute = 0): Date {
  const at = zonedTimeToUtc(TZ, YEAR, month, day, hour, minute, 0);
  process.env.ADVENT_PRETEND_DATE = at.toISOString();
  return at;
}
export const pretendNow = () => process.env.ADVENT_PRETEND_DATE ?? new Date().toISOString();

/** Fresh lab home with launched mode for the harness. Never touches ~/.advent-agent. */
export function freshHome(kind: string, label: string, opts: { harness: Harness; delivery: 'on_demand' | 'scheduled'; onboardingDone: boolean }): string {
  const home = join(LAB_HOMES, kind, label);
  if (!home.startsWith(LAB_HOMES + '/')) throw new Error('refusing to use a home outside the lab folder');
  rmSync(home, { recursive: true, force: true });
  mkdirSync(home, { recursive: true });
  const store = new Store(home);
  store.saveConfig((c) => ({
    ...c, setupComplete: true, onboardingDone: opts.onboardingDone, timeZone: TZ, unlockHour: 0, deliveryMode: opts.delivery,
    connection: { mode: 'launched', adapter: adapterId(opts.harness), permissive: false },
  }));
  return home;
}

export function outDir(...parts: string[]): string {
  const d = join(OUT, ...parts);
  mkdirSync(d, { recursive: true });
  return d;
}

/**
 * Lab-only brief additions: wraps prepareWorkspace on this service instance so the production brief is written first,
 * then the lab text is appended. `faults` apply to the first round only (the gate repair round sees the clean brief).
 */
export function injectBrief(service: CalendarService, add: (day: number, round: number) => string | undefined): void {
  const proto = Object.getPrototypeOf(service) as CalendarService;
  const orig = proto.prepareWorkspace.bind(service);
  (service as unknown as { prepareWorkspace: CalendarService['prepareWorkspace'] }).prepareWorkspace = (season, day, mode, previous) => {
    const r = orig(season, day, mode, previous);
    const text = add(day, previous ? 1 : 0);
    if (text) appendFileSync(join(r.workspace, 'BRIEF.md'), `\n${text.trim()}\n`);
    return r;
  };
}

export const IDEA_INSTRUCTION = (id: string) => `## Lab instruction\nMake this idea: \`${id}\`. Read its file in the idea library (ideas/${id}.md) and make it as well as you can for this person.`;

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function writeJson(path: string, data: unknown): void {
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
}
export function readJsonSafe<T>(path: string): T | undefined {
  if (!existsSync(path)) return undefined;
  try { return JSON.parse(readFileSync(path, 'utf8')) as T; } catch { return undefined; }
}

/** The model the CLI actually used, from its log (Claude stream-json init line; Codex is always explicit). */
export function modelFromLog(log: string): string | undefined {
  if (!existsSync(log)) return undefined;
  const text = readFileSync(log, 'utf8');
  return /"model":\s*"([^"]+)"/.exec(text)?.[1];
}

export function freePortPair(base: number): { app: number; gift: number } {
  return { app: base, gift: base + 1 };
}
