/** Where the installed package keeps its bundled assets (workshop, library, UI, gary.js), from source or from dist. */
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function findPackageRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i++) {
    if (existsSync(join(dir, 'package.json')) && existsSync(join(dir, 'workshop'))) return dir;
    dir = resolve(dir, '..');
  }
  return resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
}

export const PACKAGE_ROOT = findPackageRoot();
export const WORKSHOP_DIR = join(PACKAGE_ROOT, 'workshop');
export const LIBRARY_DIR = join(PACKAGE_ROOT, 'gift-library');
export const UI_DIST_DIR = join(PACKAGE_ROOT, 'dist', 'ui');
export const SCHEMA_DIR = join(PACKAGE_ROOT, 'schema');

export function packageVersion(): string {
  try {
    const require = createRequire(import.meta.url);
    return (require(join(PACKAGE_ROOT, 'package.json')) as { version: string }).version;
  } catch {
    return '0.0.0';
  }
}

/** gary.js is a runtime dependency; its files are served from the installed package, never from a CDN. */
export function garyPackageDir(): string | undefined {
  try {
    const require = createRequire(import.meta.url);
    const pkg = require.resolve('gary.js/package.json');
    return dirname(pkg);
  } catch {
    return undefined;
  }
}

/** Absolute path to the `advent-agent` bin script of this installation. */
export function binPath(): string {
  return join(PACKAGE_ROOT, 'bin', 'advent-agent.js');
}
