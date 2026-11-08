import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createWriteStream, mkdtempSync, rmSync, writeFileSync, mkdirSync, symlinkSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import yazl from 'yazl';
import { extractZipSafely, copyFolderSafely, IntakeRejected, safeEntryName, writeFilesSafely } from '../../src/intake/unpack.js';
import { scanText } from '../../src/intake/secrets.js';
import { runGate } from '../../src/intake/gate.js';
import { isExecutablePath } from '../../src/intake/mime.js';
import { checkHtml } from '../../src/intake/checks.js';

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'aa-sec-')); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

/** Hand-made stored zip so we can write entry names and modes yazl refuses (traversal, symlinks). */
function rawZip(entries: Array<{ name: string; data: Buffer; mode?: number }>, name = 'raw.zip'): string {
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc32 = (buf: Buffer) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff]! ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const locals: Buffer[] = []; const centrals: Buffer[] = []; let offset = 0;
  for (const e of entries) {
    const nameBuf = Buffer.from(e.name, 'utf8'); const crc = crc32(e.data);
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0, 6); local.writeUInt16LE(0, 8); local.writeUInt32LE(0, 10); local.writeUInt32LE(crc, 14); local.writeUInt32LE(e.data.length, 18); local.writeUInt32LE(e.data.length, 22); local.writeUInt16LE(nameBuf.length, 26); local.writeUInt16LE(0, 28);
    const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(0x031e, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0, 8); central.writeUInt16LE(0, 10); central.writeUInt32LE(0, 12); central.writeUInt32LE(crc, 16); central.writeUInt32LE(e.data.length, 20); central.writeUInt32LE(e.data.length, 24); central.writeUInt16LE(nameBuf.length, 28); central.writeUInt16LE(0, 30); central.writeUInt16LE(0, 32); central.writeUInt16LE(0, 34); central.writeUInt16LE(0, 36); central.writeUInt32LE(((e.mode ?? 0o100644) << 16) >>> 0, 38); central.writeUInt32LE(offset, 42);
    locals.push(local, nameBuf, e.data); centrals.push(central, nameBuf); offset += local.length + nameBuf.length + e.data.length;
  }
  const cd = Buffer.concat(centrals); const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(0, 4); end.writeUInt16LE(0, 6); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16); end.writeUInt16LE(0, 20);
  const out = join(dir, name); writeFileSync(out, Buffer.concat([...locals, cd, end])); return out;
}

async function zipWith(add: (zip: yazl.ZipFile) => void, name = 'x.zip'): Promise<string> {
  const zip = new yazl.ZipFile();
  add(zip);
  zip.end();
  const out = join(dir, name);
  await new Promise<void>((res) => zip.outputStream.pipe(createWriteStream(out)).on('close', () => res()));
  return out;
}

describe('intake security', () => {
  it('U4.1 zip-slip entries are rejected', async () => {
    for (const bad of ['../evil.txt', '..\\evil.txt', '/abs/evil.txt', 'C:\\evil.txt', 'a/../../evil.txt']) {
      expect(() => safeEntryName(bad)).toThrow(IntakeRejected);
    }
    const zip = rawZip([{ name: 'ok.txt', data: Buffer.from('x') }, { name: 'sub/../../escape.txt', data: Buffer.from('evil') }]);
    await expect(extractZipSafely(zip, join(dir, 'out'))).rejects.toMatchObject({ code: 'path_traversal' });
    const abs = rawZip([{ name: '/etc/evil.txt', data: Buffer.from('evil') }], 'abs.zip');
    await expect(extractZipSafely(abs, join(dir, 'out-abs'))).rejects.toMatchObject({ code: 'path_absolute' });
    expect(existsSync(join(dir, 'escape.txt'))).toBe(false);
  });

  it('U4.2 symlinks are rejected (zip entries and folders)', async () => {
    const zip = rawZip([{ name: 'link', data: Buffer.from('/etc/passwd'), mode: 0o120777 }], 'link.zip');
    await expect(extractZipSafely(zip, join(dir, 'out'))).rejects.toMatchObject({ code: 'symlink' });
    const folder = join(dir, 'folder');
    mkdirSync(folder);
    writeFileSync(join(folder, 'gift.json'), '{}');
    symlinkSync('/etc/hosts', join(folder, 'hosts'));
    expect(() => copyFolderSafely(folder, join(dir, 'out2'))).toThrow(/Symbolic links/);
  });

  it('U4.3 too many files and total size limits (bomb with lying header)', async () => {
    const many = await zipWith((z) => { for (let i = 0; i < 12; i++) z.addBuffer(Buffer.from('x'), `f${i}.txt`); }, 'many.zip');
    await expect(extractZipSafely(many, join(dir, 'o1'), { maxFiles: 10 })).rejects.toMatchObject({ code: 'too_many_files' });
    const big = await zipWith((z) => { z.addBuffer(Buffer.alloc(3 * 1024 * 1024, 0), 'zeros.bin'); }, 'big.zip');
    await expect(extractZipSafely(big, join(dir, 'o2'), { maxTotalBytes: 1024 * 1024 })).rejects.toMatchObject({ code: expect.stringMatching(/too_large|file_too_large/) });
    const inline = () => writeFilesSafely(Array.from({ length: 5 }, (_, i) => ({ name: `f${i}`, data: Buffer.alloc(300) })), join(dir, 'o3'), { maxTotalBytes: 1000 });
    expect(inline).toThrow(IntakeRejected);
  });

  it('U4.4 oversized single file rejected', async () => {
    const z = await zipWith((zip) => zip.addBuffer(Buffer.alloc(2048, 1), 'a.bin'), 'one.zip');
    await expect(extractZipSafely(z, join(dir, 'o4'), { maxFileBytes: 1024, maxTotalBytes: 1 << 20 })).rejects.toMatchObject({ code: 'file_too_large' });
  });

  it('U4.5 executables are download-only with a warning, never the primary', async () => {
    for (const p of ['run.exe', 'bin/tool.sh', 'Thing.app/Contents/MacOS/Thing', 'lib.dll', 'setup.msi', 'x.bat', 'script.ps1', 'a.jar']) expect(isExecutablePath(p)).toBe(true);
    for (const p of ['index.html', 'assets/a.png', 'score.json', 'readme.md', 'song.wav']) expect(isExecutablePath(p)).toBe(false);
    const r = writeFilesSafely([{ name: 'gift.json', data: Buffer.from('{}') }, { name: 'tools/helper.sh', data: Buffer.from('#!/bin/sh') }], join(dir, 'o5'));
    expect(r.files.find((f) => f.path === 'tools/helper.sh')?.downloadOnly).toBe(true);
    expect(r.warnings[0]).toMatch(/download-only/);
  });

  it('U4.6 secret scanner: true positives', () => {
    const token = 'abcdefghijklmnopqrstuvwxyz0123456789ABCD';
    const samples: Array<[string, string]> = [
      ['sk-ant-api03-' + 'a'.repeat(40), 'anthropic_key'],
      ['OPENAI_API_KEY=sk-' + 'b'.repeat(40), 'env_assignment'],
      ['AIza' + 'C'.repeat(35), 'google_api_key'],
      ['AKIA' + 'D'.repeat(16), 'aws_access_key'],
      ['ghp_' + 'e'.repeat(36), 'github_token'],
      ['-----BEGIN RSA PRIVATE KEY-----', 'private_key'],
      ['Authorization: Bearer ' + 'f'.repeat(30), 'bearer_header'],
      ['{"api_key": "' + 'g'.repeat(20) + '"}', 'json_secret'],
      ['https://user:pass@example.com/path', 'url_credentials'],
      ['/Users/alex/Documents/private.txt', 'home_path'],
      ['C:\\Users\\Alex\\Desktop\\x', 'home_path'],
      [`token=${token}`, 'calendar_token'],
    ];
    for (const [text, kind] of samples) {
      const hits = scanText(text, { apiToken: token });
      expect(hits.map((h) => h.kind), text).toContain(kind);
    }
  });

  it('U4.6 secret scanner: false positives stay clean', () => {
    const clean = [
      'Dear you, this is a poem about skiing in December.',
      'The colour #a82438 and a short hex ff00ff.',
      'sk-eleton keys are not api keys',
      'Visit https://example.com/path?x=1 for the hut.',
      'export default function App() {}',
      'const KEY_NAME = "title";',
      'eyJhbGci is not a complete token',
      'Price checked on 2026-12-07: CHF 34.90',
      'Users of the app love it; the Home key works.',
    ];
    for (const text of clean) expect(scanText(text, { apiToken: 'x'.repeat(40) }), text).toEqual([]);
  });

  it('the gate rejects a gift containing a secret, with a structured problem', async () => {
    const r = await runGate({ type: 'files', entries: [
      { name: 'gift.json', data: Buffer.from(JSON.stringify({ day: 2, title: 'T', note: 'N', primary: 'index.html', artifacts: [{ path: 'index.html', kind: 'interactive-html' }] })) },
      { name: 'index.html', data: Buffer.from('<!doctype html><html><body><script>const k="sk-ant-api03-' + 'z'.repeat(40) + '"</script></body></html>') },
    ] }, { day: 2, render: false });
    expect(r.ok).toBe(false);
    expect(r.problems.some((p) => p.code === 'secret_anthropic_key')).toBe(true);
    expect(r.root).toBeUndefined(); // quarantine removed
  });

  it('HTML checks: remote script is an error, remote image a warning, missing local ref an error, allowed origin passes', () => {
    const root = join(dir, 'html');
    mkdirSync(join(root, 'assets'), { recursive: true });
    writeFileSync(join(root, 'assets/a.css'), 'body{}');
    const html = '<html><head><link rel="stylesheet" href="assets/a.css"><script src="https://cdn.example/x.js"></script></head><body><img src="https://img.example/a.png"><img src="assets/missing.png"></body></html>';
    const problems = checkHtml(root, 'index.html', html);
    expect(problems.find((p) => p.code === 'remote_code')?.severity).toBe('error');
    expect(problems.find((p) => p.code === 'remote_media')?.severity).toBe('warning');
    expect(problems.find((p) => p.code === 'ref_missing')?.message).toContain('assets/missing.png');
    const allowed = checkHtml(root, 'index.html', html, ['https://cdn.example', 'https://img.example']);
    expect(allowed.filter((p) => p.code === 'remote_code' || p.code === 'remote_media')).toEqual([]);
  });
});
