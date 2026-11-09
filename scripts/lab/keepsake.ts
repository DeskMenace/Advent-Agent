/**
 * lab keepsake [--to <folder>]     Archive the lab (results + lab homes) and build a 24-door calendar from the gifts.
 * lab open-calendar [--home <dir>] Open that calendar (its own ports, never runs agents, never touches ~/.advent-agent).
 *
 * The calendar is a lab season frozen on Dec 24 (demo.json), so every door can be opened at any time.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { join, resolve } from 'node:path';
import { Store } from '../../src/core/store.js';
import { LAB_HOMES, OUT, REPO, TZ, YEAR, parseFlags, writeJson } from './common.js';

export const ARCHIVE = resolve(REPO, '..', 'Advent-Lab-2026');
const pad = (n: number) => String(n).padStart(2, '0');

/** Day → source. Quality builds first (rated), the rehearsal's own gift for that day fills the rest. */
const PLAN: Array<{ day: number; home: string; fromDay: number; source: string }> = [
  { day: 1, home: 'make/q01-snow-globe', fromDay: 1, source: 'quality q01-snow-globe' },
  { day: 2, home: 'make/q02-pop-up-hello', fromDay: 1, source: 'quality q02-pop-up-hello (built as day 1)' },
  { day: 3, home: 'make/q03-holo-card', fromDay: 1, source: 'quality q03-holo-card (built as day 1)' },
  { day: 4, home: 'make/q04-tiny-companion', fromDay: 1, source: 'quality q04-tiny-companion (built as day 1)' },
  { day: 5, home: 'make/q11-free-d5', fromDay: 5, source: 'quality q11-free-d5' },
  { day: 6, home: 'make/q06-song-project', fromDay: 6, source: 'quality q06-song-project' },
  { day: 8, home: 'make/q07-mixtape', fromDay: 8, source: 'quality q07-mixtape' },
  { day: 10, home: 'make/q08-fish-tank', fromDay: 10, source: 'quality q08-fish-tank' },
  { day: 12, home: 'make/q12-free-d12', fromDay: 12, source: 'quality q12-free-d12' },
  { day: 14, home: 'make/q09-award-ceremony', fromDay: 14, source: 'quality q09-award-ceremony' },
  { day: 16, home: 'make/q10-downloads-archaeologist', fromDay: 16, source: 'quality q10-downloads-archaeologist' },
  { day: 18, home: 'make/q13-free-d18', fromDay: 18, source: 'quality q13-free-d18' },
  { day: 24, home: 'make/q05b-game-of-your-year-60min', fromDay: 24, source: 'quality q05b-game-of-your-year (60 min)' },
  ...[7, 9, 11, 13, 15, 17, 19, 20, 21, 22, 23].map((d) => ({ day: d, home: 'simulate/sim-cc-haiku', fromDay: d, source: 'rehearsal (Haiku)' })),
];

export async function keepsake(argv: string[]): Promise<number> {
  const f = parseFlags(argv);
  const to = resolve(String(f.to ?? ARCHIVE));
  const cal = join(to, 'calendar');
  if (existsSync(cal)) { console.error(`${cal} already exists; refusing to overwrite. Pass --to <new folder>.`); return 1; }
  mkdirSync(to, { recursive: true });

  // 1. The test results and the raw lab calendars, as they are.
  cpSync(OUT, join(to, 'results'), { recursive: true });
  cpSync(LAB_HOMES, join(to, 'lab-homes'), { recursive: true });

  // 2. The 24-door calendar.
  const store = new Store(cal);
  store.saveConfig((c) => ({
    ...c, setupComplete: true, onboardingDone: true, firstRunShown: true, timeZone: TZ, unlockHour: 0, deliveryMode: 'on_demand',
    connection: { mode: 'submit', permissive: false },
  }));
  store.createSeason({ year: YEAR, timeZone: TZ, unlockHour: 0, deliveryMode: 'on_demand', prepareDayBefore: true, connection: { mode: 'submit', permissive: false }, kind: 'lab' });
  writeFileSync(store.home.demoFile, JSON.stringify({ simulatedDay: 24 }));

  const rows: Array<Record<string, unknown>> = [];
  for (const p of [...PLAN].sort((a, b) => a.day - b.day)) {
    const srcHome = join(LAB_HOMES, p.home);
    const srcDoor = join(srcHome, 'seasons', String(YEAR), 'doors', pad(p.fromDay));
    const dstDoor = store.home.doorDir(YEAR, p.day);
    cpSync(join(srcDoor, 'gift'), join(dstDoor, 'gift'), { recursive: true });
    if (existsSync(join(srcDoor, 'log.txt'))) cpSync(join(srcDoor, 'log.txt'), join(dstDoor, 'log.txt'));
    const state = JSON.parse(readFileSync(join(srcDoor, 'state.json'), 'utf8'));
    if (state.jobState !== 'ready' || !state.gift) throw new Error(`${p.source}: door ${p.fromDay} is not ready`);
    state.day = p.day;
    state.revealed = false;
    delete state.revealedAt;
    if (p.day !== p.fromDay) {
      // Keep the package consistent with its new door.
      const manifestFile = join(dstDoor, 'gift', 'gift.json');
      const m = JSON.parse(readFileSync(manifestFile, 'utf8'));
      m.day = p.day;
      const text = JSON.stringify(m, null, 2);
      writeFileSync(manifestFile, text);
      state.gift.manifest.day = p.day;
      const entry = state.gift.files.find((x: { path: string }) => x.path === 'gift.json');
      if (entry) { entry.bytes = Buffer.byteLength(text); entry.sha256 = createHash('sha256').update(text).digest('hex'); }
    }
    writeFileSync(store.home.doorStateFile(YEAR, p.day), JSON.stringify(state, null, 2));
    // Usage for that gift, so the calendar shows what it cost.
    const ledger = join(srcHome, 'seasons', String(YEAR), 'ledger.jsonl');
    if (existsSync(ledger)) {
      for (const line of readFileSync(ledger, 'utf8').split('\n').filter(Boolean)) {
        try { const r = JSON.parse(line); if (r.day === p.fromDay && r.type === 'usage') store.appendLedger(YEAR, { ...r, day: p.day }); } catch { /* skip bad rows */ }
      }
    }
    rows.push({ day: p.day, title: state.gift.manifest.title, source: p.source });
  }
  writeJson(join(cal, 'sources.json'), rows);
  writeFileSync(join(to, 'README.md'), readme(to, rows));
  console.log(`Archived to ${to}`);
  for (const r of rows) console.log(`  ${pad(r.day as number)}  ${r.title}  ← ${r.source}`);
  return 0;
}

export async function openCalendar(argv: string[]): Promise<number> {
  const f = parseFlags(argv);
  const home = resolve(String(f.home ?? join(ARCHIVE, 'calendar')));
  if (!existsSync(join(home, 'seasons'))) { console.error(`No calendar in ${home}. Run: npm run lab -- keepsake`); return 1; }
  const { startCompanion } = await import('../../src/server/companion.js');
  const port = Number(f.port ?? 4980);
  const c = await startCompanion({ homeRoot: home, appPort: port, giftPort: port + 1, allowRealAgents: false });
  c.scheduler.stop();
  const url = c.loginUrl('/');
  console.log(`Lab calendar on http://127.0.0.1:${port} (data in ${home}). Ctrl+C to stop.\nOpen: ${url}`);
  if (!f['no-open']) spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [url], { stdio: 'ignore', detached: true }).unref();
  await new Promise(() => undefined);
  return 0;
}

function readme(to: string, rows: Array<Record<string, unknown>>): string {
  return `# Advent Agent lab, November 2026

Kept on purpose: do not delete. Built by \`npm run lab -- keepsake\` in Advent-Agent.

## Open the calendar
\`\`\`
cd ${REPO}
npm run lab -- open-calendar
\`\`\`
It runs on port 4980, frozen on Dec 24 so every door opens, never starts an agent, and never touches your real calendar (~/.advent-agent).

## What is here
- \`calendar/\`: the 24-door calendar (an Advent Agent data folder). \`calendar/sources.json\` says where each gift came from.
- \`results/\`: the lab outputs: \`report.html\`, \`scores.json\` (your ratings), \`findings.json\`, per-gift results, checks, screenshots and agent logs.
- \`lab-homes/\`: the raw lab calendars (workspaces included) as the agents left them.

## The 24 doors
${rows.map((r) => `- ${pad(r.day as number)}. ${r.title} (${r.source})`).join('\n')}

Archived ${new Date().toISOString().slice(0, 10)} to ${to}.
`;
}
