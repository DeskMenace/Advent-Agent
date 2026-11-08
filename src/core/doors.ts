/**
 * Door state machine (ARCHITECTURE §5). Pure transition logic + a small persistence wrapper.
 */
import { existsSync, renameSync, rmSync } from 'node:fs';
import { DoorStateSchema, type Attempt, type ConnectionMode, type DoorState, type JobState, type EnvelopeState, type PublicDoor, type SealedGift } from '../shared/door.js';
import type { ProgressPhase } from '../shared/gift.js';
import { ensureDir, readJson, writeJsonAtomic } from './fsutil.js';
import type { Home } from './paths.js';

export class DoorTransitionError extends Error {
  constructor(public readonly from: JobState, public readonly to: JobState, message?: string) {
    super(message ?? `Door cannot go from ${from} to ${to}`);
    this.name = 'DoorTransitionError';
  }
}

const WAITING: JobState[] = ['waiting_for_agent', 'waiting_for_drop', 'waiting_for_permission'];

/** Allowed transitions. `start` (open) and `retry` are handled by `openDoor`/`retryDoor`. */
export const TRANSITIONS: Record<JobState, JobState[]> = {
  not_requested: ['queued'],
  queued: ['preparing', ...WAITING, 'validating', 'failed', 'cancelled'],
  preparing: [...WAITING, 'validating', 'failed', 'cancelled'],
  waiting_for_agent: ['preparing', 'validating', 'failed', 'cancelled'],
  waiting_for_drop: ['validating', 'failed', 'cancelled'],
  waiting_for_permission: ['preparing', 'validating', 'ready', 'failed', 'cancelled'],
  validating: ['ready', 'preparing', 'waiting_for_drop', 'waiting_for_agent', 'failed', 'cancelled'],
  ready: [],
  failed: [],
  cancelled: [],
};

export const IN_FLIGHT: ReadonlySet<JobState> = new Set<JobState>(['queued', 'preparing', ...WAITING, 'validating']);

export function newDoorState(day: number, now = new Date()): DoorState {
  return DoorStateSchema.parse({ day, updatedAt: now.toISOString() });
}

function cloneWith(state: DoorState, patch: Partial<DoorState>, now: Date): DoorState {
  return { ...state, ...patch, updatedAt: now.toISOString() };
}

export function canTransition(from: JobState, to: JobState): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function transition(state: DoorState, to: JobState, now = new Date(), extra: Partial<DoorState> = {}): DoorState {
  if (!canTransition(state.jobState, to)) throw new DoorTransitionError(state.jobState, to);
  const patch: Partial<DoorState> = { jobState: to, ...extra };
  const attempts = state.attempts.slice();
  const current = attempts[attempts.length - 1];
  if (current && current.outcome === 'running' && (to === 'ready' || to === 'failed' || to === 'cancelled')) {
    attempts[attempts.length - 1] = { ...current, outcome: to, endedAt: now.toISOString(), error: to === 'failed' ? extra.failure?.userMessage : undefined };
    patch.attempts = attempts;
  }
  if (to !== 'failed') patch.failure = undefined;
  if (to === 'ready' || to === 'failed' || to === 'cancelled') patch.phase = undefined;
  if (to !== 'waiting_for_permission') patch.permission = undefined;
  return cloneWith(state, patch, now);
}

export interface OpenOptions {
  mode: ConnectionMode;
  adapter?: string;
  now?: Date;
  /** Scheduled run that is happening late. */
  late?: { scheduledFor: string; reason: string };
}

/** Idempotent: returns the existing state unchanged when a job already exists or the door is ready. */
export function openDoor(state: DoorState, opts: OpenOptions): { state: DoorState; created: boolean } {
  if (state.jobState !== 'not_requested') return { state, created: false };
  const now = opts.now ?? new Date();
  const attempt: Attempt = { n: state.attempt + 1, mode: opts.mode, adapter: opts.adapter, startedAt: now.toISOString(), outcome: 'running', gateReports: 0, late: opts.late };
  const next = cloneWith(state, { jobState: 'queued', attempt: attempt.n, attempts: [...state.attempts, attempt], failure: undefined }, now);
  return { state: next, created: true };
}

/** Retry after failure or cancellation: a new attempt, never a merge. The caller archives the workspace. */
export function retryDoor(state: DoorState, opts: OpenOptions): DoorState {
  if (state.jobState !== 'failed' && state.jobState !== 'cancelled') {
    throw new DoorTransitionError(state.jobState, 'queued', `Door ${state.day} can only be retried after a failure or cancellation`);
  }
  const now = opts.now ?? new Date();
  const attempt: Attempt = { n: state.attempt + 1, mode: opts.mode, adapter: opts.adapter, startedAt: now.toISOString(), outcome: 'running', gateReports: 0, late: opts.late };
  return cloneWith(state, { jobState: 'queued', attempt: attempt.n, attempts: [...state.attempts, attempt], failure: undefined, phase: undefined, permission: undefined }, now);
}

export function cancelDoor(state: DoorState, now = new Date()): DoorState {
  if (!IN_FLIGHT.has(state.jobState)) throw new DoorTransitionError(state.jobState, 'cancelled', `Door ${state.day} has nothing to cancel`);
  return transition(state, 'cancelled', now);
}

export function setPhase(state: DoorState, phase: ProgressPhase, now = new Date()): DoorState {
  if (!IN_FLIGHT.has(state.jobState)) throw new DoorTransitionError(state.jobState, state.jobState, `Door ${state.day} is not being prepared`);
  const next = state.jobState === 'waiting_for_agent' || state.jobState === 'queued' ? transition(state, 'preparing', now) : state;
  return cloneWith(next, { phase }, now);
}

export function failDoor(state: DoorState, code: string, userMessage: string, canRetry = true, now = new Date()): DoorState {
  return transition(state, 'failed', now, { failure: { code, userMessage, canRetry } });
}

export function sealDoor(state: DoorState, gift: SealedGift, now = new Date()): DoorState {
  return transition(state, 'ready', now, { gift });
}

export function revealDoor(state: DoorState, now = new Date()): DoorState {
  if (state.jobState !== 'ready' || !state.gift) throw new DoorTransitionError(state.jobState, 'ready', `Door ${state.day} is not ready to be revealed`);
  if (state.revealed) return state;
  return cloneWith(state, { revealed: true, revealedAt: now.toISOString() }, now);
}

/**
 * Recovery after a crash: anything that was in flight inside the companion process (queued, preparing, validating)
 * is marked failed-with-retry; waiting_* states are kept because they depend on the user or an external agent.
 */
export function recoverDoor(state: DoorState, now = new Date()): DoorState {
  if (state.jobState === 'queued' || state.jobState === 'preparing' || state.jobState === 'validating') {
    return failDoor(state, 'interrupted', 'The preparation was interrupted (the calendar was closed). You can try again.', true, now);
  }
  return state;
}

export function envelopeState(state: DoorState, eligible: boolean, isToday: boolean): EnvelopeState {
  if (!eligible) return 'locked';
  if (state.revealed) return 'opened';
  switch (state.jobState) {
    case 'ready':
      return 'ready_unopened';
    case 'failed':
      return 'failed';
    case 'queued':
    case 'preparing':
    case 'validating':
      return 'generating';
    case 'waiting_for_agent':
    case 'waiting_for_drop':
    case 'waiting_for_permission':
      return 'waiting';
    case 'cancelled':
    case 'not_requested':
    default:
      return isToday ? 'today' : 'available';
  }
}

/** Spoiler-free projection. The only place door state leaves the server for an unrevealed door. */
export function toPublicDoor(state: DoorState, eligible: boolean, isToday: boolean): PublicDoor {
  const current = state.attempts[state.attempts.length - 1];
  const late = current?.late && current.outcome === 'ready' && current.endedAt ? { ...current.late, preparedAt: current.endedAt } : undefined;
  return {
    day: state.day,
    eligible,
    isToday,
    envelope: envelopeState(state, eligible, isToday),
    jobState: eligible ? state.jobState : 'not_requested',
    attempt: state.attempt,
    phase: eligible ? state.phase : undefined,
    revealed: state.revealed,
    revealedAt: state.revealedAt,
    late,
    failure: eligible && state.failure ? { userMessage: state.failure.userMessage, canRetry: state.failure.canRetry } : undefined,
    permission: eligible ? state.permission : undefined,
    hasFeedback: Boolean(state.feedback),
    bought: Boolean(state.bought),
    wrapping: !eligible && IN_FLIGHT.has(state.jobState),
  };
}

/** Persistence for the 24 doors of one season. */
export class DoorStore {
  constructor(private readonly home: Home, private readonly year: number) {}

  read(day: number): DoorState {
    const file = this.home.doorStateFile(this.year, day);
    return readJson(file, DoorStateSchema) ?? newDoorState(day);
  }

  write(state: DoorState): void {
    writeJsonAtomic(this.home.doorStateFile(this.year, state.day), state);
  }

  readAll(): DoorState[] {
    return Array.from({ length: 24 }, (_, i) => this.read(i + 1));
  }

  /** Move the current workspace aside before a new attempt. Never merges. */
  archiveWorkspace(day: number, attempt: number): void {
    const ws = this.home.workspaceDir(this.year, day);
    if (!existsSync(ws)) return;
    const archived = `${ws}.attempt-${attempt}`;
    if (existsSync(archived)) rmSync(archived, { recursive: true, force: true });
    renameSync(ws, archived);
  }

  freshWorkspace(day: number): string {
    const ws = this.home.workspaceDir(this.year, day);
    ensureDir(ws);
    return ws;
  }
}
