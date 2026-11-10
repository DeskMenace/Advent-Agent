/**
 * `advent-agent doctor`: what a bug report needs, and nothing personal. Paths are shortened to `~`, names and addresses are
 * removed, and the list, the persona and every gift stay out: only counts and error codes are printed.
 */
import { homedir } from 'node:os';

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

/** Make a string safe to paste: home paths become `~`, other users' home folders and email addresses disappear. */
export function redactForReport(text: string, home: string = homedir()): string {
  let out = text;
  if (home && home.length > 1) out = out.split(home).join('~');
  out = out
    .replace(/(?:\/Users|\/home)\/[^/\s"'`:;,)]+/g, '~')
    .replace(/[A-Za-z]:\\Users\\[^\\\s"'`:;,)]+/g, '~')
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '<email>');
  return out;
}

export interface DoctorData {
  version: string;
  node: string;
  platform: string;
  home: string;
  ports: { app: number; gift: number };
  setupComplete: boolean;
  connection: { mode: string; adapter?: string | null };
  adapters: Array<{ label: string; detection: { installed: boolean; version?: string; path?: string }; capabilities: { verified: boolean } }>;
  browser: string | null;
  ffprobe: string | null;
  gary: string;
  uiBuilt: boolean;
  workshop: boolean;
  library: boolean;
  keychain: boolean;
  /** Counts only; never lines, names or sources. */
  list?: { lines: number; checks: number; personaSet: boolean };
  /** Recent door failures: the day, the error code and a short, redacted message. */
  recentErrors?: Array<{ day: number; code: string; message: string }>;
}

export function formatDoctor(r: DoctorData, home: string = homedir()): string {
  const R = (s: string) => redactForReport(s, home);
  const L: string[] = [];
  L.push(`advent-agent ${r.version} · node ${r.node} · ${r.platform}`);
  L.push(`home: ${R(r.home)}`);
  L.push(`ports: app ${r.ports.app}, gift ${r.ports.gift}`);
  L.push(`setup: ${r.setupComplete ? 'complete' : 'not finished'} · mode: ${r.connection.mode}${r.connection.adapter ? ` (${r.connection.adapter})` : ''}`);
  L.push('agents:');
  for (const a of r.adapters) {
    L.push(`  ${a.label.padEnd(20)} ${a.detection.installed ? `found ${a.detection.version ?? ''} ${R(a.detection.path ?? '')}`.trimEnd() : 'not found'}${a.capabilities.verified ? '' : '  (flags unverified)'}`);
  }
  L.push(`browser for gift test drive: ${r.browser ?? 'none (enable in Settings)'}`);
  L.push(`ffprobe: ${r.ffprobe ? R(r.ffprobe) : 'not found (media decode check skipped)'}`);
  L.push(`gary.js: ${r.gary} · UI built: ${r.uiBuilt} · workshop: ${r.workshop} · library: ${r.library} · keychain: ${r.keychain}`);
  if (r.list) L.push(`list: ${r.list.lines} lines, ${r.list.checks} check(s) done · persona: ${r.list.personaSet ? 'set' : 'none'} (contents are never printed)`);
  L.push('recent errors:');
  if (!r.recentErrors?.length) L.push('  none');
  for (const e of r.recentErrors ?? []) L.push(`  door ${e.day}: ${e.code}${e.message ? ` · ${clip(R(e.message), 140)}` : ''}`);
  L.push('', 'Paths, names and addresses are redacted. Do not paste list.md, agent memory files or gift contents into an issue.');
  return L.join('\n');
}
