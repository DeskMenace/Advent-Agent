import { describe, expect, it } from 'vitest';
import { JOB_STATES, type JobState, type SealedGift } from '../../src/shared/door.js';
import { GiftManifestSchema } from '../../src/shared/gift.js';
import { cancelDoor, DoorTransitionError, envelopeState, failDoor, IN_FLIGHT, newDoorState, openDoor, recoverDoor, retryDoor, revealDoor, sealDoor, setPhase, toPublicDoor, TRANSITIONS, transition } from '../../src/core/doors.js';

const gift: SealedGift = {
  manifest: GiftManifestSchema.parse({ schema: 'advent-agent/gift@1', day: 3, title: 'Secret title', note: 'secret note' }),
  kind: 'document',
  files: [],
  sealedAt: '2026-12-03T00:00:00Z',
  attempt: 1,
  mode: 'launched',
  verification: { render: 'skipped', renderNotes: [], media: 'skipped', secretScan: 'clean', warnings: [] },
  networkConsent: [],
};

function inState(state: JobState) {
  let s = newDoorState(3);
  if (state === 'not_requested') return s;
  s = openDoor(s, { mode: 'launched' }).state; // queued
  if (state === 'queued') return s;
  if (state === 'ready') return sealDoor(transition(s, 'validating'), gift);
  if (state === 'failed') return failDoor(s, 'x', 'boom');
  if (state === 'cancelled') return cancelDoor(s);
  return transition(s, state);
}

describe('door state machine', () => {
  it('U2.1 every allowed transition succeeds and every other one throws', () => {
    for (const from of JOB_STATES) {
      for (const to of JOB_STATES) {
        const s = inState(from);
        if (TRANSITIONS[from].includes(to)) {
          expect(transition(s, to).jobState).toBe(to);
        } else {
          expect(() => transition(s, to)).toThrow(DoorTransitionError);
        }
      }
    }
  });
  it('terminal states have no outgoing transitions except through retry', () => {
    expect(TRANSITIONS.ready).toEqual([]);
    expect(TRANSITIONS.failed).toEqual([]);
    expect(TRANSITIONS.cancelled).toEqual([]);
  });
  it('U2.2 open is idempotent', () => {
    const first = openDoor(newDoorState(3), { mode: 'launched', adapter: 'claude-code' });
    expect(first.created).toBe(true);
    expect(first.state.attempt).toBe(1);
    const second = openDoor(first.state, { mode: 'launched' });
    expect(second.created).toBe(false);
    expect(second.state).toBe(first.state);
    const ready = inState('ready');
    expect(openDoor(ready, { mode: 'launched' }).created).toBe(false);
  });
  it('U2.3 retry creates a new attempt without duplicating or merging', () => {
    const failed = inState('failed');
    expect(failed.attempts[0]?.outcome).toBe('failed');
    const retried = retryDoor(failed, { mode: 'launched' });
    expect(retried.attempt).toBe(2);
    expect(retried.attempts).toHaveLength(2);
    expect(retried.attempts[1]?.n).toBe(2);
    expect(retried.jobState).toBe('queued');
    expect(retried.failure).toBeUndefined();
    expect(() => retryDoor(inState('preparing'), { mode: 'launched' })).toThrow(DoorTransitionError);
    expect(() => retryDoor(inState('ready'), { mode: 'launched' })).toThrow(DoorTransitionError);
  });
  it('U2.4 cancel works from every in-flight state and nowhere else', () => {
    for (const st of JOB_STATES) {
      if (IN_FLIGHT.has(st)) expect(cancelDoor(inState(st)).jobState).toBe('cancelled');
      else expect(() => cancelDoor(inState(st))).toThrow(DoorTransitionError);
    }
    const c = cancelDoor(inState('preparing'));
    expect(c.attempts[0]?.outcome).toBe('cancelled');
    expect(c.attempts[0]?.endedAt).toBeDefined();
  });
  it('U2.5 crash recovery: in-process states fail with retry, waiting states and terminal states are kept', () => {
    for (const st of ['queued', 'preparing', 'validating'] as const) {
      const r = recoverDoor(inState(st));
      expect(r.jobState).toBe('failed');
      expect(r.failure?.canRetry).toBe(true);
      expect(retryDoor(r, { mode: 'launched' }).jobState).toBe('queued');
    }
    for (const st of ['waiting_for_agent', 'waiting_for_drop', 'waiting_for_permission', 'ready', 'failed', 'cancelled', 'not_requested'] as const) {
      expect(recoverDoor(inState(st)).jobState).toBe(st);
    }
  });
  it('phases only while in flight; a phase on waiting_for_agent moves to preparing', () => {
    const w = setPhase(inState('waiting_for_agent'), 'thinking');
    expect(w.jobState).toBe('preparing');
    expect(w.phase).toBe('thinking');
    expect(() => setPhase(inState('ready'), 'making')).toThrow();
    expect(sealDoor(transition(setPhase(inState('preparing'), 'wrapping'), 'validating'), gift).phase).toBeUndefined();
  });
  it('reveal only when ready; idempotent', () => {
    expect(() => revealDoor(inState('preparing'))).toThrow();
    const r = revealDoor(inState('ready'));
    expect(r.revealed).toBe(true);
    expect(revealDoor(r)).toBe(r);
  });
  it('envelope states derive from eligibility, job state and reveal', () => {
    expect(envelopeState(inState('not_requested'), false, false)).toBe('locked');
    expect(envelopeState(inState('not_requested'), true, true)).toBe('today');
    expect(envelopeState(inState('not_requested'), true, false)).toBe('available');
    expect(envelopeState(inState('preparing'), true, false)).toBe('generating');
    expect(envelopeState(inState('waiting_for_drop'), true, false)).toBe('waiting');
    expect(envelopeState(inState('ready'), true, false)).toBe('ready_unopened');
    expect(envelopeState(revealDoor(inState('ready')), true, false)).toBe('opened');
    expect(envelopeState(inState('failed'), true, false)).toBe('failed');
    expect(envelopeState(inState('cancelled'), true, true)).toBe('today');
  });
  it('the public projection never carries gift data and hides job detail for locked doors', () => {
    const ready = inState('ready');
    const pub = toPublicDoor(ready, true, false);
    expect(JSON.stringify(pub)).not.toContain('Secret title');
    expect(JSON.stringify(pub)).not.toContain('secret note');
    expect((pub as unknown as Record<string, unknown>).gift).toBeUndefined();
    const locked = toPublicDoor(inState('preparing'), false, false);
    expect(locked.envelope).toBe('locked');
    expect(locked.jobState).toBe('not_requested');
    expect(locked.phase).toBeUndefined();
  });
});
