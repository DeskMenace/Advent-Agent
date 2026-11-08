/** Atomic file writes, JSON helpers, 0600 secrets. */
import { randomBytes } from 'node:crypto';
import { closeSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, writeSync, existsSync, chmodSync, unlinkSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { ZodType } from 'zod';

/** Hook used by tests to simulate a crash between the temp write and the rename. */
export const atomicHooks: { beforeRename?: (tmp: string, target: string) => void } = {};

export function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

/** Write to a temp file in the same directory, fsync, then rename over the target. */
export function writeFileAtomic(target: string, data: string | Uint8Array, mode?: number): void {
  ensureDir(dirname(target));
  const tmp = join(dirname(target), `.${randomBytes(6).toString('hex')}.tmp`);
  const fd = openSync(tmp, 'w', mode ?? 0o644);
  try {
    if (typeof data === 'string') writeSync(fd, data); else writeSync(fd, data);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  atomicHooks.beforeRename?.(tmp, target);
  renameSync(tmp, target);
  if (mode !== undefined && process.platform !== 'win32') chmodSync(target, mode);
}

export function writeJsonAtomic(target: string, value: unknown, mode?: number): void {
  writeFileAtomic(target, JSON.stringify(value, null, 2) + '\n', mode);
}

export function readJson<T>(file: string, schema: ZodType<T>): T | undefined {
  if (!existsSync(file)) return undefined;
  const text = readFileSync(file, 'utf8');
  const raw: unknown = JSON.parse(text);
  return schema.parse(raw);
}

export function readJsonRaw(file: string): unknown {
  if (!existsSync(file)) return undefined;
  return JSON.parse(readFileSync(file, 'utf8'));
}

export function appendLine(file: string, line: string): void {
  ensureDir(dirname(file));
  const fd = openSync(file, 'a', 0o644);
  try {
    writeSync(fd, line.endsWith('\n') ? line : line + '\n');
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

export function readLines(file: string): string[] {
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8').split('\n').filter((l) => l.trim().length > 0);
}

/** Read or create a random secret stored with mode 0600. */
export function readOrCreateSecret(file: string, bytes = 32): string {
  if (existsSync(file)) {
    const v = readFileSync(file, 'utf8').trim();
    if (v.length >= 32) return v;
  }
  const value = randomBytes(bytes).toString('base64url');
  writeFileAtomic(file, value + '\n', 0o600);
  return value;
}

export function removeIfExists(file: string): void {
  if (existsSync(file)) unlinkSync(file);
}

export function fileSize(file: string): number {
  return statSync(file).size;
}
