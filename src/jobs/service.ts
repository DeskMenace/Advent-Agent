/**
 * CalendarService: every operation the HTTP API, CLI and MCP server expose. One instance per companion process.
 * All spoiler rules are enforced here; routes are thin.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getAdapter } from '../adapters/index.js';
import { buildAgentContext, renderBriefMarkdown, type BriefHistory } from '../core/brief.js';
import { makeClock, readDemoState, type Clock } from '../core/clock.js';
import { cancelDoor, failDoor, IN_FLIGHT, openDoor, recoverDoor, retryDoor, revealDoor, sealDoor, setPhase, toPublicDoor, transition, type DoorStore } from '../core/doors.js';
import { CalendarEvents } from '../core/events.js';
import { writeJsonAtomic } from '../core/fsutil.js';
import { loadPromo, promoFor } from '../core/promo.js';
import { Store } from '../core/store.js';
import { computeEligibility, isDoorEligible, zonedDateString, deviceTimeZone, seasonYearFor, unlockInstant } from '../core/time.js';
import { APP_PORT, GIFT_PORT } from '../core/paths.js';
import { readSealedGift, reportForAgent, runGate, sealGift, type GateInput, type GateResult } from '../intake/gate.js';
import type { AgentContext, CalendarResponse, GateReport, RevealedGift, ShelfItem } from '../shared/api.js';
import type { Config, HistoryRecord, Profile, Season } from '../shared/config.js';
import type { ConnectionMode, DoorState, PublicDoor } from '../shared/door.js';
import type { DoorPhase } from '../shared/gift.js';
import { AgentRun, LIST_PROMPT, promptForDoor } from './runner.js';
import { applyUserEdit, bundleSources, gatherSources, limitPerSource, mergeLines, parseListMd, readList, relabelSources, renderListTask, renderSourceIndex, writeList } from '../core/list.js';
import { personaFromCandidate, personaFromFile, scanPersonas, syncPersona } from '../core/persona.js';
import { resolveHomeRoot } from '../core/paths.js';
import type { List, Persona, PersonaCandidate } from '../shared/list.js';
import { runProvider, ProviderRefused, type GenerateImageParams } from '../providers/index.js';
import { allProviderKeyValues } from '../providers/keychain.js';

/**
 * A hard spend limit for one list check, whatever the user's own cap (Claude Code enforces it with --max-budget-usd; adapters
 * without a budget flag rely on the 64 KB read cap). A normal check costs well under this.
 */
export const LIST_USD_CAP = 0.25;

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ServiceOptions {
  homeRoot?: string;
  appPort?: number;
  giftPort?: number;
  /** Allow real agent launches (false for demo homes). */
  allowRealAgents?: boolean;
}

export class CalendarService {
  readonly store: Store;
  readonly events = new CalendarEvents();
  readonly appPort: number;
  readonly giftPort: number;
  private runs = new Map<string, AgentRun>();
  private closed = false;
  private readonly allowRealAgents: boolean;
  /** Per-gift random path segments for the gift origin; regenerated per process. */
  private giftTokens = new Map<string, string>();

  constructor(opts: ServiceOptions = {}) {
    this.store = new Store(opts.homeRoot);
    this.appPort = opts.appPort ?? APP_PORT;
    this.giftPort = opts.giftPort ?? GIFT_PORT;
    this.allowRealAgents = opts.allowRealAgents ?? true;
    this.recoverAll();
  }

  /** Stop every running agent (companion shutdown). Doors stay in their persisted state and recover on restart. */
  shutdown(): void {
    this.closed = true;
    for (const run of this.runs.values()) run.cancel();
    this.runs.clear();
  }

  // ---- season & clock -------------------------------------------------------------------------
  config(): Config { return this.store.config(); }
  profile(): Profile { return this.store.profile(); }

  season(): Season | undefined { return this.store.currentSeason(); }

  requireSeason(): Season {
    const s = this.season();
    if (!s) throw new ApiError(409, 'no_season', 'No season has been set up yet. Open the calendar to finish setup.');
    return s;
  }

  clock(season = this.requireSeason()): Clock {
    return makeClock({ homeRoot: this.store.home.root, seasonYear: season.year, timeZone: season.timeZone, unlockHour: season.unlockHour, kind: season.kind });
  }

  now(season?: Season): Date {
    const s = season ?? this.season();
    return s ? this.clock(s).now() : new Date();
  }

  /** Create the season from the current config (setup completion). Frozen timezone + unlockHour. */
  ensureSeason(kind: 'live' | 'demo' | 'lab' = 'live', yearOverride?: number): Season {
    const cfg = this.config();
    const year = yearOverride ?? seasonYearFor(new Date(), cfg.timeZone);
    const existing = this.store.season(year);
    if (existing) return existing;
    return this.store.createSeason({
      year,
      timeZone: cfg.timeZone || deviceTimeZone(),
      unlockHour: cfg.unlockHour,
      deliveryMode: cfg.deliveryMode,
      scheduleTime: cfg.scheduleTime,
      prepareDayBefore: cfg.prepareDayBefore,
      connection: cfg.connection,
      kind,
    });
  }

  /** Settings that are frozen per season are copied onto the current season when it has not started. */
  updateSeasonFromConfig(): void {
    const season = this.season();
    if (!season) return;
    const cfg = this.config();
    const now = this.clock(season).now();
    const started = computeEligibility(now, season).eligibleThrough > 0;
    const next: Season = { ...season, deliveryMode: cfg.deliveryMode, scheduleTime: cfg.scheduleTime, prepareDayBefore: cfg.prepareDayBefore, connection: cfg.connection };
    if (!started) { next.timeZone = cfg.timeZone; next.unlockHour = cfg.unlockHour; }
    this.store.saveSeason(next);
  }

  private recoverAll(): void {
    for (const year of this.store.seasonYears()) {
      const doors = this.store.doors(year);
      for (const d of doors.readAll()) {
        const r = recoverDoor(d);
        if (r !== d) doors.write(r);
      }
    }
  }

  // ---- calendar projection -------------------------------------------------------------------
  calendar(): CalendarResponse {
    const cfg = this.config();
    const season = this.season();
    if (!season) {
      const now = new Date();
      return {
        season: { year: seasonYearFor(now, cfg.timeZone), timeZone: cfg.timeZone, unlockHour: cfg.unlockHour, deliveryMode: cfg.deliveryMode, mode: cfg.connection.mode, adapter: cfg.connection.adapter, kind: 'live' },
        now: now.toISOString(),
        eligibleThrough: 0,
        todayDay: 0,
        opened: 0,
        available: 0,
        doors: Array.from({ length: 24 }, (_, i) => toPublicDoor({ day: i + 1, jobState: 'not_requested', attempt: 0, attempts: [], revealed: false, updatedAt: now.toISOString(), schemaVersion: 1 }, false, false)),
        gary: { show: cfg.gary.show },
        setupComplete: cfg.setupComplete,
        onboardingDone: cfg.onboardingDone,
      };
    }
    const now = this.clock(season).now();
    const elig = computeEligibility(now, season);
    const doors = this.store.doors(season.year).readAll().map((d) => this.decorate(season, d, toPublicDoor(d, d.day <= elig.eligibleThrough, d.day === elig.todayDay)));
    const opened = doors.filter((d) => d.revealed).length;
    return {
      season: { year: season.year, timeZone: season.timeZone, unlockHour: season.unlockHour, deliveryMode: season.deliveryMode, mode: season.connection.mode, adapter: season.connection.adapter, kind: season.kind },
      now: now.toISOString(),
      eligibleThrough: elig.eligibleThrough,
      todayDay: elig.todayDay,
      nextUnlockAt: elig.nextUnlockAt,
      countdownDays: elig.countdownDays,
      opened,
      available: elig.eligibleThrough,
      doors,
      gary: { show: cfg.gary.show },
      setupComplete: cfg.setupComplete,
      onboardingDone: cfg.onboardingDone,
      demo: season.kind !== 'live' ? { simulatedDay: readDemoState(this.store.home.root).simulatedDay } : undefined,
    };
  }

  private doorsOf(season: Season): DoorStore { return this.store.doors(season.year); }

  private assertEligible(season: Season, day: number): void {
    if (!Number.isInteger(day) || day < 1 || day > 24) throw new ApiError(404, 'no_such_door', 'There are 24 doors.');
    if (!isDoorEligible(this.clock(season).now(), season, day)) throw new ApiError(423, 'locked', `Not yet! Door ${day} opens on December ${day}.`);
  }

  /**
   * Doors that may be *prepared* (never revealed) before they unlock: Day 1 during setup (D15) and,
   * from December 20 at the unlock hour, December 24 (D17).
   */
  canPrepareEarly(season: Season, day: number): boolean {
    if (day === 1) return true;
    if (day === 24) return this.clock(season).now().getTime() >= unlockInstant(season, 20).getTime();
    return false;
  }

  private assertPreparable(season: Season, day: number): void {
    if (!Number.isInteger(day) || day < 1 || day > 24) throw new ApiError(404, 'no_such_door', 'There are 24 doors.');
    if (isDoorEligible(this.clock(season).now(), season, day) || this.canPrepareEarly(season, day)) return;
    this.assertEligible(season, day);
  }

  /**
   * What the agent knows about earlier doors (D15 rotation): every sealed gift of this season, opened or not,
   * with its family/emotion/interaction/collection, plus the recipient's reactions.
   */
  briefHistory(season: Season): BriefHistory[] {
    const feedback = new Map(this.store.history(season.year).map((h) => [h.day, h]));
    const out: BriefHistory[] = [];
    for (const d of this.doorsOf(season).readAll()) {
      if (!d.gift) continue;
      out.push({ ...historyRecordFor(d.day, d.gift, d.revealedAt ?? d.gift.sealedAt), feedback: d.feedback?.reaction ?? feedback.get(d.day)?.feedback, opened: d.revealed });
    }
    return out;
  }

  private catchUp(season: Season, day: number): { isCatchUp: boolean; pile: number } {
    const elig = computeEligibility(this.clock(season).now(), season);
    const today = elig.todayDay || elig.eligibleThrough;
    const inFlight = this.doorsOf(season).readAll().filter((d) => IN_FLIGHT.has(d.jobState)).length;
    return { isCatchUp: elig.eligibleThrough > 0 && day < today, pile: Math.max(1, inFlight) };
  }

  private publish(season: Season, state: DoorState): void {
    const elig = computeEligibility(this.clock(season).now(), season);
    this.events.emitSse({ type: 'door', door: this.decorate(season, state, toPublicDoor(state, state.day <= elig.eligibleThrough, state.day === elig.todayDay)) });
  }

  /** Opened doors carry their title and thumbnail (already revealed, so never a spoiler). */
  private decorate(season: Season, state: DoorState, door: PublicDoor): PublicDoor {
    if (!state.revealed || !state.gift) return door;
    const thumb = state.gift.thumbnail;
    return { ...door, title: state.gift.manifest.title, thumbnailUrl: thumb ? `http://127.0.0.1:${this.giftPort}/g/${this.giftToken(season.year, state.day)}/${thumb}` : undefined };
  }

  private save(season: Season, state: DoorState): DoorState {
    this.doorsOf(season).write(state);
    this.publish(season, state);
    return state;
  }

  publicDoor(day: number) {
    const season = this.requireSeason();
    const elig = computeEligibility(this.clock(season).now(), season);
    const state = this.doorsOf(season).read(day);
    return this.decorate(season, state, toPublicDoor(state, day <= elig.eligibleThrough, day === elig.todayDay));
  }

  // ---- opening, retry, cancel ---------------------------------------------------------------
  /** Idempotent. Starts the job for the season's mode. Returns the public door. */
  open(day: number, opts: { late?: { scheduledFor: string; reason: string }; mode?: ConnectionMode } = {}) {
    const season = this.requireSeason();
    this.assertEligible(season, day);
    const doors = this.doorsOf(season);
    const current = doors.read(day);
    const mode = opts.mode ?? season.connection.mode;
    const adapter = mode === 'launched' ? season.connection.adapter : undefined;
    const { state, created } = openDoor(current, { mode, adapter, late: opts.late });
    if (!created) return this.publicDoor(day);
    this.save(season, state);
    this.startJob(season, state);
    return this.publicDoor(day);
  }

  /**
   * Start preparing a door before it unlocks (Day 1 at setup, the finale from December 20). Launched mode runs the agent;
   * submit mode waits for a local process to submit. Never reveals.
   */
  prepareEarly(day: number) {
    const season = this.requireSeason();
    if (!this.canPrepareEarly(season, day) && !isDoorEligible(this.clock(season).now(), season, day)) throw new ApiError(423, 'locked', `Door ${day} cannot be prepared yet.`);
    const doors = this.doorsOf(season);
    const mode = season.connection.mode;
    const { state, created } = openDoor(doors.read(day), { mode, adapter: mode === 'launched' ? season.connection.adapter : undefined });
    if (created) {
      this.save(season, state);
      this.startJob(season, state);
    }
    return toPublicDoor(doors.read(day), isDoorEligible(this.clock(season).now(), season, day), false);
  }

  /** Scheduled preparation: may run before the door is eligible. The result stays sealed and invisible until the user opens it. */
  openScheduled(day: number, late?: { scheduledFor: string; reason: string }) {
    const season = this.requireSeason();
    if (season.connection.mode !== 'launched') throw new ApiError(409, 'not_schedulable', 'Only launched agents can be scheduled.');
    const doors = this.doorsOf(season);
    const { state, created } = openDoor(doors.read(day), { mode: 'launched', adapter: season.connection.adapter, late });
    if (!created) return;
    this.save(season, state);
    this.startJob(season, state);
  }

  retry(day: number) {
    const season = this.requireSeason();
    this.assertEligible(season, day);
    const doors = this.doorsOf(season);
    const current = doors.read(day);
    if (current.jobState !== 'failed' && current.jobState !== 'cancelled') throw new ApiError(409, 'not_retryable', 'This door is not in a state that can be retried.');
    doors.archiveWorkspace(day, current.attempt);
    const mode = season.connection.mode;
    const state = retryDoor(current, { mode, adapter: mode === 'launched' ? season.connection.adapter : undefined });
    this.save(season, state);
    this.startJob(season, state);
    return this.publicDoor(day);
  }

  cancel(day: number) {
    const season = this.requireSeason();
    const doors = this.doorsOf(season);
    const current = doors.read(day);
    if (!IN_FLIGHT.has(current.jobState)) throw new ApiError(409, 'nothing_to_cancel', 'Nothing is being prepared for this door.');
    this.runs.get(this.runKey(season, day))?.cancel();
    this.save(season, cancelDoor(current));
    return this.publicDoor(day);
  }

  private runKey(season: Season, day: number): string { return `${season.year}:${day}`; }

  private startJob(season: Season, state: DoorState): void {
    const mode = state.attempts.at(-1)?.mode ?? season.connection.mode;
    if (mode === 'launched') {
      void this.runLaunched(season, state.day);
    } else {
      this.save(season, transition(state, 'waiting_for_agent'));
    }
  }

  // ---- the season workspace (D28) ----------------------------------------------------------------
  /** Folders that belong to the calendar itself: never read for the list, never offered as personas. */
  private ownRoots(): string[] { return [this.store.home.root, resolveHomeRoot()]; }

  /** The one folder every agent run starts in. The chosen persona is kept in sync in CLAUDE.md and AGENTS.md. */
  ensureSeasonWorkspace(season: Season, opts: { forcePersona?: boolean } = {}): string {
    const cwd = this.store.home.seasonWorkspaceDir(season.year);
    mkdirSync(join(cwd, 'doors'), { recursive: true });
    const cfg = this.config();
    const synced = syncPersona(cwd, cfg.persona, { force: opts.forcePersona });
    if (synced && cfg.persona && synced.sourceHash !== cfg.persona.sourceHash) this.store.saveConfig({ persona: synced });
    return cwd;
  }

  /** Earlier doors' sealed gifts, as read-only copies in `doors/NN/gift`, so a collection can grow an earlier gift. */
  private syncEarlierDoors(season: Season, day: number): void {
    for (const d of this.doorsOf(season).readAll()) {
      if (d.day === day || !d.gift) continue;
      const folder = this.store.home.workspaceDir(season.year, d.day);
      const dest = join(folder, 'gift');
      if (existsSync(folder) && !existsSync(join(folder, '.sealed-copy'))) continue; // that door is being worked on right now
      if (existsSync(dest)) continue; // sealed gifts never change
      try {
        mkdirSync(folder, { recursive: true });
        cpSync(this.store.home.giftDir(season.year, d.day), dest, { recursive: true, filter: (src) => !src.split(/[\\/]/).includes('.advent') });
        writeFileSync(join(folder, '.sealed-copy'), 'A read-only copy of the sealed gift. Changes here are ignored.\n');
      } catch { /* a missing copy only costs a collection its context */ }
    }
  }

  /** Workspace + BRIEF for a door (launched runs). The agent starts in the season workspace; the door has its own subfolder. */
  prepareWorkspace(season: Season, day: number, mode: ConnectionMode, previousProblems?: GateResult['problems']): { workspace: string; cwd: string; context: AgentContext } {
    const doors = this.doorsOf(season);
    const state = doors.read(day);
    const cwd = this.ensureSeasonWorkspace(season);
    const workspace = doors.freshWorkspace(day);
    this.syncEarlierDoors(season, day);
    const adapterId = season.connection.adapter;
    const adapter = adapterId ? getAdapter(adapterId) : undefined;
    const context = buildAgentContext({
      season, day, now: this.clock(season).now(), config: this.config(), profile: this.profile(), history: this.briefHistory(season),
      mode, adapter: adapterId, workspace, cwd, list: this.list().lines, persona: this.config().persona, attempt: state.attempt, previousProblems, ...this.catchUp(season, day), tokenEnforced: Boolean(adapter?.capabilities().budgetEnforced && this.config().budgets.usdCapPerGift),
    });
    let brief = renderBriefMarkdown(context);
    const labFile = join(this.store.home.doorDir(season.year, day), 'lab.json');
    if (season.kind === 'lab' && existsSync(labFile)) {
      try {
        const lab = JSON.parse(readFileSync(labFile, 'utf8')) as { idea?: string; free?: boolean };
        brief += lab.free
          ? '\n## Lab instruction\nThis is a lab run. Ignore the idea library entirely and invent something of your own.\n'
          : lab.idea
            ? `\n## Lab instruction\nThis is a lab run. Build the idea \`${lab.idea}\`: read its file in the idea library (ideas/${lab.idea}.md) and execute it as well as you can.\n`
            : '';
      } catch { /* ignore */ }
    }
    writeFileSync(join(workspace, 'BRIEF.md'), brief);
    writeJsonAtomic(join(workspace, 'brief.json'), context);
    mkdirSync(join(workspace, 'gift'), { recursive: true });
    return { workspace, cwd, context };
  }

  // ---- persona and the list (D28) -------------------------------------------------------------------
  list(): List { return readList(this.store.home.listFile); }

  personaCandidates(): PersonaCandidate[] { return scanPersonas({ ownRoots: this.ownRoots() }); }

  /** "One of my personas": pick a scanned candidate (by id) or a file the user chose. Pass null to go back to "Just my agent". */
  setPersona(choice: { candidateId?: string; file?: string; fileName?: string; text?: string } | null): Persona | undefined {
    let persona: Persona | undefined;
    if (choice?.text?.trim()) {
      // "Choose a file…": a browser gives us the text, not the path, so the text is kept as the persona's source.
      const slug = (choice.fileName ?? 'persona').replace(/\.[A-Za-z0-9]+$/, '').replace(/[^A-Za-z0-9_-]+/g, '-').slice(0, 40) || 'persona';
      const dir = join(this.store.home.root, 'personas');
      mkdirSync(dir, { recursive: true });
      const file = join(dir, `${slug}.md`);
      writeFileSync(file, choice.text);
      choice = { file };
    }
    if (choice?.candidateId) {
      const c = this.personaCandidates().find((x) => x.id === choice.candidateId);
      if (!c) throw new ApiError(404, 'no_such_persona', 'That persona was not found any more. Scan again.');
      persona = personaFromCandidate(c);
    } else if (choice?.file) {
      persona = personaFromFile(choice.file);
      if (!persona) throw new ApiError(400, 'bad_persona_file', 'That file could not be read, or it is empty.');
    }
    this.store.saveConfig((cur) => ({ ...cur, persona }));
    const season = this.season();
    if (season) this.ensureSeasonWorkspace(season, { forcePersona: true });
    this.events.emitSse({ type: 'calendar' });
    return this.config().persona;
  }

  /** Settings → "Refresh": copy the persona text again from its source file. */
  refreshPersona(): Persona | undefined {
    const season = this.season();
    if (season) this.ensureSeasonWorkspace(season, { forcePersona: true });
    return this.config().persona;
  }

  /** Edits made in Settings: lines changed or deleted, pasted text. Never required. */
  saveList(edit: { lines?: Array<{ id?: string; text: string }>; pasted?: string }): List {
    return writeList(this.store.home.listFile, applyUserEdit(this.list(), edit));
  }

  private listLog(season: Season): string {
    const f = this.store.home.listLogFile(season.year);
    mkdirSync(join(f, '..'), { recursive: true });
    return f;
  }

  private listRun?: Promise<number>;
  private listFailedAt = 0;
  listChecking(): boolean { return Boolean(this.listRun); }

  /** The first check happens before the first door of a season is made; December 8 and 15 refresh it ("checking it twice"). */
  listCheckDue(season: Season, now = this.clock(season).now()): 'first' | 'refresh' | undefined {
    if (season.kind === 'demo' || season.connection.mode !== 'launched' || !season.connection.adapter) return undefined;
    const list = this.list();
    if (list.checks.length === 0) return 'first';
    const milestone = [15, 8].find((d) => now.getTime() >= unlockInstant(season, d).getTime());
    if (!milestone) return undefined;
    const since = unlockInstant(season, milestone).getTime();
    return list.checks.some((c) => c.kind === 'refresh' && Date.parse(c.at) >= since) ? undefined : 'refresh';
  }

  /** Scheduler hook: refresh the list on December 8 and 15, at most one failed attempt every six hours. */
  maybeRefreshList(): void {
    const season = this.season();
    if (!season || this.listRun || this.closed) return;
    if (this.listCheckDue(season) !== 'refresh') return;
    if (Date.now() - this.listFailedAt < 6 * 3600_000) return;
    void this.checkList('refresh').catch(() => { this.listFailedAt = Date.now(); });
  }

  /**
   * One launched agent run, as the chosen persona, with a modest token cap (tier S). It reads only copies of an allow-list of files
   * the app chose, writes list.md, and the app merges the lines into list.json. Returns the number of new lines.
   */
  checkList(kind: 'first' | 'refresh', onStart?: () => void): Promise<number> {
    if (this.listRun) return this.listRun;
    const run = this.runListCheck(kind, onStart).finally(() => { this.listRun = undefined; this.events.emitSse({ type: 'calendar' }); });
    this.listRun = run;
    this.events.emitSse({ type: 'calendar' });
    return run;
  }

  private async runListCheck(kind: 'first' | 'refresh', onStart?: () => void): Promise<number> {
    const season = this.requireSeason();
    const adapterId = season.connection.adapter;
    const adapter = adapterId ? getAdapter(adapterId) : undefined;
    if (!adapter) throw new ApiError(409, 'no_adapter', 'No agent is configured. Open Settings to connect one.');
    if (!this.allowRealAgents || season.kind === 'demo') throw new ApiError(403, 'demo', 'Demo calendars never run a real agent.');
    const cfg = this.config();
    const profile = this.profile();
    const cwd = this.ensureSeasonWorkspace(season);
    const task = join(cwd, 'list');
    rmSync(task, { recursive: true, force: true });
    mkdirSync(task, { recursive: true });
    const list = this.list();
    const sources = gatherSources(task, { adapter: adapter.id, persona: cfg.persona, ownRoots: this.ownRoots() });
    if (list.pasted.trim()) {
      writeFileSync(join(task, 'sources', 'pasted.md'), list.pasted);
      sources.push({ copy: 'sources/pasted.md', label: 'pasted' });
    }
    writeFileSync(join(task, 'sources', 'INDEX.md'), renderSourceIndex(sources));
    bundleSources(task, sources);
    writeFileSync(join(task, 'TASK.md'), renderListTask({ sources, hasPasted: Boolean(list.pasted.trim()), existing: list.lines.map((l) => l.text), avoid: profile.avoid, personaName: cfg.persona?.name }));
    onStart?.();
    const run = new AgentRun({
      adapter, task: 'list', cwd, workspace: task, logFile: this.listLog(season), prompt: LIST_PROMPT, day: 0, year: season.year,
      timeoutMs: Math.min(cfg.timeoutMinutes, 10) * 60_000, apiToken: this.store.apiToken(), apiUrl: `http://127.0.0.1:${this.appPort}`,
      webResearch: false, inspirationFolders: [], usdCap: cfg.budgets.usdCapPerGift ? Math.min(cfg.budgets.usdCapPerGift * 0.5, LIST_USD_CAP) : LIST_USD_CAP,
      permissive: season.connection.permissive, customCommand: season.connection.customCommand, onPhase: () => undefined,
    });
    const outcome = await run.run();
    if (outcome.usage) this.store.appendLedger(season.year, { at: new Date().toISOString(), type: 'usage', tokens: outcome.usage.tokens, usd: outcome.usage.usd, note: `${adapter.label} · checking the list` });
    const file = join(task, 'list.md');
    const fresh = existsSync(file) ? limitPerSource(relabelSources(parseListMd(readFileSync(file, 'utf8'), { avoid: profile.avoid }), sources)) : [];
    // The copies of the user's files do not stay in the workspace.
    rmSync(join(task, 'sources'), { recursive: true, force: true });
    const before = this.list();
    const merged = mergeLines({ ...before, pasted: outcome.exitCode === 0 || fresh.length ? '' : before.pasted }, fresh);
    const added = merged.lines.length - before.lines.length;
    writeList(this.store.home.listFile, { ...merged, checks: [...before.checks, { at: this.clock(season).now().toISOString(), kind, lines: fresh.length }] });
    if (!fresh.length) this.listFailedAt = Date.now();
    return Math.max(added, 0);
  }

  private async runLaunched(season: Season, day: number): Promise<void> {
    const doors = this.doorsOf(season);
    let state = doors.read(day);
    const adapterId = season.connection.adapter;
    const adapter = adapterId ? getAdapter(adapterId) : undefined;
    if (!adapter) { this.save(season, failDoor(state, 'no_adapter', 'No agent is configured. Open Settings to connect one.')); return; }
    if (!this.allowRealAgents || season.kind === 'demo') { this.save(season, failDoor(state, 'demo', 'Demo calendars never run a real agent.', false)); return; }
    const det = await adapter.detect();
    if (!det.installed && adapter.id !== 'custom') { this.save(season, failDoor(state, 'agent_missing', `${adapter.label} is not installed on this computer (we looked for "${adapter.binary}" on your PATH).`)); return; }
    const cfg = this.config();
    // "Checking the list": before the first door of a season is made, the Secret Santa learns who it is giving to.
    if (this.listCheckDue(season) === 'first') {
      try {
        await this.checkList('first', () => { try { this.save(season, { ...doors.read(day), phase: 'list' }); } catch { /* door moved on */ } });
      } catch (e) {
        this.listFailedAt = Date.now();
        console.error('checking the list:', (e as Error).message);
      }
      if (this.closed) return;
    } else if (this.listRun) {
      await this.listRun.catch(() => undefined);
    }
    let previousProblems: GateResult['problems'] | undefined;
    for (let round = 0; round < 2; round++) {
      state = doors.read(day);
      if (state.jobState === 'cancelled') return;
      const { workspace, cwd } = this.prepareWorkspace(season, day, 'launched', previousProblems);
      state = this.save(season, round === 0 ? transition(state, 'preparing') : state.jobState === 'validating' ? transition(state, 'preparing') : state);
      const run = new AgentRun({
        adapter, cwd, workspace, logFile: this.store.home.logFile(season.year, day), prompt: promptForDoor(day), day, year: season.year,
        timeoutMs: cfg.timeoutMinutes * 60_000, apiToken: this.store.apiToken(), apiUrl: `http://127.0.0.1:${this.appPort}`,
        webResearch: cfg.permissions.webResearch, inspirationFolders: cfg.permissions.inspirationFolders, usdCap: cfg.budgets.usdCapPerGift,
        permissive: season.connection.permissive, customCommand: season.connection.customCommand,
        onPhase: (phase) => { try { this.progress(day, phase); } catch { /* door moved on */ } },
      });
      this.runs.set(this.runKey(season, day), run);
      const outcome = await run.run();
      this.runs.delete(this.runKey(season, day));
      if (this.closed) return;
      state = doors.read(day);
      if (state.jobState === 'cancelled' || state.jobState === 'not_requested') return; // cancelled, or the home disappeared
      if (outcome.usage) {
        this.store.appendLedger(season.year, { at: new Date().toISOString(), day, type: 'usage', tokens: outcome.usage.tokens, usd: outcome.usage.usd, note: adapter.label });
        const attempts = state.attempts.slice();
        const cur = attempts.at(-1);
        if (cur) attempts[attempts.length - 1] = { ...cur, usage: outcome.usage };
        state = { ...state, attempts };
        doors.write(state);
      }
      if (state.jobState === 'ready') return; // the agent submitted through the CLI/API
      if (outcome.timedOut) { this.save(season, failDoor(state, 'timeout', `Your Secret Santa ran out of time (${cfg.timeoutMinutes} min). You can try again.`)); return; }
      if (outcome.error && outcome.error !== 'cancelled') { this.save(season, failDoor(state, 'launch_failed', outcome.error)); return; }
      if (!outcome.giftFolder || !existsSync(join(outcome.giftFolder, 'gift.json')) && !hasAnyFile(outcome.giftFolder)) {
        const logHint = ` The private log has details: ${this.store.home.logFile(season.year, day)}`;
        if (outcome.diagnosis) { this.save(season, failDoor(state, outcome.diagnosis.code, `${adapter.label} ${outcome.diagnosis.message}`)); return; }
        if (outcome.exitCode !== 0) { this.save(season, failDoor(state, 'agent_exit', `${adapter.label} stopped without finishing (exit code ${outcome.exitCode ?? 'unknown'}).${logHint}`)); return; }
        this.save(season, failDoor(state, 'no_gift', `${adapter.label} finished but left nothing in ./gift.${logHint}`)); return;
      }
      // Auto-submit whatever the agent left in ./gift.
      const result = await this.gateAndSeal(season, day, { type: 'folder', path: outcome.giftFolder }, 'launched', adapter.id);
      if (result.ok) return;
      previousProblems = result.problems;
      state = doors.read(day);
      if (round === 1 || state.jobState !== 'validating') {
        this.save(season, failDoor(state, 'gate_failed', 'The gift did not pass the quality check: ' + summarise(result.problems)));
        return;
      }
      const attempts = state.attempts.slice();
      const cur = attempts.at(-1);
      if (cur) attempts[attempts.length - 1] = { ...cur, gateReports: cur.gateReports + 1 };
      doors.write({ ...state, attempts });
    }
  }

  // ---- progress & submission (all modes) ----------------------------------------------------
  progress(day: number, phase: DoorPhase) {
    const season = this.requireSeason();
    const doors = this.doorsOf(season);
    const current = doors.read(day);
    if (!IN_FLIGHT.has(current.jobState)) throw new ApiError(409, 'not_preparing', `Door ${day} is not being prepared.`);
    return this.save(season, setPhase(current, phase));
  }

  /** Values that must never appear inside a gift: the API token and every provider key. */
  private async secretValues(): Promise<string[]> {
    return allProviderKeyValues(this.config().providers.map((p) => p.id));
  }

  /** Gate without sealing (CLI `check`). */
  async check(input: GateInput, day?: number): Promise<GateReport> {
    const cfg = this.config();
    const result = await runGate(input, { day, limits: { maxFiles: cfg.intakeLimits.maxFiles, maxTotalBytes: cfg.intakeLimits.maxTotalMB * 1024 * 1024 }, apiToken: this.store.apiToken(), keychainValues: await this.secretValues(), keepQuarantine: false, allowedNetwork: cfg.permissions.giftNetwork ? undefined : [] });
    if (result.root) rmSync(result.root, { recursive: true, force: true });
    return reportForAgent(result);
  }

  /** Submit for a door: runs the gate, seals on success, marks ready. Works from any in-flight or fresh state of an eligible door. */
  async submit(day: number, input: GateInput, mode?: ConnectionMode, adapter?: string): Promise<GateReport> {
    const season = this.requireSeason();
    this.assertPreparable(season, day);
    const doors = this.doorsOf(season);
    let state = doors.read(day);
    if (state.jobState === 'ready') throw new ApiError(409, 'already_ready', `Door ${day} already has a gift.`);
    if (state.jobState === 'not_requested' || state.jobState === 'failed' || state.jobState === 'cancelled') {
      // A submission counts as opening/retrying the door in submit mode.
      const m = mode ?? 'submit';
      state = state.jobState === 'not_requested' ? openDoor(state, { mode: m, adapter }).state : retryDoor(state, { mode: m, adapter });
      doors.write(state);
    }
    const result = await this.gateAndSeal(season, day, input, mode ?? state.attempts.at(-1)?.mode ?? 'submit', adapter);
    return result;
  }

  private async gateAndSeal(season: Season, day: number, input: GateInput, mode: ConnectionMode, adapter?: string): Promise<GateReport> {
    const doors = this.doorsOf(season);
    let state = doors.read(day);
    if (state.jobState !== 'validating') state = this.save(season, transition(state, 'validating'));
    const cfg = this.config();
    const result = await runGate(input, {
      day,
      limits: { maxFiles: cfg.intakeLimits.maxFiles, maxTotalBytes: cfg.intakeLimits.maxTotalMB * 1024 * 1024 },
      apiToken: this.store.apiToken(),
      keychainValues: await this.secretValues(),
      allowedNetwork: cfg.permissions.giftNetwork ? undefined : [],
      quarantineRoot: join(this.store.home.doorDir(season.year, day), 'quarantine'),
    });
    state = doors.read(day);
    if (state.jobState === 'cancelled') { if (result.root) rmSync(result.root, { recursive: true, force: true }); return reportForAgent(result); }
    if (!result.ok) {
      // Back to the waiting state the mode implies so the agent/user can fix and resubmit.
      const back = mode === 'launched' ? state : transition(state, 'waiting_for_agent');
      this.save(season, back);
      return reportForAgent(result);
    }
    const sealed = sealGift(result, this.store.home.giftDir(season.year, day), { attempt: state.attempt, mode, adapter });
    state = this.save(season, sealDoor(doors.read(day), sealed));
    if (!cfg.debugKeepWorkspace) rmSync(this.store.home.workspaceDir(season.year, day), { recursive: true, force: true });
    rmSync(join(this.store.home.doorDir(season.year, day), 'quarantine'), { recursive: true, force: true });
    if (sealed.manifest.usage) this.store.appendLedger(season.year, { at: new Date().toISOString(), day, type: 'usage', tokens: sealed.manifest.usage.tokens, usd: sealed.manifest.usage.usd, note: 'reported by the agent in gift.json' });
    return reportForAgent(result);
  }

  // ---- reveal, feedback, bought ---------------------------------------------------------------
  /** Reveal (first open of a ready gift) and return the full gift. Only for eligible, ready doors. */
  reveal(day: number): RevealedGift {
    const season = this.requireSeason();
    this.assertEligible(season, day);
    const doors = this.doorsOf(season);
    let state = doors.read(day);
    if (state.jobState !== 'ready' || !state.gift) throw new ApiError(409, 'not_ready', 'This gift is not ready yet.');
    if (!state.revealed) {
      const gift = state.gift;
      state = this.save(season, revealDoor(state, this.clock(season).now()));
      this.store.appendHistory(season.year, historyRecordFor(day, gift, state.revealedAt!));
    }
    return this.revealedGift(season, state);
  }

  /** The gift of a door that has already been revealed (revisits). */
  gift(day: number, year?: number): RevealedGift {
    const season = year ? this.store.season(year) : this.requireSeason();
    if (!season) throw new ApiError(404, 'no_season', 'No such season.');
    const state = this.doorsOf(season).read(day);
    if (!state.revealed || !state.gift) {
      if (year && year !== this.season()?.year) throw new ApiError(404, 'not_revealed', 'This door was never opened.');
      this.assertEligible(season, day);
      throw new ApiError(409, 'not_revealed', 'Open the envelope first.');
    }
    return this.revealedGift(season, state);
  }

  private revealedGift(season: Season, state: DoorState): RevealedGift {
    const gift = state.gift!;
    const cfg = this.config();
    const today = zonedDateString(this.clock(season).now(), season.timeZone);
    return {
      day: state.day,
      season: season.year,
      revealedAt: state.revealedAt!,
      gift,
      baseUrl: `http://127.0.0.1:${this.giftPort}/g/${this.giftToken(season.year, state.day)}`,
      promo: promoFor(loadPromo(), state.day, state.revealed, today),
      bought: state.bought,
      feedback: state.feedback ? { reaction: state.feedback.reaction, note: state.feedback.note } : undefined,
    };
  }

  /** Random path segment per gift so gift URLs cannot be guessed by a page on the gift origin. */
  giftToken(year: number, day: number): string {
    const key = `${year}:${day}`;
    let t = this.giftTokens.get(key);
    if (!t) {
      t = `${year}-${String(day).padStart(2, '0')}-${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;
      this.giftTokens.set(key, t);
    }
    return t;
  }

  /** Resolve a gift token to its sealed folder, only if the door is revealed (or ready and being revealed). */
  resolveGiftToken(token: string): { year: number; day: number; dir: string; state: DoorState } | undefined {
    for (const [key, t] of this.giftTokens) {
      if (t !== token) continue;
      const [y, d] = key.split(':').map(Number);
      const season = this.store.season(y!);
      if (!season) return undefined;
      const state = this.doorsOf(season).read(d!);
      if (!state.revealed || !state.gift) return undefined;
      return { year: y!, day: d!, dir: this.store.home.giftDir(y!, d!), state };
    }
    return undefined;
  }

  feedback(day: number, feedback: { reaction?: 'loved_it' | 'not_my_thing' | 'too_personal'; note?: string }) {
    const season = this.requireSeason();
    const doors = this.doorsOf(season);
    const state = doors.read(day);
    if (!state.revealed || !state.gift) throw new ApiError(409, 'not_revealed', 'Open the gift first.');
    const next = { ...state, feedback: { ...feedback, at: new Date().toISOString() }, updatedAt: new Date().toISOString() };
    doors.write(next);
    // Keep history in sync for the brief (last record for this day wins).
    const gift = state.gift;
    this.store.appendHistory(season.year, { ...historyRecordFor(day, gift, state.revealedAt!), feedback: feedback.reaction });
    return toPublicDoor(next, true, false);
  }

  /** The user's own "I bought it" mark (D1). Local only. */
  markBought(day: number, bought: boolean, note?: string) {
    const season = this.requireSeason();
    const doors = this.doorsOf(season);
    const state = doors.read(day);
    if (!state.revealed) throw new ApiError(409, 'not_revealed', 'Open the gift first.');
    const next: DoorState = { ...state, bought: bought ? { at: new Date().toISOString(), note } : undefined, updatedAt: new Date().toISOString() };
    doors.write(next);
    if (bought) this.store.appendLedger(season.year, { at: new Date().toISOString(), day, type: 'bought', note });
    return next.bought;
  }

  /** Consent to the network origins a gift declared. */
  consentNetwork(day: number, origins: string[]) {
    const season = this.requireSeason();
    const doors = this.doorsOf(season);
    const state = doors.read(day);
    if (!state.gift) throw new ApiError(409, 'not_ready', 'No gift yet.');
    const declared = state.gift.manifest.network.map((u) => new URL(u).origin);
    const allowed = origins.filter((o) => declared.includes(o));
    const gift = { ...state.gift, networkConsent: allowed };
    const next = { ...state, gift, updatedAt: new Date().toISOString() };
    doors.write(next);
    const sealedFile = join(this.store.home.giftDir(season.year, day), '.advent', 'manifest.sealed.json');
    if (existsSync(sealedFile)) writeFileSync(sealedFile, JSON.stringify(gift, null, 2));
    return allowed;
  }

  // ---- shelf & archive --------------------------------------------------------------------------
  shelf(year?: number): ShelfItem[] {
    const season = year ? this.store.season(year) : this.season();
    if (!season) return [];
    return this.doorsOf(season)
      .readAll()
      .filter((d) => d.revealed && d.gift)
      .map((d) => ({
        day: d.day, season: season.year, title: d.gift!.manifest.title, kind: d.gift!.kind, category: d.gift!.manifest.category, revealedAt: d.revealedAt!,
        thumbnailUrl: d.gift!.thumbnail ? `http://127.0.0.1:${this.giftPort}/g/${this.giftToken(season.year, d.day)}/${d.gift!.thumbnail}` : undefined,
        collection: d.gift!.manifest.collection ? { set: d.gift!.manifest.collection.set, index: d.gift!.manifest.collection.index, size: d.gift!.manifest.collection.size } : undefined,
      }))
      .sort((a, b) => a.day - b.day);
  }

  archiveSeasons(): Array<{ year: number; opened: number; timeZone: string; current: boolean }> {
    const current = this.season()?.year;
    return this.store.seasonYears().filter((y) => this.store.season(y)?.kind === 'live' || y === current).map((y) => ({
      year: y, timeZone: this.store.season(y)!.timeZone, opened: this.doorsOf(this.store.season(y)!).readAll().filter((d) => d.revealed).length, current: y === current,
    }));
  }

  // ---- agent context (bearer) ---------------------------------------------------------------------
  agentContext(day?: number, mode?: ConnectionMode): AgentContext {
    const season = this.requireSeason();
    const elig = computeEligibility(this.clock(season).now(), season);
    const doors = this.doorsOf(season);
    let target = day;
    if (!target) {
      const waiting = doors.readAll().find((d) => (d.day <= elig.eligibleThrough || this.canPrepareEarly(season, d.day)) && (d.jobState === 'waiting_for_agent' || d.jobState === 'waiting_for_drop' || d.jobState === 'preparing' || d.jobState === 'queued'));
      target = waiting?.day;
      if (!target) throw new ApiError(404, 'no_pending_door', 'No door is waiting for a gift right now. The recipient opens an envelope first.');
    }
    this.assertPreparable(season, target);
    const state = doors.read(target);
    const m = mode ?? state.attempts.at(-1)?.mode ?? season.connection.mode;
    return buildAgentContext({ season, day: target, now: this.clock(season).now(), config: this.config(), profile: this.profile(), history: this.briefHistory(season), list: this.list().lines, persona: this.config().persona, mode: m, attempt: state.attempt, ...this.catchUp(season, target), workspace: existsSync(this.store.home.workspaceDir(season.year, target)) ? this.store.home.workspaceDir(season.year, target) : undefined });
  }

  // ---- optional providers (D9) ---------------------------------------------------------------------
  /**
   * Narrow paid operation for agents (MCP generate_image / CLI generate). Enforces enabled + paid use + caps,
   * writes the files into the door's workspace and records the spend in the ledger. Keys never leave this process.
   */
  async generate(providerId: string, op: 'generateImage' | 'generateAudio' | 'synthesizeSpeech' | 'generateVideo', params: GenerateImageParams | Record<string, unknown>, day: number): Promise<{ files: string[]; estimatedUsd: number }> {
    const season = this.requireSeason();
    if (season.kind === 'demo') throw new ApiError(403, 'demo', 'Demo calendars never call paid services.');
    const cfg = this.config();
    const provider = cfg.providers.find((p) => p.id === providerId);
    const ledger = this.store.ledger(season.year).filter((l) => l.type === 'provider' && l.provider === providerId);
    const spentSeason = ledger.reduce((s, l) => s + (l.usd ?? 0), 0);
    const spentGift = ledger.filter((l) => l.day === day).reduce((s, l) => s + (l.usd ?? 0), 0);
    const estimate = op === 'generateImage' ? 0.04 * Math.max(1, Number((params as GenerateImageParams).n ?? 1)) : 0.1;
    let files;
    try {
      files = await runProvider(provider, op, params, { spentSeason, spentGift }, estimate);
    } catch (e) {
      if (e instanceof ProviderRefused) throw new ApiError(403, e.code, e.message);
      throw new ApiError(502, 'provider_error', (e as Error).message);
    }
    const dir = join(this.store.home.workspaceDir(season.year, day), 'generated');
    mkdirSync(dir, { recursive: true });
    const out: string[] = [];
    let usd = 0;
    files.forEach((f, i) => {
      const ext = f.mime.includes('png') ? 'png' : f.mime.includes('jpeg') ? 'jpg' : f.mime.includes('webp') ? 'webp' : f.mime.includes('wav') ? 'wav' : f.mime.includes('mpeg') ? 'mp3' : f.mime.includes('mp4') ? 'mp4' : 'bin';
      const file = join(dir, `${op}-${Date.now()}-${i + 1}.${ext}`);
      writeFileSync(file, Buffer.from(f.base64, 'base64'));
      out.push(file);
      usd += f.estimatedUsd ?? 0;
    });
    this.store.appendLedger(season.year, { at: new Date().toISOString(), day, type: 'provider', provider: providerId, usd, note: op });
    return { files: out, estimatedUsd: usd };
  }

  // ---- demo -----------------------------------------------------------------------------------------
  setDemoDay(day: number): void {
    const season = this.requireSeason();
    if (season.kind === 'live') throw new ApiError(403, 'not_demo', 'The day slider exists only in demo and lab calendars.');
    writeJsonAtomic(this.store.home.demoFile, { simulatedDay: Math.max(0, Math.min(24, Math.floor(day))) });
    const elig = computeEligibility(this.clock(season).now(), season);
    this.events.emitSse({ type: 'rollover', eligibleThrough: elig.eligibleThrough, todayDay: elig.todayDay });
  }

  /** Directly seal a prepared folder into a door (fixtures, lab). Skips eligibility; demo/lab only. */
  async installFixture(day: number, folder: string, reveal = false): Promise<void> {
    const season = this.requireSeason();
    if (season.kind === 'live') throw new ApiError(403, 'not_demo', 'Fixtures can only be installed into demo or lab calendars.');
    const doors = this.doorsOf(season);
    let state = doors.read(day);
    if (state.jobState !== 'not_requested') { state = { ...state, jobState: 'not_requested', revealed: false, revealedAt: undefined, gift: undefined, attempts: [], attempt: 0, failure: undefined, updatedAt: new Date().toISOString() }; }
    state = openDoor(state, { mode: 'submit', adapter: 'fixture' }).state;
    state = transition(state, 'validating');
    const result = await runGate({ type: 'folder', path: folder }, { day, apiToken: this.store.apiToken(), render: false });
    if (!result.ok) throw new Error(`Fixture for door ${day} failed the gate: ${summarise(result.problems)}`);
    const sealed = sealGift(result, this.store.home.giftDir(season.year, day), { attempt: state.attempt, mode: 'submit', adapter: 'fixture' });
    state = sealDoor(state, sealed);
    if (reveal) state = revealDoor(state);
    doors.write(state);
  }

  readSealed(year: number, day: number) { return readSealedGift(this.store.home.giftDir(year, day)); }
}

function hasAnyFile(dir: string): boolean {
  try { return existsSync(dir) && readdirSync(dir).length > 0; } catch { return false; }
}

export function historyRecordFor(day: number, gift: NonNullable<DoorState['gift']>, revealedAt: string): HistoryRecord {
  const m = gift.manifest;
  const interaction = typeof m.interaction === 'string' ? [m.interaction] : m.interaction;
  return {
    day, title: m.title, kind: gift.kind, category: m.category, ideaId: m.ideaId ?? undefined, family: m.family, emotion: m.emotion, interaction,
    collection: m.collection ? { set: m.collection.set, index: m.collection.index, size: m.collection.size } : undefined,
    motifs: m.continuity?.motifs ?? [], thread: m.continuity?.thread, followUp: m.followUp, detailsUsed: m.detailsUsed, revealedAt,
  };
}

export function summarise(problems: Array<{ severity: string; message: string }>): string {
  const errors = problems.filter((p) => p.severity === 'error').map((p) => p.message);
  return (errors.length ? errors : problems.map((p) => p.message)).slice(0, 3).join(' · ');
}
