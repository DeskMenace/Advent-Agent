#!/usr/bin/env node
/**
 * Scripted launched agent for tests (TEST_PLAN §2). Behaves like a terminal agent run by the calendar:
 * reads BRIEF.md in cwd, reports progress, writes ./gift, submits. Scenarios via FAKE_AGENT_SCENARIO:
 *   happy        progress through the HTTP API, writes a card gift, submits through the HTTP API
 *   auto-submit  writes the gift and exits 0 without submitting (the runner submits ./gift)
 *   progress-file writes phases into ./.progress, no commands at all, exits 0
 *   fail         exits 1 without a gift
 *   timeout      never exits (killed by the runner)
 *   secret       gift contains an API key
 *   broken       manifest references a missing file
 *   fix-on-retry broken on the first run, fixed when BRIEF.md lists previous problems
 *   cli          uses `advent-agent progress/submit` from PATH (requires the shim to work)
 *   list-task    (automatic when the folder holds TASK.md) turns sources/*.md bullet lines into list.md
 * Usage: node fake-agent.mjs <prompt_file> <door folder> <day>
 * The process starts in the season workspace (D28); the door folder is a subfolder (doors/NN).
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const [promptFile, workspace, dayArg] = process.argv.slice(2);
const scenario = process.env.FAKE_AGENT_SCENARIO ?? 'happy';
const cwd = workspace ?? process.cwd();
const brief = existsSync(join(cwd, 'BRIEF.md')) ? readFileSync(join(cwd, 'BRIEF.md'), 'utf8') : '';
const day = Number(dayArg ?? brief.match(/^# Door (\d+)/m)?.[1] ?? process.env.ADVENT_AGENT_JOB?.split(':')[1] ?? 1);
const url = process.env.ADVENT_AGENT_URL;
const token = process.env.ADVENT_AGENT_TOKEN;
const log = (m) => console.log(`[fake-agent] ${m}`);
if (existsSync(join(cwd, 'TASK.md'))) {
  // "Checking the list": read only the copied sources, write list.md.
  const dir = join(cwd, 'sources');
  const out = [];
  // The task says: read sources/ALL.md once. Every source sits under a "===== <file> (<label>) =====" header.
  const bundle = existsSync(join(dir, 'ALL.md')) ? readFileSync(join(dir, 'ALL.md'), 'utf8') : '';
  let current = '';
  for (const l of bundle.split('\n')) {
    const h = l.match(/^===== (\S+) \(/);
    if (h) { current = h[1]; continue; }
    if (/^- /.test(l)) out.push(`${l} [source: ${current}]`);
  }
  if (process.env.FAKE_AGENT_LIST_FAIL) process.exit(1);
  writeFileSync(join(cwd, 'list.md'), out.join('\n') + '\n');
  writeFileSync(join(cwd, 'list-run.json'), JSON.stringify({ cwd: process.cwd(), sources: existsSync(dir) ? readdirSync(dir) : [] }));
  process.exit(0);
}
log(`scenario=${scenario} day=${day} prompt=${promptFile ? readFileSync(promptFile, 'utf8').slice(0, 40) : '(none)'}`);
// Emit something that looks like usage telemetry so the runner's parser has work to do.
console.log(JSON.stringify({ type: 'result', usage: { input_tokens: 1200, output_tokens: 800 }, total_cost_usd: 0.0123 }));

async function progress(phase) {
  if (scenario === 'cli') { spawnSync('advent-agent', ['progress', phase], { stdio: 'inherit', shell: false }); return; }
  if (!url || !token) return;
  await fetch(`${url}/api/agent/progress`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ day, phase }) });
}

function writeGift({ secret = false, broken = false } = {}) {
  // Record where this process started and which doors it can see (the season workspace holds earlier doors).
  writeFileSync(join(process.cwd(), `seen-${day}.json`), JSON.stringify({ cwd: process.cwd(), doors: readdirSync(join(cwd, '..')).sort(), earlierGifts: readdirSync(join(cwd, '..')).filter((d) => existsSync(join(cwd, '..', d, 'gift', 'gift.json'))).sort(), persona: existsSync(join(process.cwd(), 'CLAUDE.md')) ? readFileSync(join(process.cwd(), 'CLAUDE.md'), 'utf8') : null }));
  const gift = join(cwd, 'gift');
  mkdirSync(join(gift, 'assets'), { recursive: true });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 490"><rect width="700" height="490" fill="#fbf3e4"/><text x="350" y="245" text-anchor="middle" font-family="Georgia" font-size="48" fill="#1d513e">For you, door ${day}</text>${secret ? `<!-- sk-ant-api03-${'x'.repeat(40)} -->` : ''}</svg>`;
  writeFileSync(join(gift, 'card.svg'), svg);
  const manifest = {
    schema: 'advent-agent/gift@1',
    day,
    title: `A little card for door ${day}`,
    category: 'Printable card',
    note: 'I made this one small on purpose. Print it, fold it, give it away or keep it.',
    primary: 'card.svg',
    artifacts: [{ path: 'card.svg', kind: 'card', role: 'primary' }, ...(broken ? [{ path: 'assets/missing.png', kind: 'image' }] : [])],
    agent: { name: 'fake-agent' },
    usage: { tokens: 2000 },
  };
  writeFileSync(join(gift, 'gift.json'), JSON.stringify(manifest, null, 2));
  return gift;
}

async function submit(gift) {
  if (scenario === 'cli') {
    const r = spawnSync('advent-agent', ['submit', gift, '--day', String(day), '--json'], { encoding: 'utf8', shell: false });
    console.log(r.stdout); console.error(r.stderr);
    return r.status === 0;
  }
  const r = await fetch(`${url}/api/agent/submit?day=${day}&mode=launched`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ path: gift, day }) });
  const report = await r.json();
  log(`submit → ${JSON.stringify(report)}`);
  return report.ok;
}

async function main() {
  switch (scenario) {
    case 'fail':
      log('giving up'); process.exit(1);
    // eslint-disable-next-line no-fallthrough
    case 'timeout':
      log('thinking forever'); setInterval(() => {}, 1000); return;
    case 'progress-file':
      writeFileSync(join(cwd, '.progress'), 'thinking');
      await new Promise((r) => setTimeout(r, 2500));
      writeFileSync(join(cwd, '.progress'), 'making');
      writeGift();
      await new Promise((r) => setTimeout(r, 2500));
      writeFileSync(join(cwd, '.progress'), 'wrapping');
      return;
    case 'auto-submit':
      await progress('making'); writeGift(); return;
    case 'secret':
      await progress('making'); writeGift({ secret: true }); return;
    case 'broken':
      await progress('making'); writeGift({ broken: true }); return;
    case 'fix-on-retry': {
      const hasProblems = /quality gate rejected/i.test(brief);
      await progress('making');
      writeGift({ broken: !hasProblems });
      return;
    }
    case 'cli':
    case 'happy':
    default: {
      await progress('thinking');
      await progress('making');
      const gift = writeGift();
      await progress('testing');
      await progress('wrapping');
      const ok = await submit(gift);
      process.exit(ok ? 0 : 1);
    }
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
