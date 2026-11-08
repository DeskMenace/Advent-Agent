import { afterEach, describe, expect, it } from 'vitest';
import { Scheduler } from '../../src/jobs/scheduler.js';
import { testCompanion, waitFor, type TestCompanion } from '../helpers/companion.js';
import type { PublicDoor } from '../../src/shared/index.js';

let t: TestCompanion;
afterEach(async () => { await t?.close(); });

const setNow = (iso: string) => { process.env.ADVENT_AGENT_FAKE_NOW = iso; };
const door = (day: number) => async () => (await t.api<PublicDoor>('GET', `/api/doors/${day}`)).data;

describe('scheduler', () => {
  it('I4.1 prepares at the configured time (03:00 the day before), not earlier; I4.3 never twice', async () => {
    t = await testCompanion({ now: '2026-12-04T01:00:00Z', scenario: 'auto-submit', config: { deliveryMode: 'scheduled', scheduleTime: '03:00', prepareDayBefore: true } });
    const s = new Scheduler(t.companion.service, { intervalMs: 3_600_000 });
    // 02:00 Zurich on Dec 4: door 5 (due 03:00 Dec 4) not yet; doors 1–4 are due (and would be caught up on startup).
    s.tick('startup');
    let states = t.companion.service.store.doors(2026).readAll();
    expect(states[4]!.jobState).toBe('not_requested'); // door 5
    expect(states[3]!.jobState).not.toBe('not_requested'); // door 4 was due at 03:00 Dec 3 → catch-up
    setNow('2026-12-04T02:05:00Z'); // 03:05 Zurich → door 5 due 5 min ago (within the late threshold)
    s.tick('interval');
    s.tick('interval');
    states = t.companion.service.store.doors(2026).readAll();
    expect(states[4]!.jobState).not.toBe('not_requested');
    expect(states[4]!.attempts).toHaveLength(1);
    expect(states[4]!.attempts[0]?.late).toBeUndefined();
    expect(states[5]!.jobState).toBe('not_requested'); // door 6 due tomorrow
    await waitFor(async () => t.companion.service.store.doors(2026).read(5).jobState, (s2) => s2 === 'ready' || s2 === 'failed', 30_000);
    // The prepared gift stays sealed and invisible: door 5 is not eligible until midnight.
    const pub = (await t.api<{ doors: PublicDoor[] }>('GET', '/api/calendar')).data.doors[4]!;
    expect(pub.envelope).toBe('locked');
    expect(pub.jobState).toBe('not_requested');
  });

  it('I4.2 + I4.4 catch-up after a simulated sleep is honest about being late', async () => {
    t = await testCompanion({ now: '2026-12-06T01:00:00Z', scenario: 'auto-submit', config: { deliveryMode: 'scheduled', scheduleTime: '03:00', prepareDayBefore: true } });
    const s = new Scheduler(t.companion.service, { intervalMs: 1000, sleepThresholdMs: 2000 });
    s.tick('startup'); // catches up doors 1–6 (late, "the calendar was not running")
    const six = t.companion.service.store.doors(2026).read(6);
    expect(six.attempts[0]?.late?.reason).toBe('the calendar was not running');
    // Now the machine "sleeps" over the 03:00 preparation of door 7.
    setNow('2026-12-06T07:12:00Z'); // 08:12 Zurich, door 7 was due 03:00
    await new Promise((r) => setTimeout(r, 2200));
    s.tick('interval');
    const seven = t.companion.service.store.doors(2026).read(7);
    expect(seven.jobState).not.toBe('not_requested');
    expect(seven.attempts[0]?.late?.reason).toBe('your computer was asleep');
    expect(seven.attempts[0]?.late?.scheduledFor).toBe('2026-12-06T02:00:00.000Z');
    await waitFor(async () => t.companion.service.store.doors(2026).read(7).jobState, (st) => st === 'ready' || st === 'failed', 30_000);
    // Once eligible and ready, the public door says when it was prepared and why late.
    setNow('2026-12-07T08:00:00Z');
    const pub = await door(7)();
    expect(pub.envelope).toBe('ready_unopened');
    expect(pub.late?.reason).toBe('your computer was asleep');
    expect(pub.late?.preparedAt).toBeDefined();
  });

  it('emits a rollover event when the unlock boundary passes; on-demand seasons never auto-prepare', async () => {
    t = await testCompanion({ now: '2026-12-08T22:59:00Z', scenario: 'happy' });
    const events: string[] = [];
    t.companion.service.events.onSse((e) => events.push(e.type));
    const s = new Scheduler(t.companion.service, { intervalMs: 3_600_000 });
    s.tick('startup');
    setNow('2026-12-08T23:01:00Z'); // 00:01 Dec 9 Zurich
    s.tick('interval');
    expect(events).toContain('rollover');
    expect(t.companion.service.store.doors(2026).readAll().every((d) => d.jobState === 'not_requested')).toBe(true);
  });
});
