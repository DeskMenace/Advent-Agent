import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { testCompanion, waitFor, type TestCompanion } from '../helpers/companion.js';
import type { PublicDoor, CalendarResponse } from '../../src/shared/index.js';

let t: TestCompanion;
afterEach(async () => { await t?.close(); });

const door = (day: number) => async () => (await t.api<PublicDoor>('GET', `/api/doors/${day}`)).data;
const settled = (d: PublicDoor) => d.jobState === 'ready' || d.jobState === 'failed';

describe('launched mode with the fake agent', () => {
  it('I1.1 happy path: phases are reported, the gift is sealed, the door is ready and unrevealed', async () => {
    t = await testCompanion({ scenario: 'happy' });
    const phases = new Set<string>();
    t.companion.service.events.onSse((e) => { if (e.type === 'door' && e.door.phase) phases.add(e.door.phase); });
    const opened = await t.api<PublicDoor>('POST', '/api/doors/8/open');
    expect(opened.status).toBe(200);
    expect(['queued', 'preparing']).toContain(opened.data.jobState);
    const final = await waitFor(door(8), settled);
    expect(final.jobState).toBe('ready');
    expect(final.envelope).toBe('ready_unopened');
    expect(final.revealed).toBe(false);
    expect([...phases]).toEqual(expect.arrayContaining(['thinking', 'making', 'testing', 'wrapping']));
    // Usage landed in the ledger and attempt (recorded when the process exits, just after sealing).
    const state = await waitFor(() => t.companion.service.store.doors(2026).read(8), (s) => Boolean(s.attempts[0]?.usage));
    expect(state.attempts[0]?.usage?.tokens).toBe(2000);
    expect(state.attempts[0]?.usage?.usd).toBeCloseTo(0.0123);
    expect(t.companion.service.store.ledger(2026).some((l) => l.type === 'usage')).toBe(true);
    // Workspace removed after sealing, log kept privately.
    expect(existsSync(t.companion.service.store.home.workspaceDir(2026, 8))).toBe(false);
    expect(existsSync(t.companion.service.store.home.logFile(2026, 8))).toBe(true);
  });

  it('auto-submit: the runner seals ./gift when the agent exits without submitting', async () => {
    t = await testCompanion({ scenario: 'auto-submit' });
    await t.api('POST', '/api/doors/5/open');
    const final = await waitFor(door(5), settled);
    expect(final.jobState).toBe('ready');
    expect(t.companion.service.store.doors(2026).read(5).gift?.kind).toBe('card');
  });

  it('progress via the ./.progress file works for agents that cannot run commands', async () => {
    t = await testCompanion({ scenario: 'progress-file' });
    const phases: string[] = [];
    t.companion.service.events.onSse((e) => { if (e.type === 'door' && e.door.phase && !phases.includes(e.door.phase)) phases.push(e.door.phase); });
    await t.api('POST', '/api/doors/3/open');
    const final = await waitFor(door(3), settled, 30_000);
    expect(final.jobState).toBe('ready');
    expect(phases).toEqual(expect.arrayContaining(['thinking', 'making']));
  });

  it('I1.2 failure exit → failed with retry; retry archives the workspace and succeeds', async () => {
    t = await testCompanion({ scenario: 'fail' });
    await t.api('POST', '/api/doors/2/open');
    const failed = await waitFor(door(2), settled);
    expect(failed.jobState).toBe('failed');
    expect(failed.envelope).toBe('failed');
    expect(failed.failure?.canRetry).toBe(true);
    expect(failed.failure?.userMessage).not.toMatch(/sk-|token/i);
    process.env.FAKE_AGENT_SCENARIO = 'happy';
    const retried = await t.api<PublicDoor>('POST', '/api/doors/2/retry');
    expect(retried.data.attempt).toBe(2);
    const final = await waitFor(door(2), settled);
    expect(final.jobState).toBe('ready');
    expect(final.attempt).toBe(2);
  });

  it('I1.3 timeout → failed with a timeout message and the process is gone', async () => {
    t = await testCompanion({ scenario: 'timeout' });
    t.companion.service.store.saveConfig({ timeoutMinutes: 1 });
    // Shorten the timeout for the test by configuring the smallest allowed value and faking via env.
    const svc = t.companion.service as unknown as { config: () => { timeoutMinutes: number } };
    const original = svc.config.bind(svc);
    (t.companion.service as unknown as { config: () => unknown }).config = () => ({ ...original(), timeoutMinutes: 0.05 });
    await t.api('POST', '/api/doors/4/open');
    const final = await waitFor(door(4), settled, 30_000);
    expect(final.jobState).toBe('failed');
    expect(final.failure?.userMessage).toMatch(/ran out of time/);
  });

  it('I1.4 a secret in the gift is rejected by the gate; the agent gets structured errors; door not ready', async () => {
    t = await testCompanion({ scenario: 'secret' });
    await t.api('POST', '/api/doors/6/open');
    const final = await waitFor(door(6), settled, 30_000);
    expect(final.jobState).toBe('failed');
    expect(final.failure?.userMessage).toMatch(/quality check/);
    // The second round's BRIEF listed the problem for the agent.
    const archived = `${t.companion.service.store.home.workspaceDir(2026, 6)}`;
    const briefs = [archived, `${archived}.attempt-1`].filter((p) => existsSync(`${p}/BRIEF.md`)).map((p) => readFileSync(`${p}/BRIEF.md`, 'utf8'));
    expect(briefs.some((b) => /secret_anthropic_key/.test(b))).toBe(true);
    expect(t.companion.service.store.doors(2026).read(6).attempts[0]?.gateReports).toBe(1);
  });

  it('I1.5 a broken gift is rejected, and a fix on the second round seals it', async () => {
    t = await testCompanion({ scenario: 'fix-on-retry' });
    await t.api('POST', '/api/doors/7/open');
    const final = await waitFor(door(7), settled, 30_000);
    expect(final.jobState).toBe('ready');
    expect(t.companion.service.store.doors(2026).read(7).attempts[0]?.gateReports).toBe(1);
    process.env.FAKE_AGENT_SCENARIO = 'broken';
    await t.api('POST', '/api/doors/1/open');
    const broken = await waitFor(door(1), settled, 30_000);
    expect(broken.jobState).toBe('failed');
    expect(broken.failure?.userMessage).toMatch(/missing/);
  });

  it('I1.6 the private log and the gift title never reach the calendar API or SSE', async () => {
    t = await testCompanion({ scenario: 'happy' });
    const seen: string[] = [];
    t.companion.service.events.onSse((e) => seen.push(JSON.stringify(e)));
    await t.api('POST', '/api/doors/8/open');
    await waitFor(door(8), settled);
    const cal = await t.api<CalendarResponse>('GET', '/api/calendar');
    const blob = JSON.stringify(cal.data) + seen.join('\n') + JSON.stringify((await t.api('GET', '/api/doors/8')).data);
    expect(blob).not.toMatch(/fake-agent\]/);
    expect(blob).not.toMatch(/A little card for door/);
    expect(blob).not.toMatch(/card\.svg/);
    expect(blob).not.toContain(t.token);
    // Reveal is a separate, explicit step.
    const gift = await t.api<{ gift: { manifest: { title: string } } }>('POST', '/api/doors/8/reveal');
    expect(gift.data.gift.manifest.title).toBe('A little card for door 8');
    expect((await t.api<PublicDoor>('GET', '/api/doors/8')).data.envelope).toBe('opened');
  });

  it('idempotent open: rapid double open creates one job', async () => {
    t = await testCompanion({ scenario: 'happy' });
    const [a, b, c] = await Promise.all([t.api<PublicDoor>('POST', '/api/doors/8/open'), t.api<PublicDoor>('POST', '/api/doors/8/open'), t.api<PublicDoor>('POST', '/api/doors/8/open')]);
    expect([a.data.attempt, b.data.attempt, c.data.attempt]).toEqual([1, 1, 1]);
    await waitFor(door(8), settled);
    expect(t.companion.service.store.doors(2026).read(8).attempts).toHaveLength(1);
  });

  it('U1.7 future doors are locked for open, get and submit; cancel works while preparing', async () => {
    t = await testCompanion({ scenario: 'timeout' });
    expect((await t.api('POST', '/api/doors/9/open')).status).toBe(423);
    expect((await t.api('GET', '/api/doors/9')).status).toBe(423);
    expect((await t.api('POST', '/api/agent/submit?day=9', { text: '# Hi\nhello' })).status).toBe(423);
    await t.api('POST', '/api/doors/8/open');
    await waitFor(door(8), (d) => d.jobState === 'preparing');
    const cancelled = await t.api<PublicDoor>('POST', '/api/doors/8/cancel');
    expect(cancelled.data.jobState).toBe('cancelled');
    expect(cancelled.data.envelope).toBe('today');
  });
});
