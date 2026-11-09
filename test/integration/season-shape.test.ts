/** D15–D18: Day 1 at setup, tiers, finale from Dec 20, catch-up, rotation history in the brief. */
import { afterEach, describe, expect, it } from 'vitest';
import { testCompanion, waitFor, type TestCompanion } from '../helpers/companion.js';
import { Scheduler } from '../../src/jobs/scheduler.js';
import { tierFor } from '../../src/core/tiers.js';
import type { AgentContext, CalendarResponse } from '../../src/shared/api.js';

let t: TestCompanion;
afterEach(async () => { await t?.close(); });
const setNow = (iso: string) => { process.env.ADVENT_AGENT_FAKE_NOW = iso; };

describe('budget tiers (D16)', () => {
  it('maps generosity to S/M/L, anchors to XL (3×, at least L)', () => {
    expect(tierFor(5, 'light')).toMatchObject({ tier: 'S', tokens: 30_000 });
    expect(tierFor(5, 'standard')).toMatchObject({ tier: 'M', tokens: 100_000 });
    expect(tierFor(5, 'generous')).toMatchObject({ tier: 'L', tokens: 300_000 });
    expect(tierFor(1, 'light')).toMatchObject({ tier: 'XL', tokens: 300_000, capMultiplier: 3 });
    expect(tierFor(24, 'generous')).toMatchObject({ tier: 'XL', tokens: 900_000 });
  });
});

describe('season shape', () => {
  it('Day 1 is prepared during setup in November; the locked door shows only "wrapping", and opens instantly on Dec 1', async () => {
    t = await testCompanion({ now: '2026-11-08T12:00:00Z', scenario: 'auto-submit', config: { setupComplete: false } });
    const done = await t.api('POST', '/api/setup/complete', {} as never);
    expect(done.status).toBe(200);
    expect(t.companion.service.store.doors(2026).read(1).jobState).toBe('not_requested'); // waits for onboarding
    const onboarded = await t.api('POST', '/api/onboarding/complete', { generosity: 'light' } as never);
    expect(onboarded.status).toBe(200);
    const first = (await t.api<CalendarResponse>('GET', '/api/calendar')).data.doors[0]!;
    expect(first.envelope).toBe('locked');
    expect(first.jobState).toBe('not_requested'); // nothing about the job leaks for a locked door…
    expect(first.wrapping).toBe(true); // …except that it is being wrapped
    const ready = await waitFor(() => t.companion.service.store.doors(2026).read(1), (s) => s.jobState === 'ready' || s.jobState === 'failed', 30_000);
    expect(ready.jobState).toBe('ready');
    expect((await t.api('POST', '/api/doors/1/reveal')).status).toBe(423);
    setNow('2026-11-30T23:00:30Z'); // 00:00:30 Dec 1 Zurich
    const opened = await t.api<{ gift: { manifest: { day: number } } }>('POST', '/api/doors/1/reveal');
    expect(opened.status).toBe(200);
    expect(opened.data.gift.manifest.day).toBe(1);
  });

  it('the Day 1 brief restricts the choice to day1 anchors and carries tier XL', async () => {
    t = await testCompanion({ now: '2026-11-08T12:00:00Z', config: { connection: { mode: 'submit', permissive: false } } });
    await t.api('POST', '/api/doors/1/prepare');
    const ctx = (await t.api<AgentContext>('GET', '/api/agent/context?day=1&mode=submit')).data;
    expect(ctx.season).toMatchObject({ year: 2026, anchor: 'day1', isCatchUp: false });
    expect(ctx.budget.tier).toBe('XL');
    expect(ctx.anchorIdeas?.map((i) => i.id).sort()).toEqual(['holo-card-of-you', 'pop-up-hello', 'snow-globe-of-your-year', 'tiny-companion']);
    expect(ctx.modeNotes.join(' ')).toMatch(/Day 1/);
    // Door 2 cannot be prepared or submitted early.
    expect((await t.api('POST', '/api/doors/2/prepare')).status).toBe(423);
    expect((await t.api('POST', '/api/agent/submit?day=2', { text: '# early' })).status).toBe(423);
    // Day 1 can be submitted early (a script that submits), but never revealed before Dec 1.
    expect((await t.api<{ ok: boolean }>('POST', '/api/agent/submit?day=1', { text: '# Hello\n\nI am your Secret Santa.' })).data.ok).toBe(true);
    expect((await t.api('POST', '/api/doors/1/reveal')).status).toBe(423);
    setNow('2026-11-30T23:01:00Z');
    expect((await t.api('POST', '/api/doors/1/reveal')).status).toBe(200);
  });

  it('D17: in launched mode the finale starts from December 20, the door still unlocks on the 24th', async () => {
    t = await testCompanion({ now: '2026-12-19T12:00:00Z', scenario: 'auto-submit' });
    const s = new Scheduler(t.companion.service, { intervalMs: 3_600_000 });
    s.tick('startup');
    expect(t.companion.service.store.doors(2026).read(24).jobState).toBe('not_requested');
    setNow('2026-12-19T23:05:00Z'); // 00:05 Dec 20 Zurich
    s.tick('interval');
    await waitFor(() => t.companion.service.store.doors(2026).read(24).jobState, (st) => st === 'ready', 30_000);
    const pub = (await t.api<CalendarResponse>('GET', '/api/calendar')).data.doors[23]!;
    expect(pub.envelope).toBe('locked');
    expect((await t.api('POST', '/api/doors/24/reveal')).status).toBe(423);
  });

  it('D18 catch-up: a missed door is flagged in the brief; history lists earlier gifts with family, emotion and interaction', async () => {
    t = await testCompanion({ now: '2026-12-08T12:00:00Z', config: { connection: { mode: 'submit', permissive: false } } });
    const manifest = { schema: 'advent-agent/gift@2', day: 2, title: 'Jelly persimmon', note: 'Wobble.', entry: 'index.html', emotion: 'cute', interaction: ['squeeze'], family: 'tactile-toys', ideaId: 'jelly-fruit', collection: { set: 'jelly-fruits', index: 1, size: 3 }, share: { still: { capture: 'still' } } };
    const r = await t.api<{ ok: boolean; problems: unknown[] }>('POST', '/api/agent/submit?day=2&mode=submit', { files: [{ name: 'gift.json', text: JSON.stringify(manifest) }, { name: 'index.html', text: '<!doctype html><html><body><script>window.adventCapture={async prepare(){}}</script></body></html>' }] });
    expect(r.data.ok, JSON.stringify(r.data.problems)).toBe(true);
    await t.api('POST', '/api/doors/3/open');
    const ctx = (await t.api<AgentContext>('GET', '/api/agent/context?day=3&mode=submit')).data;
    expect(ctx.season.isCatchUp).toBe(true);
    expect(ctx.modeNotes.join(' ')).toMatch(/caught up/);
    expect(ctx.history).toEqual([expect.objectContaining({ day: 2, family: 'tactile-toys', emotion: 'cute', interaction: ['squeeze'], ideaId: 'jelly-fruit', opened: false })]);
    expect(ctx.collections).toEqual([{ set: 'jelly-fruits', size: 3, days: [2], complete: false }]);
    const today = (await t.api<AgentContext>('GET', '/api/agent/context?day=8&mode=submit')).data;
    expect(today.season.isCatchUp).toBe(false);
    expect(today.budget.tier).toBe('M');
  });
});
