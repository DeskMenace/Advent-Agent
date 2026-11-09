/**
 * lab report [--serve [--port 4950]]
 * Writes lab/out/report.html from the plan, make and simulate outputs. With --serve it also serves lab/out and saves
 * the scoring form to lab/out/scores.json (opened as a file, the form offers scores.json as a download instead).
 */
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { LAB_HOMES, OUT, REPO, parseFlags, readJsonSafe } from './common.js';
import { ledgerUsage } from './make-gift.js';

type PlanDay = { day: number; tokens?: number; usd?: number; durationMs?: number; model?: string; plan: null | { ideaId?: string | null; family?: string; title?: string; pitch?: string; emotion?: string; interaction?: string[] | string; form?: string; render?: string; tier?: string; personalDetails?: string[]; shareFrame?: string; followUp?: unknown; collection?: { set: string; index: number; size?: number } | null } };
type Season = { label: string; meta: { harness: string; model: string; adapter: string }; days: PlanDay[] };
type Check = { name: string; ok: boolean | null; detail: string };
type Made = { label: string; idea: string | null; free: boolean; day: number; harness: string; adapter: string; model: string; modelUsed?: string; jobState: string; failure?: { code: string; userMessage: string }; title?: string; note?: string | null; signature?: string | null; ideaUsed?: string | null; family?: string; emotion?: string; form?: string; kind?: string; entry?: string; tokens: number; usd?: number; wallMs: number; checks?: Check[]; screenshot?: string; gateRounds?: number; warnings?: string[]; followUp?: { offer: string } | null; tierUsed?: string };
type Ev = { wall: string; pretend: string; type: string; door?: number; detail?: string };

const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const rel = (p: string) => p.replace(OUT + '/', '');
const fmtTok = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)} M` : `${Math.round(n / 1000)} k`);
const fmtMin = (ms: number) => (ms >= 3_600_000 ? `${(ms / 3_600_000).toFixed(1)} h` : `${Math.round(ms / 60_000)} min`);
const zh = (iso?: string) => (iso ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Zurich', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)) : '');
const verbs = (v: unknown) => (Array.isArray(v) ? v : v ? [v] : []).map((x) => String(x).toLowerCase());

function loadIndex(): { day1: Set<string>; finale: Set<string>; byId: Map<string, { family: string; title: string }> } {
  const idx = JSON.parse(readFileSync(join(REPO, 'gift-library', 'INDEX.json'), 'utf8')) as { ideas: Array<{ id: string; anchor: string; family: string; title: string }> };
  return { day1: new Set(idx.ideas.filter((i) => i.anchor === 'day1').map((i) => i.id)), finale: new Set(idx.ideas.filter((i) => i.anchor === 'finale').map((i) => i.id)), byId: new Map(idx.ideas.map((i) => [i.id, i])) };
}

function loadSeasons(): Season[] {
  const dir = join(OUT, 'plan');
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((d) => existsSync(join(dir, d, 'meta.json'))).sort().map((label) => ({
    label,
    meta: readJsonSafe(join(dir, label, 'meta.json'))!,
    days: readdirSync(join(dir, label)).filter((f) => /^day-\d+\.json$/.test(f)).sort().map((f) => readJsonSafe<PlanDay>(join(dir, label, f))!).filter(Boolean),
  }));
}

/** Rule check per season (gift-director §3–§5). Returns human-readable violations. */
function ruleCheck(s: Season, index: ReturnType<typeof loadIndex>): string[] {
  const v: string[] = [];
  const at = (d: number) => s.days.find((x) => x.day === d)?.plan;
  const d1 = at(1);
  if (d1 && !(d1.ideaId && index.day1.has(d1.ideaId))) v.push(`Day 1 is not a Day 1 idea (${d1.ideaId ?? 'invented'})`);
  const d24 = at(24);
  if (d24 && !(d24.ideaId && index.finale.has(d24.ideaId)) && d24.tier !== 'XL') v.push(`December 24 is neither a finale idea nor XL (${d24.ideaId ?? 'invented'}, tier ${d24.tier ?? '?'})`);
  const sets = new Map<string, number[]>();
  for (const d of s.days) if (d.plan?.collection?.set) sets.set(d.plan.collection.set, [...(sets.get(d.plan.collection.set) ?? []), d.day]);
  if (sets.size > 2) v.push(`${sets.size} collections (max 2): ${[...sets.keys()].join(', ')}`);
  for (const [set, days] of sets) {
    if (days.length > 3) v.push(`collection ${set} has ${days.length} items (max 3)`);
    for (let i = 1; i < days.length; i++) if (days[i]! - days[i - 1]! < 4) v.push(`collection ${set}: days ${days[i - 1]} and ${days[i]} are less than 4 days apart`);
  }
  for (const d of s.days) {
    const p = d.plan;
    if (!p) { v.push(`day ${d.day}: no choice`); continue; }
    for (let back = 1; back <= 3; back++) {
      const q = at(d.day - back);
      if (!q) continue;
      if (p.family && p.family === q.family) v.push(`day ${d.day}: family ${p.family} repeats day ${d.day - back}`);
      if (p.form && p.form === q.form && p.form !== 'interactive-html') v.push(`day ${d.day}: form ${p.form} repeats day ${d.day - back}`);
      const shared = verbs(p.interaction).filter((x) => verbs(q.interaction).includes(x));
      if (shared.length) v.push(`day ${d.day}: interaction "${shared.join('", "')}" repeats day ${d.day - back}`);
    }
    if (p.emotion === 'touching' && d.day < 5) v.push(`day ${d.day}: touching before Day 5`);
  }
  return v;
}

function count<T>(xs: T[]): Array<[T, number]> {
  const m = new Map<T, number>();
  for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function bars(rows: Array<[string, number]>, total: number): string {
  return `<div class="bars">${rows.map(([k, n]) => `<div class="bar"><span class="k">${esc(k)}</span><span class="track"><span style="width:${Math.round((n / Math.max(1, total)) * 100)}%"></span></span><span class="n">${n}</span></div>`).join('')}</div>`;
}

function originality(seasons: Season[], index: ReturnType<typeof loadIndex>): string {
  if (!seasons.length) return '<p class="muted">No originality runs yet.</p>';
  const head = `<tr><th>Day</th>${seasons.map((s) => `<th>${esc(s.meta.adapter)}<br><small>${esc(s.meta.model)}</small></th>`).join('')}</tr>`;
  const rows = Array.from({ length: 24 }, (_, i) => i + 1).map((day) => `<tr><td class="num">${day}</td>${seasons.map((s) => {
    const p = s.days.find((d) => d.day === day)?.plan;
    if (!p) return '<td class="bad">—</td>';
    return `<td><b>${esc(p.title)}</b><br><small>${p.ideaId ? `<code>${esc(p.ideaId)}</code>` : '<span class="inv">invented</span>'} · ${esc(p.family)} · <span class="emo emo-${esc(p.emotion)}">${esc(p.emotion)}</span></small></td>`;
  }).join('')}</tr>`).join('');

  const all = seasons.flatMap((s) => s.days.map((d) => ({ s: s.label, d })));
  const stats = seasons.map((s) => {
    const ps = s.days.map((d) => d.plan).filter(Boolean);
    const lib = ps.filter((p) => p!.ideaId).length;
    const ids = ps.map((p) => p!.ideaId).filter(Boolean) as string[];
    const repeats = count(ids).filter(([, n]) => n > 1);
    const tokens = s.days.reduce((a, d) => a + (d.tokens ?? 0), 0);
    const ms = s.days.reduce((a, d) => a + (d.durationMs ?? 0), 0);
    const noDetails = s.days.filter((d) => d.plan && !(d.plan.personalDetails ?? []).length).map((d) => d.day);
    return { s, ps, lib, ids: new Set(ids), repeats, tokens, ms, noDetails, rules: ruleCheck(s, index) };
  });
  const multi = count(all.map((x) => x.d.plan?.ideaId).filter(Boolean) as string[]).map(([id]) => [id, seasons.filter((s) => s.days.some((d) => d.plan?.ideaId === id)).length] as [string, number]).filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]);
  const overlap = stats.flatMap((a, i) => stats.slice(i + 1).map((b) => {
    const inter = [...a.ids].filter((x) => b.ids.has(x)).length;
    const union = new Set([...a.ids, ...b.ids]).size;
    return `<tr><td>${esc(a.s.label)}</td><td>${esc(b.s.label)}</td><td class="num">${inter}</td><td class="num">${union ? Math.round((inter / union) * 100) : 0}%</td></tr>`;
  })).join('');

  const summary = `<table><tr><th>Season</th><th>Library</th><th>Invented</th><th>Repeats in season</th><th>Rule flags</th><th>Pitches with no personal detail</th><th>Tokens</th><th>Time</th></tr>${stats.map((x) => `<tr><td>${esc(x.s.label)}</td><td class="num">${x.lib}</td><td class="num">${x.ps.length - x.lib}</td><td>${x.repeats.map(([id, n]) => `${esc(id)} ×${n}`).join(', ') || '—'}</td><td class="${x.rules.length ? 'bad' : 'good'} num">${x.rules.length}</td><td>${x.noDetails.length}/${x.ps.length}</td><td class="num">${fmtTok(x.tokens)}</td><td class="num">${fmtMin(x.ms)}</td></tr>`).join('')}</table>`;
  const rules = stats.map((x) => `<details ${x.rules.length ? 'open' : ''}><summary>${esc(x.s.label)}: ${x.rules.length ? `<span class="bad">${x.rules.length} rule flags</span>` : '<span class="good">all rules pass</span>'}</summary><ul>${x.rules.map((r) => `<li class="bad">${esc(r)}</li>`).join('')}</ul></details>`).join('');
  const dists = (['family', 'emotion', 'interaction'] as const).map((k) => `<div><h4>By ${k}</h4><div class="cols">${seasons.map((s) => {
    const vals = s.days.flatMap((d) => (k === 'interaction' ? verbs(d.plan?.interaction) : [String(d.plan?.[k] ?? '—')]));
    return `<div><small>${esc(s.label)}</small>${bars(count(vals).slice(0, k === 'interaction' ? 10 : 12), Math.max(...count(vals).map(([, n]) => n), 1))}</div>`;
  }).join('')}</div></div>`).join('');
  const details = seasons.map((s) => `<details><summary>${esc(s.label)}: pitches and personal details</summary><table><tr><th>Day</th><th>Pitch</th><th>Personal details used</th><th>Share frame</th><th>Follow-up offer</th></tr>${s.days.map((d) => `<tr><td class="num">${d.day}</td><td>${esc(d.plan?.pitch)}</td><td class="${(d.plan?.personalDetails ?? []).length ? '' : 'bad'}">${(d.plan?.personalDetails ?? []).map(esc).join('; ') || 'none'}</td><td><small>${esc(d.plan?.shareFrame)}</small></td><td><small>${esc(typeof d.plan?.followUp === 'object' && d.plan?.followUp ? (d.plan.followUp as { offer?: string }).offer : d.plan?.followUp ?? '')}</small></td></tr>`).join('')}</table></details>`).join('');
  return `${summary}
  <h3>Ideas picked in 2 or more seasons</h3><p>${multi.map(([id, n]) => `<code>${esc(id)}</code> ×${n}`).join(' · ') || '—'}</p>
  <h3>Overlap between seasons (library ideas)</h3><table><tr><th>Season</th><th>Season</th><th>Shared ideas</th><th>Jaccard</th></tr>${overlap}</table>
  <h3>Rule check</h3>${rules}
  <h3>Side by side</h3><div class="scroll"><table class="side">${head}${rows}</table></div>
  <h3>Distribution</h3>${dists}
  ${details}`;
}

function quality(made: Made[]): string {
  if (!made.length) return '<p class="muted">No quality runs yet.</p>';
  const cards = made.map((m, i) => {
    const img = m.screenshot ? `make/${m.label}/${m.screenshot.split('/').pop()}` : '';
    const open = m.entry ? `make/${m.label}/gift/${m.entry}` : '';
    const checks = (m.checks ?? []).map((c) => `<li class="${c.ok === null ? 'na' : c.ok ? 'good' : 'bad'}">${c.ok === null ? '–' : c.ok ? '✓' : '✗'} ${esc(c.name)}${c.detail ? ` <small>${esc(c.detail)}</small>` : ''}</li>`).join('');
    const scoreRow = ['emotion', 'interaction', 'share-worthiness', 'made for me', 'polish', 'would I post'].map((k) => `<label>${k}<select data-gift="${esc(m.label)}" data-k="${k}"><option value=""></option>${[1, 2, 3, 4, 5].map((n) => `<option>${n}</option>`).join('')}</select></label>`).join('');
    return `<article class="card">
      <div class="shot">${img ? `<a href="${esc(open || img)}" target="_blank"><img loading="lazy" src="${esc(img)}" alt=""></a>` : '<div class="noimg">no screenshot</div>'}</div>
      <div class="body">
        <h4>${i + 1}. ${esc(m.title ?? '(no gift)')}</h4>
        <p><small>${m.idea ? `forced <code>${esc(m.idea)}</code>` : `free choice → ${m.ideaUsed ? `<code>${esc(m.ideaUsed)}</code>` : 'invented'}`} · door ${m.day} · ${esc(m.kind ?? m.form ?? '')}${m.tierUsed ? ` · tier ${esc(m.tierUsed)}` : ''}</small></p>
        <p class="who hidden-until-scored"><small>${esc(m.adapter)} · ${esc(m.modelUsed ?? m.model)}</small></p>
        ${m.jobState !== 'ready' ? `<p class="bad">${esc(m.jobState)}: ${esc(m.failure?.userMessage)}</p>` : ''}
        ${m.note ? `<blockquote>${esc(m.note)}${m.signature ? `<br>— ${esc(m.signature)}` : ''}</blockquote>` : '<p class="muted">No note.</p>'}
        ${m.followUp ? `<p><small>followUp: ${esc(m.followUp.offer)}</small></p>` : ''}
        <ul class="checks">${checks}</ul>
        <p><small>${fmtTok(m.tokens)} tokens · ${fmtMin(m.wallMs)} · gate repairs ${m.gateRounds ?? 0}${(m.warnings ?? []).length ? ` · ${m.warnings!.length} warnings` : ''}${open ? ` · <a href="${esc(open)}" target="_blank">open the gift file</a>` : ''}</small></p>
        <div class="score">${scoreRow}</div>
      </div></article>`;
  }).join('');
  const ok = made.filter((m) => m.jobState === 'ready').length;
  const byH = (h: string) => made.filter((m) => m.adapter === h);
  const line = (h: string) => { const xs = byH(h); return xs.length ? `${esc(h)}: ${xs.filter((m) => m.jobState === 'ready').length}/${xs.length} made · ${fmtTok(xs.reduce((s, m) => s + m.tokens, 0))} tokens · ${fmtMin(xs.reduce((s, m) => s + m.wallMs, 0))}` : ''; };
  return `<p>${ok}/${made.length} gifts made. ${[line('claude-code'), line('codex')].filter(Boolean).join(' · ')}. Model and harness stay hidden until every score is filled in.</p>
  <div class="score-bar"><button id="save-scores" type="button">Save scores</button> <span id="score-status" class="muted"></span></div>
  <div class="grid">${cards}</div>`;
}

function rehearsal(): string {
  const dir = join(OUT, 'simulate');
  if (!existsSync(dir)) return '<p class="muted">No dress rehearsal yet.</p>';
  return readdirSync(dir).filter((d) => statSync(join(dir, d)).isDirectory()).map((label) => {
    const tl = readJsonSafe<{ model: string; adapter: string; events: Ev[] }>(join(dir, label, 'timeline.json'));
    const sum = readJsonSafe<{ doors: Array<{ day: number; title?: string; tokens: number; wallMs: number; attempts: number; failures: string[]; gateRounds: number; jobState: string; revealed: boolean; collection: { set: string; index: number } | null; ideaId: string | null; note: string | null }>; totals: { tokens: number; agentMs: number; wallMs: number }; checks: { everyDoorOpenable: boolean; notOpenable: number[]; collections: Array<{ set: string; days: number[]; ok: boolean; complete: boolean }>; finaleStartedOn?: string; finaleStartedDec20: boolean; finaleCallbacks: number[]; catchUp: Array<{ day: number; opened: boolean; openedOn?: string }> } }>(join(dir, label, 'summary.json'));
    if (!tl) return '';
    const inv = readJsonSafe<{ repaired: boolean; rounds: number; wallMs: number; tokens: number }>(join(dir, label, 'invalid-gift.json'));
    const evs = tl.events;
    const perDay = Array.from({ length: 24 }, (_, i) => i + 1).map((day) => {
      const e = evs.filter((x) => x.door === day);
      const first = (re: RegExp) => e.find((x) => re.test(`${x.type} ${x.detail ?? ''}`));
      const prep = first(/state (preparing|queued)/);
      const ready = e.filter((x) => x.type === 'state' && /^ready/.test(x.detail ?? '')).at(0);
      const opened = e.find((x) => x.type === 'opened');
      const fails = e.filter((x) => /fault|failed|user-retry|recovered|not-recovered|timeout|open-stuck|open-error/.test(`${x.type} ${x.detail ?? ''}`));
      const d = sum?.doors.find((x) => x.day === day);
      return `<tr><td class="num">${day}</td><td>${esc(d?.title ?? '')}</td><td><small>${esc(zh(prep?.pretend))}</small></td><td><small>${ready && prep ? `✓ ${Math.max(1, Math.round((Date.parse(ready.wall) - Date.parse(prep.wall)) / 60000))} min later` : ''}</small></td><td><small>${esc(zh(opened?.pretend))}</small></td><td class="${fails.length ? 'bad' : ''}"><small>${fails.map((x) => esc(`${x.type}${x.detail ? `: ${x.detail}` : ''}`)).join('<br>')}</small></td><td class="num">${d ? fmtTok(d.tokens) : ''}</td><td class="num">${d ? fmtMin(d.wallMs) : ''}</td></tr>`;
    }).join('');
    const c = sum?.checks;
    const ck = (ok: boolean | undefined, text: string) => `<li class="${ok ? 'good' : 'bad'}">${ok ? '✓' : '✗'} ${text}</li>`;
    const checks = c ? `<ul class="checks">
      ${ck(c.everyDoorOpenable, `every door ends up openable${c.notOpenable.length ? ` (not: ${c.notOpenable.join(', ')})` : ''}`)}
      ${ck(c.collections.every((x) => x.ok && x.complete), `collections: ${c.collections.map((x) => `${esc(x.set)} on days ${x.days.join(', ')}${x.complete ? '' : ' (incomplete)'}${x.ok ? '' : ' (spacing or size broken)'}`).join('; ') || 'none made'}`)}
      ${ck(c.finaleStartedDec20, `December 24 started ${esc(c.finaleStartedOn ? zh(c.finaleStartedOn) : 'never')}`)}
      ${ck(c.finaleCallbacks.length > 0, `December 24 calls back to the season: mentions gifts from days ${c.finaleCallbacks.join(', ') || 'none'}`)}
      ${ck(c.catchUp.every((x) => x.opened), `catch-up 9–11: ${c.catchUp.map((x) => `${x.day} ${x.opened ? `opened ${esc(zh(x.openedOn))}` : 'not opened'}`).join(', ')}`)}
      ${inv ? ck(inv.repaired, `invalid gift (door 14, separate run): the in-brief fault was refused by the agent, so a scripted first round left a broken package; the real agent ${inv.repaired ? `repaired it in round ${inv.rounds} (${fmtMin(inv.wallMs)}, ${fmtTok(inv.tokens)} tokens)` : 'did not repair it'}`) : ''}
    </ul>` : '<p class="muted">Still running: no summary yet.</p>';
    const gallery = existsSync(join(dir, label, 'shots')) ? `<div class="strip">${readdirSync(join(dir, label, 'shots')).filter((f) => f.endsWith('.png')).sort().map((f) => `<figure><a href="simulate/${label}/shots/${f}" target="_blank"><img loading="lazy" src="simulate/${label}/shots/${f}" alt=""></a><figcaption>${esc(f.replace('.png', ''))} ${esc(sum?.doors.find((d) => d.day === Number(f.slice(0, 2)))?.title ?? '')}</figcaption></figure>`).join('')}</div>` : '';
    return `<p>${esc(tl.adapter)} · ${esc(tl.model)}${sum ? ` · ${fmtTok(sum.totals.tokens)} tokens · ${fmtMin(sum.totals.agentMs)} of agent time · ${fmtMin(sum.totals.wallMs)} wall time` : ''}</p>
      ${checks}
      <h3>Timeline (pretend dates, Zurich)</h3><div class="scroll"><table><tr><th>Door</th><th>Gift</th><th>Prep started</th><th>Ready (real time)</th><th>Opened</th><th>Failures and recovery</th><th>Tokens</th><th>Agent time</th></tr>${perDay}</table></div>
      <details><summary>Other events</summary><ul>${evs.filter((x) => !x.door || /onboarding|share|save|restarted|ui-error|skipped/.test(x.type)).map((x) => `<li><small>${esc(zh(x.pretend))}</small> ${esc(x.type)}${x.door ? ` door ${x.door}` : ''}${x.detail ? `: ${esc(x.detail)}` : ''}</li>`).join('')}</ul></details>
      <h3>All gifts</h3>${gallery}`;
  }).join('');
}

function tokensSummary(seasons: Season[], made: Made[]): string {
  const plan = seasons.reduce((s, x) => s + x.days.reduce((a, d) => a + (d.tokens ?? 0), 0), 0);
  const make = made.reduce((s, m) => s + m.tokens, 0);
  const sim = readdirSync(join(OUT, 'simulate')).map((l) => readJsonSafe<{ totals: { tokens: number } }>(join(OUT, 'simulate', l, 'summary.json'))?.totals.tokens ?? 0).reduce((a, b) => a + b, 0);
  return `<div class="kpis"><div><b>${fmtTok(plan)}</b><span>originality (${seasons.length} seasons × 24 choices)</span></div><div><b>${fmtTok(make)}</b><span>quality (${made.length} gifts)</span></div><div><b>${fmtTok(sim)}</b><span>dress rehearsal</span></div></div><p class="muted small">Tokens are as the CLIs report them: input including cache reads, plus output. Cache reads dominate.</p>`;
}

export function buildReport(): string {
  const index = loadIndex();
  const seasons = loadSeasons();
  const makeDir = join(OUT, 'make');
  const made = existsSync(makeDir) ? readdirSync(makeDir).sort().map((l) => readJsonSafe<Made>(join(makeDir, l, 'result.json'))).filter((m): m is Made => Boolean(m)) : [];
  // Backfill usage from the lab home's ledger (early results were read before the agent process exited).
  for (const m of made) if (!m.tokens) { const u = ledgerUsage(join(LAB_HOMES, 'make', m.label), m.day); m.tokens = u.tokens; m.usd = u.usd; }
  const findings = readJsonSafe<string[]>(join(OUT, 'findings.json')) ?? [];
  const scores = readJsonSafe<Record<string, Record<string, number>>>(join(OUT, 'scores.json')) ?? {};
  mkdirSync(join(OUT, 'simulate'), { recursive: true });
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Gift lab report</title>
<style>
:root{--bg:#faf7f0;--fg:#1f1d1a;--muted:#6f6a60;--card:#fff;--line:#e6dfd2;--good:#2f7d4a;--bad:#b3261e;--accent:#8a2a2a}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#17161a;--fg:#eceae4;--muted:#a19c92;--card:#211f24;--line:#34313a;--good:#7fd28f;--bad:#ff8a80;--accent:#f2a6a0}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}
main{max-width:1280px;margin:0 auto;padding:24px 16px 80px}h1{font-size:28px;margin:0 0 4px}h2{margin:40px 0 8px;font-size:22px;border-bottom:2px solid var(--accent);padding-bottom:4px}h3{margin:24px 0 8px;font-size:16px}h4{margin:0 0 4px}
table{border-collapse:collapse;width:100%;margin:8px 0;background:var(--card)}th,td{border:1px solid var(--line);padding:6px 8px;text-align:left;vertical-align:top}th{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}
.num{text-align:right;font-variant-numeric:tabular-nums}.bad{color:var(--bad)}.good{color:var(--good)}.na{color:var(--muted)}.muted{color:var(--muted)}.small,small{font-size:12px}
code{font-size:12px;background:color-mix(in oklab,var(--line) 60%,transparent);padding:1px 4px;border-radius:4px}.inv{font-style:italic;color:var(--accent)}
.scroll{overflow-x:auto}.side td{min-width:200px}.cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px}
.bars .bar{display:grid;grid-template-columns:110px 1fr 28px;gap:6px;align-items:center;font-size:12px}.track{background:var(--line);height:8px;border-radius:4px;overflow:hidden}.track span{display:block;height:100%;background:var(--accent)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:16px}.card{background:var(--card);border:1px solid var(--line);border-radius:10px;overflow:hidden}
.shot img{width:100%;display:block;aspect-ratio:4/5;object-fit:cover;background:#000}.noimg{aspect-ratio:4/5;display:grid;place-items:center;color:var(--muted)}.body{padding:12px}
blockquote{margin:8px 0;padding:8px 10px;background:#16181d;color:#e8e6df;font:13px/1.5 ui-monospace,Menlo,monospace;border-radius:6px}
.checks{list-style:none;padding:0;margin:8px 0;font-size:13px}.score{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;font-size:12px}.score label{display:flex;flex-direction:column}
.hidden-until-scored{display:none}body.scored .hidden-until-scored{display:block}.score-bar{position:sticky;top:0;background:var(--bg);padding:8px 0;z-index:2}
.kpis{display:flex;gap:16px;flex-wrap:wrap}.kpis div{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 16px}.kpis b{display:block;font-size:22px}.kpis span{font-size:12px;color:var(--muted)}
.strip{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px}.strip img{width:100%;border-radius:6px;border:1px solid var(--line)}figure{margin:0}figcaption{font-size:12px}
details{margin:6px 0}summary{cursor:pointer}ol.findings li{margin:6px 0}
</style></head><body><main>
<h1>Gift lab report</h1><p class="muted">Generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC from lab/out. Persona: the agents' own memory; lab homes in ~/.advent-agent-lab, never the real calendar.</p>
${tokensSummary(seasons, made)}
${findings.length ? `<h2>Top problems</h2><ol class="findings">${findings.map((f) => `<li>${esc(f)}</li>`).join('')}</ol>` : ''}
<h2>Originality: 4 seasons, choices only</h2>${originality(seasons, index)}
<h2>Quality: full builds</h2>${quality(made)}
<h2>Dress rehearsal</h2>${rehearsal()}
</main>
<script>
const KEYS=['emotion','interaction','share-worthiness','made for me','polish','would I post'];
let scores=${JSON.stringify(scores)};
const sels=[...document.querySelectorAll('select[data-gift]')];
for(const s of sels){const v=scores[s.dataset.gift]?.[s.dataset.k];if(v)s.value=String(v);s.addEventListener('change',()=>{(scores[s.dataset.gift]??={})[s.dataset.k]=Number(s.value)||undefined;update();});}
function update(){const all=sels.every(s=>s.value);document.body.classList.toggle('scored',all);document.getElementById('score-status').textContent=all?'All scored: model and harness are shown.':sels.filter(s=>s.value).length+' of '+sels.length+' filled';}
update();
document.getElementById('save-scores')?.addEventListener('click',async()=>{const body=JSON.stringify(scores,null,2);try{const r=await fetch('scores',{method:'POST',body});if(!r.ok)throw 0;document.getElementById('score-status').textContent='Saved to lab/out/scores.json';}catch{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([body],{type:'application/json'}));a.download='scores.json';a.click();document.getElementById('score-status').textContent='Downloaded scores.json: put it in lab/out/';}});
</script></body></html>`;
}

export async function report(argv: string[]): Promise<number> {
  const f = parseFlags(argv);
  const file = join(OUT, 'report.html');
  writeFileSync(file, buildReport());
  console.log(`Report: ${file}`);
  if (!f.serve) return 0;
  const port = Number(f.port ?? 4950);
  const types: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.json': 'application/json', '.mp4': 'video/mp4', '.webm': 'video/webm', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.js': 'text/javascript', '.css': 'text/css', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.jpg': 'image/jpeg' };
  createServer((req, res) => {
    const url = decodeURIComponent((req.url ?? '/').split('?')[0]!);
    if (req.method === 'POST' && url === '/scores') {
      let body = '';
      req.on('data', (c) => (body += c)).on('end', () => { try { JSON.parse(body); writeFileSync(join(OUT, 'scores.json'), body); res.writeHead(200).end('ok'); } catch { res.writeHead(400).end('bad json'); } });
      return;
    }
    if (url === '/' || url === '/report.html') writeFileSync(file, buildReport());
    const path = normalize(join(OUT, url === '/' ? 'report.html' : url));
    if (!path.startsWith(OUT) || !existsSync(path) || statSync(path).isDirectory()) { res.writeHead(404).end('not found'); return; }
    res.writeHead(200, { 'content-type': types[extname(path)] ?? 'application/octet-stream' }).end(readFileSync(path));
  }).listen(port, '127.0.0.1', () => console.log(`Serving the report at http://127.0.0.1:${port}/ (scores save to lab/out/scores.json)`));
  await new Promise(() => undefined);
  return 0;
}
