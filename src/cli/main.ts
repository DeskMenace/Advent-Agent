/**
 * `advent-agent` CLI (AGENT_CONNECTIONS §7). No dependencies beyond node; `open` for the browser.
 */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { resolveHomeRoot, APP_PORT, GIFT_PORT } from '../core/paths.js';
import { packageVersion, PACKAGE_ROOT } from '../core/package-paths.js';
import { runGate, reportForAgent } from '../intake/gate.js';
import { PROGRESS_PHASES } from '../shared/gift.js';
import { startCompanion } from '../server/companion.js';
import { installService, serviceStatus, uninstallService } from '../jobs/service-install.js';
import { Store } from '../core/store.js';
import { CompanionClient, LAB_PORTS } from './client.js';
import { parseArgs, type Parsed } from './args.js';
import { doctor as doctorReport } from '../server/app.js';
import { CalendarService } from '../jobs/service.js';
import { installDemoFixtures } from '../demo/fixtures.js';
import { readIdea } from '../core/workshop.js';

const CREDIT = 'Advent Agent · made by Desk Menace (https://deskmenace.com/advent?ref=aa-app)';

function dim(s: string): string {
  return process.stdout.isTTY ? `\x1b[2m${s}\x1b[0m` : s;
}

function help(): string {
  return `advent-agent ${packageVersion()} — your AI agent is your Secret Santa.

Usage:
  advent-agent                         start the companion and open the calendar
  advent-agent start [--no-open]       start the companion (used by the login service)
  advent-agent setup | settings        open the setup wizard / settings
  advent-agent status                  season and door states (no spoilers)
  advent-agent context [--day N]       print the day brief as JSON
  advent-agent check <path> [--day N]  run the quality gate without sealing
  advent-agent submit <path> --day N   submit a gift (folder, zip, html, media file or .txt/.md)
  advent-agent progress <phase>        thinking | making | testing | wrapping (launched agents)
  advent-agent mcp                     MCP server over stdio
  advent-agent service install|uninstall|status
  advent-agent generate image --prompt "…" [--day N]   use the recipient's own image provider (if enabled)
  advent-agent lab --idea <id> | --ideas <a,b> | --free | open | review   gift lab (isolated, real agents)
  advent-agent export <file.zip> | import <file.zip> | backup
  advent-agent doctor                  detect agents, ports, browser, ffprobe
  advent-agent version | help

Environment: ADVENT_AGENT_HOME (data folder, default ~/.advent-agent).
`;
}

async function openBrowser(url: string): Promise<void> {
  try {
    const open = (await import('open')).default;
    await open(url);
  } catch {
    console.log(`Open this link in your browser: ${url}`);
  }
}

async function cmdStart(p: Parsed, opts: { open: boolean; path?: string }): Promise<void> {
  const client = new CompanionClient();
  if (await client.isRunning()) {
    if (opts.open) await openBrowser(await client.loginUrl(opts.path ?? '/'));
    else console.log(`The companion is already running on ${client.baseUrl}.`);
    return;
  }
  const companion = await startCompanion({ appPort: Number(p.flags.port ?? APP_PORT), giftPort: Number(p.flags['gift-port'] ?? GIFT_PORT) });
  const cfg = companion.service.config();
  if (!cfg.firstRunShown) {
    console.log(dim(CREDIT));
    companion.service.store.saveConfig({ firstRunShown: true });
  }
  console.log(`Advent Agent is running on http://127.0.0.1:${companion.appPort} (data in ${companion.service.store.home.root}).`);
  if (opts.open) await openBrowser(companion.loginUrl(opts.path ?? (cfg.setupComplete ? '/' : '/setup')));
  else console.log(dim('Open the calendar with: npx advent-agent'));
  await new Promise(() => undefined); // run until a signal
}

async function cmdStatus(): Promise<void> {
  const client = new CompanionClient();
  if (await client.isRunning()) {
    const cal = await client.json<{ season: { year: number; timeZone: string; mode: string }; eligibleThrough: number; opened: number; doors: Array<{ day: number; envelope: string; jobState: string }> }>('GET', '/api/calendar');
    console.log(`Season ${cal.season.year} · ${cal.season.timeZone} · ${cal.season.mode} mode · ${cal.eligibleThrough} door(s) unlocked · ${cal.opened} opened`);
    for (const d of cal.doors) console.log(`  door ${String(d.day).padStart(2)}  ${d.envelope.padEnd(15)} ${d.jobState}`);
    return;
  }
  const store = new Store();
  const season = store.currentSeason();
  if (!season) { console.log('No season yet. Run `npx advent-agent` to set up.'); return; }
  const service = new CalendarService({ allowRealAgents: false });
  const cal = service.calendar();
  console.log(`(companion not running) Season ${cal.season.year} · ${cal.season.timeZone} · ${cal.eligibleThrough} unlocked · ${cal.opened} opened`);
  for (const d of cal.doors) console.log(`  door ${String(d.day).padStart(2)}  ${d.envelope.padEnd(15)} ${d.jobState}`);
}

function jobDay(p: Parsed): number | undefined {
  if (p.flags.day !== undefined) return Number(p.flags.day);
  const job = process.env.ADVENT_AGENT_JOB;
  if (job) return Number(job.split(':')[1]);
  return undefined;
}

async function cmdContext(p: Parsed): Promise<void> {
  const client = new CompanionClient();
  await client.ensureRunning();
  const day = jobDay(p);
  const ctx = await client.json('GET', `/api/agent/context${day ? `?day=${day}` : ''}`);
  console.log(JSON.stringify(ctx, null, 2));
}

async function cmdCheck(p: Parsed): Promise<number> {
  const path = p.positionals[0];
  if (!path) { console.error('Usage: advent-agent check <path> [--day N]'); return 2; }
  const day = jobDay(p);
  const abs = resolve(path);
  const input = existsSync(abs) && (await import('node:fs')).statSync(abs).isDirectory() ? { type: 'folder' as const, path: abs } : { type: 'file' as const, file: abs };
  const result = await runGate(input, { day, render: p.flags['no-render'] ? false : true });
  const report = reportForAgent(result);
  if (result.root) (await import('node:fs')).rmSync(result.root, { recursive: true, force: true });
  if (p.flags.json) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(report.ok ? `OK — ${report.kind} gift, ${report.files} file(s), render check: ${report.render}` : 'NOT READY');
    for (const pr of report.problems) console.log(`  [${pr.severity}] ${pr.code}${pr.path ? ` (${pr.path})` : ''}: ${pr.message}`);
  }
  return report.ok ? 0 : 1;
}

async function cmdSubmit(p: Parsed): Promise<number> {
  const path = p.positionals[0];
  const day = jobDay(p);
  if (!path || !day) { console.error('Usage: advent-agent submit <path> --day N'); return 2; }
  const client = new CompanionClient();
  await client.ensureRunning();
  const mode = process.env.ADVENT_AGENT_JOB ? 'launched' : 'submit';
  try {
    const report = await client.json<{ ok: boolean; problems: Array<{ severity: string; code: string; path?: string; message: string }>; kind?: string }>('POST', `/api/agent/submit?day=${day}&mode=${mode}`, { path: resolve(path), day });
    if (p.flags.json) console.log(JSON.stringify(report, null, 2));
    else {
      console.log(report.ok ? `Sealed. Door ${day} is ready (${report.kind}).` : 'The quality gate found problems. Fix them and submit again:');
      for (const pr of report.problems) console.log(`  [${pr.severity}] ${pr.code}${pr.path ? ` (${pr.path})` : ''}: ${pr.message}`);
    }
    return report.ok ? 0 : 1;
  } catch (e) {
    console.error((e as Error).message);
    return 1;
  }
}

async function cmdProgress(p: Parsed): Promise<number> {
  const phase = p.positionals[0];
  const day = jobDay(p);
  if (!phase || !(PROGRESS_PHASES as readonly string[]).includes(phase)) { console.error(`Usage: advent-agent progress <${PROGRESS_PHASES.join('|')}> [--day N]`); return 2; }
  if (!day) { console.error('No door: pass --day N (or run from a launched job).'); return 2; }
  const client = new CompanionClient();
  try {
    await client.json('POST', '/api/agent/progress', { day, phase });
    return 0;
  } catch (e) {
    console.error((e as Error).message);
    return 1;
  }
}

/** `advent-agent generate image --prompt "..." [--provider id] [--size 1024x1024] [--n 1] [--day N]` (D9 narrow adapter). */
async function cmdGenerate(p: Parsed): Promise<number> {
  const kind = p.positionals[0];
  const day = jobDay(p);
  if (kind !== 'image' || !p.flags.prompt || !day) { console.error('Usage: advent-agent generate image --prompt "<text>" [--provider <id>] [--size 1024x1024] [--n 1] [--day N]'); return 2; }
  const client = new CompanionClient();
  await client.ensureRunning();
  try {
    let provider = p.flags.provider ? String(p.flags.provider) : undefined;
    if (!provider) {
      const { providers } = await client.json<{ providers: Array<{ id: string; kind: string }> }>('GET', '/api/agent/providers');
      provider = providers.find((x) => x.kind === 'image')?.id;
      if (!provider) { console.error('No image provider is configured. Make the image yourself instead.'); return 1; }
    }
    const r = await client.json<{ files: string[]; estimatedUsd: number }>('POST', '/api/agent/generate', { provider, op: 'generateImage', params: { prompt: String(p.flags.prompt), size: p.flags.size, n: p.flags.n ? Number(p.flags.n) : undefined }, day });
    console.log(JSON.stringify(r, null, 2));
    return 0;
  } catch (e) {
    console.error((e as Error).message);
    return 1;
  }
}

async function cmdService(p: Parsed): Promise<number> {
  const sub = p.positionals[0];
  const homeRoot = process.env.ADVENT_AGENT_HOME;
  if (sub === 'install') { const r = installService({ homeRoot }); console.log(r.message); return r.ok ? 0 : 1; }
  if (sub === 'uninstall') { const r = uninstallService({ homeRoot }); console.log(r.message); return r.ok ? 0 : 1; }
  const s = serviceStatus({ homeRoot });
  console.log(`${s.installed ? 'installed' : 'not installed'} · ${s.running ? 'running' : 'not running'} · ${s.definition.path}${s.detail ? ` · ${s.detail}` : ''}`);
  return 0;
}

async function cmdLab(p: Parsed): Promise<number> {
  const homeRoot = join(resolveHomeRoot(), 'lab');
  const appPort = LAB_PORTS.app;
  const giftPort = LAB_PORTS.gift;
  const sub = p.positionals[0];
  const client = new CompanionClient({ homeRoot, appPort });
  const ensure = async () => {
    if (!(await client.isRunning())) {
      mkdirSync(homeRoot, { recursive: true });
      const liveStore = new Store();
      const labStore = new Store(homeRoot);
      // Copy the live settings (agent, permissions, profile) into the lab home, then unlock everything.
      labStore.saveConfig({ ...liveStore.config(), setupComplete: true, deliveryMode: 'on_demand' });
      labStore.saveProfile(liveStore.profile());
      const service = new CalendarService({ homeRoot, appPort, giftPort });
      service.ensureSeason('lab');
      writeFileSync(labStore.home.demoFile, JSON.stringify({ simulatedDay: 24 }));
      await client.ensureRunning({ extraArgs: ['--port', String(appPort), '--gift-port', String(giftPort)] });
    }
  };
  if (sub === 'open') { await ensure(); await openBrowser(await client.loginUrl('/')); return 0; }
  if (sub === 'review') { await ensure(); await openBrowser(await client.loginUrl('/lab/review')); return 0; }
  await ensure();
  const labStore = new Store(homeRoot);
  if (p.flags.agent) labStore.saveConfig((c) => ({ ...c, connection: { ...c.connection, mode: 'launched', adapter: String(p.flags.agent) as never } }));
  if (p.flags.profile) {
    const prof = JSON.parse((await import('node:fs')).readFileSync(resolve(String(p.flags.profile)), 'utf8'));
    labStore.saveProfile(prof);
  }
  const ideas = p.flags.ideas ? String(p.flags.ideas).split(',').map((s) => s.trim()).filter(Boolean) : p.flags.idea ? [String(p.flags.idea)] : p.flags.free ? ['--free'] : [];
  if (ideas.length === 0) { console.error('Usage: advent-agent lab --idea <id> | --ideas <a,b> | --free | open | review'); return 2; }
  const season = labStore.currentSeason()!;
  const doors = labStore.doors(season.year).readAll();
  let next = doors.find((d) => d.jobState === 'not_requested')?.day;
  for (const idea of ideas) {
    if (!next) { console.error('All 24 lab doors are used. Delete the lab home to start over.'); return 1; }
    if (idea !== '--free' && !readIdea(idea)) { console.error(`Unknown idea id: ${idea}`); return 2; }
    writeFileSync(join(labStore.home.doorDir(season.year, next), 'lab.json'), JSON.stringify({ idea: idea === '--free' ? undefined : idea, free: idea === '--free', agent: labStore.config().connection.adapter }));
    await client.json('POST', `/api/doors/${next}/open`);
    console.log(`Lab door ${next}: ${idea === '--free' ? 'wildcard (agent ignores the library)' : idea}`);
    next = doors.find((d) => d.day > next! && d.jobState === 'not_requested')?.day;
  }
  console.log(`Watch it at http://127.0.0.1:${appPort} (advent-agent lab open).`);
  return 0;
}

async function cmdExport(p: Parsed): Promise<number> {
  const file = p.positionals[0] ?? `advent-agent-export-${new Date().toISOString().slice(0, 10)}.zip`;
  const store = new Store();
  const r = await store.exportZip(resolve(file));
  console.log(`Exported ${r.files} file(s) to ${resolve(file)} (no tokens, keys or logs).`);
  return 0;
}

async function cmdImport(p: Parsed): Promise<number> {
  const file = p.positionals[0];
  if (!file) { console.error('Usage: advent-agent import <file.zip>'); return 2; }
  const store = new Store();
  const r = await store.importZip(resolve(file));
  console.log(`Imported ${r.files} file(s). A backup of the previous state is in ${store.home.backupsDir}.`);
  return 0;
}

async function cmdDoctor(): Promise<number> {
  const service = new CalendarService({ allowRealAgents: false });
  const r = await doctorReport(service);
  console.log(`advent-agent ${r.version} · node ${r.node} · ${r.platform}`);
  console.log(`home: ${r.home}`);
  console.log(`ports: app ${r.ports.app}, gift ${r.ports.gift}`);
  console.log(`setup: ${r.setupComplete ? 'complete' : 'not finished'} · mode: ${r.connection.mode}${r.connection.adapter ? ` (${r.connection.adapter})` : ''}`);
  console.log('agents:');
  for (const a of r.adapters) console.log(`  ${a.label.padEnd(20)} ${a.detection.installed ? `found ${a.detection.version ?? ''} ${a.detection.path ?? ''}` : 'not found'}${a.capabilities.verified ? '' : '  (flags unverified)'}`);
  console.log(`browser for gift test drive: ${r.browser ?? 'none (enable in Settings)'}`);
  console.log(`ffprobe: ${r.ffprobe ?? 'not found (media decode check skipped)'}`);
  console.log(`gary.js: ${r.gary} · UI built: ${r.uiBuilt} · workshop: ${r.workshop} · library: ${r.library} · keychain: ${r.keychain}`);
  return 0;
}

async function cmdDev(): Promise<void> {
  // Companion against a dev demo home; the UI is rebuilt by `vite build --watch` in another terminal (see README).
  const homeRoot = join(PACKAGE_ROOT, '.advent-agent-dev');
  const companion = await startCompanion({ homeRoot, allowRealAgents: true, allowShutdown: true });
  const store = companion.service.store;
  if (!store.currentSeason()) {
    store.saveConfig({ setupComplete: true, connection: { mode: 'portable', permissive: false } });
    companion.service.ensureSeason('demo');
    writeFileSync(store.home.demoFile, JSON.stringify({ simulatedDay: 8 }));
    await installDemoFixtures(companion.service, { simulatedDay: 8 });
  }
  console.log(`Dev companion on http://127.0.0.1:${companion.appPort} (home ${homeRoot}).`);
  await openBrowser(companion.loginUrl('/'));
  await new Promise(() => undefined);
}

export async function main(argv = process.argv.slice(2)): Promise<number> {
  const p = parseArgs(argv);
  const cmd = p.command ?? 'start';
  try {
    switch (cmd) {
      case 'start': await cmdStart(p, { open: !p.flags['no-open'] }); return 0;
      case 'open': await cmdStart(p, { open: true }); return 0;
      case 'setup': await cmdStart(p, { open: true, path: '/setup' }); return 0;
      case 'settings': await cmdStart(p, { open: true, path: '/settings' }); return 0;
      case 'status': await cmdStatus(); return 0;
      case 'context': await cmdContext(p); return 0;
      case 'check': return await cmdCheck(p);
      case 'submit': return await cmdSubmit(p);
      case 'progress': return await cmdProgress(p);
      case 'mcp': { const { runMcpServer } = await import('../mcp/server.js'); await runMcpServer(); return 0; }
      case 'service': return await cmdService(p);
      case 'generate': return await cmdGenerate(p);
      case 'lab': return await cmdLab(p);
      case 'export': return await cmdExport(p);
      case 'import': return await cmdImport(p);
      case 'backup': { const s = new Store(); console.log(`Backup written to ${s.backup('manual')}`); return 0; }
      case 'doctor': return await cmdDoctor();
      case 'dev': await cmdDev(); return 0;
      case 'version': case '--version': case '-v': console.log(packageVersion()); return 0;
      case 'help': case '--help': case '-h': console.log(help()); return 0;
      default: console.error(`Unknown command: ${cmd}\n`); console.log(help()); return 2;
    }
  } catch (e) {
    console.error((e as Error).message);
    return 1;
  }
}

export function listIdeasForCli(): string[] {
  const dir = join(PACKAGE_ROOT, 'gift-library', 'ideas');
  return existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, '')) : [];
}

const invokedDirectly = process.argv[1] && /main\.(ts|js)$/.test(process.argv[1]);
if (invokedDirectly) {
  main().then((code) => { if (code !== 0) process.exitCode = code; });
}
