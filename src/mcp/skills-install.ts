/**
 * Optional skill installation for connected hosts (AGENT_CONNECTIONS §8). Copies workshop/skills/* into the
 * host's skills folder under one `advent-agent/` folder; uninstall removes only that folder. Never automatic.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { WORKSHOP_DIR } from '../core/package-paths.js';
import type { Config } from '../shared/config.js';

export interface SkillTarget {
  host: string;
  label: string;
  folder: string;
  installed: boolean;
  files: string[];
}

const FOLDER_NAME = 'advent-agent';

export function skillHostFolders(): Record<string, { label: string; root: string }> {
  const home = homedir();
  return {
    'claude-code': { label: 'Claude Code', root: join(home, '.claude', 'skills') },
    codex: { label: 'Codex', root: join(home, '.codex', 'skills') },
    gemini: { label: 'Gemini CLI', root: join(home, '.gemini', 'skills') },
    agents: { label: 'Shared ~/.agents/skills', root: join(home, '.agents', 'skills') },
  };
}

function skillFiles(): string[] {
  const dir = join(WORKSHOP_DIR, 'skills');
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  const walk = (d: string, rel: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(join(d, e.name), r);
      else out.push(r);
    }
  };
  walk(dir, '');
  return out.sort();
}

export function skillTargets(cfg: Config): SkillTarget[] {
  const files = skillFiles();
  return Object.entries(skillHostFolders()).map(([host, h]) => {
    const folder = join(h.root, FOLDER_NAME);
    return { host, label: h.label, folder, installed: existsSync(folder) || Boolean(cfg.installedSkills[host]), files };
  });
}

export function installSkills(host: string, confirm: boolean): { installed: boolean; folder: string; files: string[]; message: string } {
  const h = skillHostFolders()[host];
  if (!h) return { installed: false, folder: '', files: [], message: 'Unknown host.' };
  const folder = join(h.root, FOLDER_NAME);
  const files = skillFiles();
  if (!confirm) return { installed: false, folder, files, message: `This copies ${files.length} files into ${folder}. Confirm to proceed.` };
  mkdirSync(folder, { recursive: true });
  // Agent Skills convention: each skill is its own folder; we nest them under advent-agent/<skill>/.
  cpSync(join(WORKSHOP_DIR, 'skills'), folder, { recursive: true });
  return { installed: true, folder, files, message: `Installed into ${folder}.` };
}

export function uninstallSkills(host: string): { removed: boolean; folder: string; message: string } {
  const h = skillHostFolders()[host];
  if (!h) return { removed: false, folder: '', message: 'Unknown host.' };
  const folder = join(h.root, FOLDER_NAME);
  if (!existsSync(folder)) return { removed: false, folder, message: 'Nothing to remove.' };
  rmSync(folder, { recursive: true, force: true });
  return { removed: true, folder, message: `Removed ${folder}. Nothing else was touched.` };
}
