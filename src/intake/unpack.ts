/**
 * Safe unpacking into a quarantine folder (ARCHITECTURE §7 step 1):
 * zip-slip, symlinks, file count, total size, single-file size, executables flagged.
 */
import { createWriteStream, existsSync, lstatSync, mkdirSync, readdirSync, copyFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep, posix } from 'node:path';
import { pipeline } from 'node:stream/promises';
import yauzl from 'yauzl';
import { isExecutablePath } from './mime.js';

export interface UnpackLimits {
  maxFiles: number;
  maxTotalBytes: number;
  maxFileBytes?: number;
  /** Skip entries by (posix) name. */
  skip?: (name: string) => boolean;
  allowOverwrite?: boolean;
}

export interface UnpackedFile {
  /** Posix relative path inside the quarantine. */
  path: string;
  bytes: number;
  downloadOnly: boolean;
}

export interface UnpackResult {
  root: string;
  files: UnpackedFile[];
  warnings: string[];
}

export class IntakeRejected extends Error {
  constructor(public readonly code: string, message: string, public readonly path?: string) {
    super(message);
    this.name = 'IntakeRejected';
  }
}

const DEFAULT_LIMITS: UnpackLimits = { maxFiles: 200, maxTotalBytes: 200 * 1024 * 1024 };

/** Normalise an archive entry name; reject traversal, absolute paths and odd characters. */
export function safeEntryName(name: string): string {
  const unified = name.replace(/\\/g, '/');
  if (unified.startsWith('/') || /^[a-zA-Z]:/.test(unified) || unified.startsWith('//')) {
    throw new IntakeRejected('path_absolute', `Absolute paths are not allowed: ${name}`, name);
  }
  const segments = unified.split('/').filter((s) => s !== '' && s !== '.');
  if (segments.some((s) => s === '..')) throw new IntakeRejected('path_traversal', `Path traversal is not allowed: ${name}`, name);
  if (segments.some((s) => /[\0<>:"|?*]/.test(s) || /[\x00-\x1f]/.test(s))) {
    throw new IntakeRejected('path_chars', `Path contains unsupported characters: ${name}`, name);
  }
  if (segments.length === 0) throw new IntakeRejected('path_empty', 'Empty path', name);
  return segments.join('/');
}

function assertInside(root: string, target: string): void {
  const rel = relative(root, target);
  if (rel.startsWith('..') || resolve(target) === resolve(root) || rel.split(sep).includes('..')) {
    throw new IntakeRejected('path_traversal', `Path escapes the target folder: ${target}`);
  }
}

/** Extract a zip safely. Entries whose mode marks them as symlinks are rejected. */
export async function extractZipSafely(zipFile: string, root: string, limits: Partial<UnpackLimits> = {}): Promise<UnpackResult> {
  const lim = { ...DEFAULT_LIMITS, ...limits };
  mkdirSync(root, { recursive: true });
  const files: UnpackedFile[] = [];
  const warnings: string[] = [];
  let total = 0;

  const zip = await new Promise<yauzl.ZipFile>((res, rej) =>
    yauzl.open(zipFile, { lazyEntries: true, autoClose: true }, (err, zf) => (err || !zf ? rej(new IntakeRejected('zip_invalid', `Not a valid zip file: ${err?.message ?? 'unknown'}`)) : res(zf))),
  );

  if (zip.entryCount > lim.maxFiles) {
    zip.close();
    throw new IntakeRejected('too_many_files', `The package has ${zip.entryCount} entries; the limit is ${lim.maxFiles}.`);
  }

  await new Promise<void>((done, fail) => {
    zip.on('error', (e) => {
      if (e instanceof IntakeRejected) return fail(e);
      const msg = (e as Error).message ?? String(e);
      // yauzl validates entry names itself; keep our own codes for its findings.
      if (/invalid relative path/i.test(msg)) return fail(new IntakeRejected('path_traversal', `Path traversal is not allowed: ${msg}`));
      if (/absolute path/i.test(msg)) return fail(new IntakeRejected('path_absolute', `Absolute paths are not allowed: ${msg}`));
      fail(new IntakeRejected('zip_invalid', `Corrupt zip: ${msg}`));
    });
    zip.on('end', () => done());
    zip.on('entry', (entry: yauzl.Entry) => {
      void (async () => {
        try {
          const isDir = entry.fileName.endsWith('/');
          const mode = (entry.externalFileAttributes >>> 16) & 0xffff;
          const isSymlink = (mode & 0o170000) === 0o120000;
          if (isSymlink) throw new IntakeRejected('symlink', `Symbolic links are not allowed: ${entry.fileName}`, entry.fileName);
          let name: string;
          try {
            name = safeEntryName(entry.fileName);
          } catch (e) {
            if (isDir) { zip.readEntry(); return; }
            throw e;
          }
          if (isDir || (lim.skip && lim.skip(name))) { zip.readEntry(); return; }
          // Declared size is a hint; the stream is counted too (zip bombs lie).
          if (entry.uncompressedSize > (lim.maxFileBytes ?? lim.maxTotalBytes)) {
            throw new IntakeRejected('file_too_large', `${name} is ${entry.uncompressedSize} bytes; the limit is ${lim.maxFileBytes ?? lim.maxTotalBytes}.`, name);
          }
          if (total + entry.uncompressedSize > lim.maxTotalBytes) {
            throw new IntakeRejected('too_large', `The package exceeds ${Math.round(lim.maxTotalBytes / 1024 / 1024)} MB.`);
          }
          const target = join(root, ...name.split('/'));
          assertInside(root, target);
          if (existsSync(target) && !lim.allowOverwrite) throw new IntakeRejected('duplicate', `Duplicate entry: ${name}`, name);
          mkdirSync(dirname(target), { recursive: true });
          const stream = await new Promise<NodeJS.ReadableStream>((res, rej) => zip.openReadStream(entry, (err, s) => (err || !s ? rej(err) : res(s))));
          let written = 0;
          const limitBytes = lim.maxFileBytes ?? lim.maxTotalBytes;
          const counter = new (await import('node:stream')).Transform({
            transform(chunk: Buffer, _enc, cb) {
              written += chunk.length;
              total += chunk.length;
              if (written > limitBytes || total > lim.maxTotalBytes) {
                cb(new IntakeRejected('too_large', `The package exceeds its size limit while extracting ${name}.`, name));
                return;
              }
              cb(null, chunk);
            },
          });
          await pipeline(stream, counter, createWriteStream(target));
          files.push({ path: name, bytes: written, downloadOnly: isExecutablePath(name) });
          if (files.length > lim.maxFiles) throw new IntakeRejected('too_many_files', `More than ${lim.maxFiles} files.`);
          zip.readEntry();
        } catch (e) {
          zip.close();
          fail(e);
        }
      })();
    });
    zip.readEntry();
  });

  for (const f of files) if (f.downloadOnly) warnings.push(`${f.path} looks executable and is stored download-only.`);
  return { root, files, warnings };
}

/** Copy a folder into the quarantine with the same rules (no symlinks, limits). */
export function copyFolderSafely(source: string, root: string, limits: Partial<UnpackLimits> = {}): UnpackResult {
  const lim = { ...DEFAULT_LIMITS, ...limits };
  mkdirSync(root, { recursive: true });
  const files: UnpackedFile[] = [];
  const warnings: string[] = [];
  let total = 0;
  const walk = (dir: string, rel: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      const relPath = rel ? posix.join(rel, entry.name) : entry.name;
      const st = lstatSync(full);
      if (st.isSymbolicLink()) throw new IntakeRejected('symlink', `Symbolic links are not allowed: ${relPath}`, relPath);
      if (st.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        walk(full, relPath);
        continue;
      }
      if (!st.isFile()) continue;
      const name = safeEntryName(relPath);
      if (lim.skip?.(name)) continue;
      if (files.length + 1 > lim.maxFiles) throw new IntakeRejected('too_many_files', `More than ${lim.maxFiles} files.`);
      if (st.size > (lim.maxFileBytes ?? lim.maxTotalBytes)) throw new IntakeRejected('file_too_large', `${name} is too large.`, name);
      total += st.size;
      if (total > lim.maxTotalBytes) throw new IntakeRejected('too_large', `The package exceeds ${Math.round(lim.maxTotalBytes / 1024 / 1024)} MB.`);
      const target = join(root, ...name.split('/'));
      assertInside(root, target);
      mkdirSync(dirname(target), { recursive: true });
      copyFileSync(full, target);
      files.push({ path: name, bytes: st.size, downloadOnly: isExecutablePath(name) });
    }
  };
  walk(source, '');
  for (const f of files) if (f.downloadOnly) warnings.push(`${f.path} looks executable and is stored download-only.`);
  return { root, files, warnings };
}

/** Place in-memory files (inline MCP submission, drops, pastes) into the quarantine. */
export function writeFilesSafely(entries: Array<{ name: string; data: Buffer }>, root: string, limits: Partial<UnpackLimits> = {}): UnpackResult {
  const lim = { ...DEFAULT_LIMITS, ...limits };
  if (entries.length > lim.maxFiles) throw new IntakeRejected('too_many_files', `More than ${lim.maxFiles} files.`);
  mkdirSync(root, { recursive: true });
  const files: UnpackedFile[] = [];
  const warnings: string[] = [];
  let total = 0;
  for (const e of entries) {
    const name = safeEntryName(e.name);
    if (e.data.length > (lim.maxFileBytes ?? lim.maxTotalBytes)) throw new IntakeRejected('file_too_large', `${name} is too large.`, name);
    total += e.data.length;
    if (total > lim.maxTotalBytes) throw new IntakeRejected('too_large', `The package exceeds ${Math.round(lim.maxTotalBytes / 1024 / 1024)} MB.`);
    const target = join(root, ...name.split('/'));
    assertInside(root, target);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, e.data);
    files.push({ path: name, bytes: e.data.length, downloadOnly: isExecutablePath(name) });
  }
  for (const f of files) if (f.downloadOnly) warnings.push(`${f.path} looks executable and is stored download-only.`);
  return { root, files, warnings };
}

export function clearFolder(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}
