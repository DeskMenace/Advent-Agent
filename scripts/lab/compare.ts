/**
 * lab compare --cc <label> --codex <label> [--persona <label>] [--rebuild <label,label>]
 * D28 rerun report: share of pitches that use a real personal detail (before vs after checking the list), the side-by-side
 * pitch table for the two seasons, each season's list.md, the persona test and the rebuilt gifts. Writes lab/out/list-rerun.md.
 * Everything stays local (lab/out is gitignored): list.md shows what the agent found about the user.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { OUT, parseFlags, readJsonSafe } from './common.js';
import { mascotCentred, sameSubjectShare } from './subject.js';

type Day = { day: number; plan: null | { title?: string; pitch?: string; ideaId?: string | null; personalDetails?: string[]; family?: string } };

function season(label: string): Day[] {
  const dir = join(OUT, 'plan', label);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => /^day-\d+\.json$/.test(f)).sort().map((f) => readJsonSafe<Day>(join(dir, f))!).filter(Boolean);
}
const used = (d: Day) => Boolean(d.plan?.personalDetails?.length);
const pct = (n: number, t: number) => (t ? `${Math.round((100 * n) / t)}%` : 'n/a');
const cell = (s: string | undefined) => (s ?? '').replace(/\|/g, '/').replace(/\n/g, ' ');

export async function compare(argv: string[]): Promise<number> {
  const f = parseFlags(argv);
  const cc = String(f.cc ?? 'cc-default-list1');
  const codex = String(f.codex ?? 'codex-gpt-6.1-sol-list1');
  const out: string[] = ['# Lab rerun after checking the list (D28)', ''];

  // Before: the four seasons run without a list.
  const before = readdirSync(join(OUT, 'plan')).filter((l) => !/list/.test(l)).map((l) => ({ l, days: season(l) }));
  const bTotal = before.reduce((s, x) => s + x.days.filter((d) => d.plan).length, 0);
  const bUsed = before.reduce((s, x) => s + x.days.filter(used).length, 0);
  const rows = [{ l: cc, days: season(cc) }, { l: codex, days: season(codex) }];
  out.push('## Share of pitches that use a real personal detail', '', '| Run | Pitches | With a real detail | Share |', '|---|---|---|---|');
  out.push(`| Before (4 seasons, no list) | ${bTotal} | ${bUsed} | ${pct(bUsed, bTotal)} |`);
  for (const x of before) { const t = x.days.filter((d) => d.plan).length; const u = x.days.filter(used).length; out.push(`| &nbsp;&nbsp;${x.l} | ${t} | ${u} | ${pct(u, t)} |`); }
  let aT = 0; let aU = 0;
  for (const x of rows) { const t = x.days.filter((d) => d.plan).length; const u = x.days.filter(used).length; aT += t; aU += u; out.push(`| **After: ${x.l}** | ${t} | ${u} | ${pct(u, t)} |`); }
  out.push(`| **After, both** | ${aT} | ${aU} | ${pct(aU, aT)} |`, '');

  // Variety: how the pitches use details, whether one subject runs through the season, and the mascot rule (D10, D32).
  const prev = [{ l: String(f['prev-cc'] ?? ''), days: season(String(f['prev-cc'] ?? '')) }, { l: String(f['prev-codex'] ?? ''), days: season(String(f['prev-codex'] ?? '')) }].filter((x) => x.days.length);
  const variety = (x: { l: string; days: Day[] }) => {
    const ps = x.days.filter((d) => d.plan).map((d) => ({ day: d.day, title: d.plan!.title, pitch: d.plan!.pitch, n: d.plan!.personalDetails?.length ?? 0 }));
    const listFile = join(OUT, 'plan', x.l, 'list.md');
    const subject = sameSubjectShare(ps, existsSync(listFile) ? readFileSync(listFile, 'utf8') : '');
    const gary = ps.filter((p) => mascotCentred(p.title, p.pitch)).map((p) => p.day);
    return { n: ps.length, withDetail: ps.filter((p) => p.n > 0).length, avg: ps.length ? ps.reduce((a, p) => a + p.n, 0) / ps.length : 0, subject, gary };
  };
  out.push('## Variety and the mascot rule', '', 'Heuristics: "same subject" is the one name from the list that the most pitches mention; "mascot-centred" is a pitch whose title or first sentence names Gary or Desk Menace, or that names them twice or more.', '');
  out.push('| Run | Pitches | With a detail | Avg details per pitch | Most-shared subject | Pitches about it | Mascot-centred |', '|---|---|---|---|---|---|---|');
  for (const [tag, list] of [['previous round', prev], ['this round', rows]] as const) {
    for (const x of list) { const v = variety(x); out.push(`| ${tag}: ${x.l} | ${v.n} | ${v.withDetail} (${pct(v.withDetail, v.n)}) | ${v.avg.toFixed(1)} | ${v.subject.entity || 'n/a'} | ${v.subject.count} (${pct(v.subject.count, v.n)}) | ${v.gary.length}${v.gary.length ? ` (days ${v.gary.join(', ')})` : ''} |`); }
  }
  out.push('');
  out.push('## Side by side', '', `| Day | ${cc} | details | ${codex} | details |`, '|---|---|---|---|---|');
  for (let d = 1; d <= 24; d++) {
    const a = rows[0]!.days.find((x) => x.day === d);
    const b = rows[1]!.days.find((x) => x.day === d);
    const t = (x?: Day) => (x?.plan ? `${cell(x.plan.title)} (${x.plan.ideaId ?? 'invented'})` : '—');
    const dt = (x?: Day) => cell(x?.plan?.personalDetails?.join('; ')) || '—';
    out.push(`| ${d} | ${t(a)} | ${dt(a)} | ${t(b)} | ${dt(b)} |`);
  }
  out.push('');
  for (const x of rows) {
    const md = join(OUT, 'plan', x.l, 'list.md');
    out.push(`## list.md · ${x.l}`, '', existsSync(md) ? readFileSync(md, 'utf8').trim() : '_(none written)_', '');
  }
  const extra = [...(typeof f.persona === 'string' ? [f.persona] : []), ...(typeof f.rebuild === 'string' ? f.rebuild.split(',') : [])];
  for (const label of extra) {
    const r = readJsonSafe<Record<string, unknown>>(join(OUT, 'make', label, 'result.json'));
    out.push(`## ${label}`, '');
    if (!r) { out.push('_(no result)_', ''); continue; }
    out.push(`- State: ${r.jobState}${r.title ? ` · “${r.title}”` : ''} · ${r.tokens} tokens · ${Math.round(Number(r.wallMs) / 60000)} min`, `- Persona: ${r.persona ?? 'none'} · list lines: ${r.listLines} · signature: ${JSON.stringify(r.signature)}`, `- Note: ${JSON.stringify(r.note)}`, `- Follow-up offer: ${JSON.stringify(r.followUp)}`);
    const checks = (r.checks as Array<{ name: string; ok: boolean | null; detail: string }> | undefined) ?? [];
    for (const c of checks) out.push(`- check · ${c.name}: ${c.ok === null ? 'n/a' : c.ok ? 'pass' : 'FAIL'} · ${c.detail}`);
    const list = join(OUT, 'make', label, 'list.md');
    if (existsSync(list)) out.push('', '<details><summary>list.md</summary>', '', readFileSync(list, 'utf8').trim(), '', '</details>');
    out.push('');
  }
  writeFileSync(join(OUT, 'list-rerun.md'), out.join('\n'));
  console.log(`wrote ${join(OUT, 'list-rerun.md')}`);
  return 0;
}
