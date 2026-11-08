/**
 * Internal test harness (not shipped, D24): a calendar in an isolated home with the fixture gifts from
 * fixtures/gifts and a simulated December day. Used by the e2e suite and for local screenshots/recordings.
 * It never runs an agent. Usage: tsx scripts/fixture-calendar.ts [--port N] [--gift-port N] [--day N] [--allow-shutdown]
 */
import { join } from 'node:path';
import { homedir } from 'node:os';
import { resolveHomeRoot } from '../src/core/paths.js';
import { parseArgs } from '../src/cli/args.js';
import { startCompanion } from '../src/server/companion.js';
import { installDemoFixtures } from '../src/demo/fixtures.js';

const p = parseArgs(['run', ...process.argv.slice(2)]);
const homeRoot = process.env.ADVENT_AGENT_HOME ? join(resolveHomeRoot(), 'demo') : join(homedir(), '.advent-agent-fixtures');
const appPort = Number(p.flags.port ?? 4324);
const giftPort = Number(p.flags['gift-port'] ?? 4325);
const companion = await startCompanion({ homeRoot, appPort, giftPort, allowRealAgents: false, allowShutdown: Boolean(p.flags['allow-shutdown']) });
await installDemoFixtures(companion.service, { simulatedDay: Number(p.flags.day ?? 8) });
console.log(`Fixture calendar on http://127.0.0.1:${appPort} (simulated December ${p.flags.day ?? 8}). Login link: ${companion.loginUrl('/')}`);
