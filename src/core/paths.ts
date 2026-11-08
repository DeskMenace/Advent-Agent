/** Data directory layout (ARCHITECTURE §4). */
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

export const APP_PORT = 4224;
export const GIFT_PORT = 4225;

export interface Home {
  root: string;
  configFile: string;
  profileFile: string;
  sessionKeyFile: string;
  apiTokenFile: string;
  lockFile: string;
  seasonsDir: string;
  labDir: string;
  backupsDir: string;
  demoFile: string;
  seasonDir(year: number): string;
  seasonFile(year: number): string;
  doorDir(year: number, day: number): string;
  doorStateFile(year: number, day: number): string;
  workspaceDir(year: number, day: number): string;
  giftDir(year: number, day: number): string;
  logFile(year: number, day: number): string;
  historyFile(year: number): string;
  ledgerFile(year: number): string;
}

export function resolveHomeRoot(override?: string): string {
  const fromEnv = override ?? process.env.ADVENT_AGENT_HOME;
  return fromEnv ? resolve(fromEnv) : join(homedir(), '.advent-agent');
}

export function makeHome(root: string): Home {
  const pad = (n: number) => String(n).padStart(2, '0');
  const seasonsDir = join(root, 'seasons');
  const seasonDir = (year: number) => join(seasonsDir, String(year));
  const doorDir = (year: number, day: number) => join(seasonDir(year), 'doors', pad(day));
  return {
    root,
    configFile: join(root, 'config.json'),
    profileFile: join(root, 'profile.json'),
    sessionKeyFile: join(root, 'session.key'),
    apiTokenFile: join(root, 'api.token'),
    lockFile: join(root, 'companion.lock'),
    seasonsDir,
    labDir: join(root, 'lab'),
    backupsDir: join(root, 'backups'),
    demoFile: join(root, 'demo.json'),
    seasonDir,
    seasonFile: (year) => join(seasonDir(year), 'season.json'),
    doorDir,
    doorStateFile: (year, day) => join(doorDir(year, day), 'state.json'),
    workspaceDir: (year, day) => join(doorDir(year, day), 'workspace'),
    giftDir: (year, day) => join(doorDir(year, day), 'gift'),
    logFile: (year, day) => join(doorDir(year, day), 'log.txt'),
    historyFile: (year) => join(seasonDir(year), 'history.jsonl'),
    ledgerFile: (year) => join(seasonDir(year), 'ledger.jsonl'),
  };
}

export function defaultHome(): Home {
  return makeHome(resolveHomeRoot());
}

/** Files that must never leave the machine in an export or backup. */
export const SECRET_FILE_NAMES = new Set(['api.token', 'session.key', 'companion.lock', 'log.txt']);
