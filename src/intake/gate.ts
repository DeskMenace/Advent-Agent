/**
 * The quality gate: unpack → manifest → checks → secret scan → render → (seal).
 * Used identically by launched, connected, portable and submit modes.
 */
import { createHash, randomBytes } from 'node:crypto';
import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, extname, join } from 'node:path';
import type { GateProblem, GateReport } from '../shared/api.js';
import type { GiftManifest } from '../shared/gift.js';
import type { SealedGift, ConnectionMode, SealedFile } from '../shared/door.js';
import { buildManifest, manifestPrimaryKind } from './manifest.js';
import { checkManifest } from './checks.js';
import { mimeFor } from './mime.js';
import { renderCheck, type RenderResult } from './render.js';
import { scanBinary, scanText, TEXT_EXTENSIONS, type SecretHit } from './secrets.js';
import { clearFolder, copyFolderSafely, extractZipSafely, IntakeRejected, writeFilesSafely, type UnpackedFile, type UnpackLimits } from './unpack.js';

export type GateInput =
  | { type: 'zip'; file: string }
  | { type: 'folder'; path: string }
  | { type: 'file'; file: string; name?: string }
  | { type: 'files'; entries: Array<{ name: string; data: Buffer }> }
  | { type: 'text'; text: string; title?: string };

export interface GateOptions {
  day?: number;
  limits?: Partial<UnpackLimits>;
  apiToken?: string;
  keychainValues?: string[];
  /** Run the headless render check (default true; skipped when no browser is present). */
  render?: boolean;
  /** Origins the user has consented to for this gift. */
  allowedNetwork?: string[];
  /** Keep the quarantine folder on failure (debug). */
  keepQuarantine?: boolean;
  quarantineRoot?: string;
}

export interface GateResult extends GateReport {
  manifest?: GiftManifest;
  root?: string;
  unpacked?: UnpackedFile[];
  renderResult?: RenderResult;
  media?: 'passed' | 'failed' | 'skipped';
  secretHits?: SecretHit[];
  needsDay: boolean;
  form?: 'A' | 'B' | 'C' | 'D' | 'unknown';
  warnings: string[];
}

export function quarantineDir(base?: string): string {
  const dir = join(base ?? join(tmpdir(), 'advent-agent'), `quarantine-${randomBytes(6).toString('hex')}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function toProblem(e: unknown): GateProblem {
  if (e instanceof IntakeRejected) return { code: e.code, message: e.message, path: e.path, severity: 'error' };
  return { code: 'intake_error', message: (e as Error).message ?? String(e), severity: 'error' };
}

export async function runGate(input: GateInput, opts: GateOptions = {}): Promise<GateResult> {
  const root = quarantineDir(opts.quarantineRoot);
  const limits = opts.limits ?? {};
  let unpacked: UnpackedFile[];
  const warnings: string[] = [];
  try {
    if (input.type === 'zip') {
      if (!existsSync(input.file)) throw new IntakeRejected('not_found', `${input.file} does not exist.`);
      const r = await extractZipSafely(input.file, root, limits);
      unpacked = r.files; warnings.push(...r.warnings);
    } else if (input.type === 'folder') {
      if (!existsSync(input.path) || !lstatSync(input.path).isDirectory()) throw new IntakeRejected('not_found', `${input.path} is not a folder.`);
      const r = copyFolderSafely(input.path, root, limits);
      unpacked = r.files; warnings.push(...r.warnings);
    } else if (input.type === 'file') {
      if (!existsSync(input.file)) throw new IntakeRejected('not_found', `${input.file} does not exist.`);
      const ext = extname(input.file).toLowerCase();
      if (ext === '.zip') {
        const r = await extractZipSafely(input.file, root, limits);
        unpacked = r.files; warnings.push(...r.warnings);
      } else {
        const name = input.name ?? input.file.split(/[\\/]/).pop()!;
        const r = writeFilesSafely([{ name, data: readFileSync(input.file) }], root, limits);
        unpacked = r.files; warnings.push(...r.warnings);
      }
    } else if (input.type === 'files') {
      const zips = input.entries.filter((e) => e.name.toLowerCase().endsWith('.zip'));
      if (zips.length === 1 && input.entries.length === 1) {
        const tmpZip = join(root, '..', `upload-${randomBytes(4).toString('hex')}.zip`);
        writeFileSync(tmpZip, zips[0]!.data);
        try {
          const r = await extractZipSafely(tmpZip, root, limits);
          unpacked = r.files; warnings.push(...r.warnings);
        } finally {
          rmSync(tmpZip, { force: true });
        }
      } else {
        const r = writeFilesSafely(input.entries, root, limits);
        unpacked = r.files; warnings.push(...r.warnings);
      }
    } else {
      const r = writeFilesSafely([{ name: 'gift.md', data: Buffer.from(input.text, 'utf8') }], root, limits);
      unpacked = r.files;
    }
  } catch (e) {
    if (!opts.keepQuarantine) clearFolder(root);
    return { ok: false, problems: [toProblem(e)], needsDay: false, warnings };
  }

  const built = buildManifest(root, unpacked, { day: opts.day, pastedTitle: input.type === 'text' ? input.title : undefined });
  if (built.needsDay) {
    return { ok: false, problems: built.problems, needsDay: true, form: built.form, root, unpacked, warnings, files: unpacked.length };
  }
  if (!built.manifest) {
    if (!opts.keepQuarantine) clearFolder(root);
    return { ok: false, problems: built.problems, needsDay: false, form: built.form, warnings, files: unpacked.length };
  }
  const manifest = built.manifest;
  if (opts.day && manifest.day !== opts.day) {
    built.problems.push({ code: 'day_mismatch', message: `The manifest says day ${manifest.day} but the submission is for door ${opts.day}.`, severity: 'error' });
  }

  const checks = checkManifest(root, unpacked, manifest, { allowedNetwork: opts.allowedNetwork });
  const problems = [...built.problems, ...checks.problems];

  // Secret scan over every file plus the manifest text.
  const hits: SecretHit[] = [];
  const extra = { apiToken: opts.apiToken, keychainValues: opts.keychainValues };
  for (const f of unpacked) {
    const full = join(root, ...f.path.split('/'));
    const buf = readFileSync(full);
    const isText = TEXT_EXTENSIONS.has(extname(f.path).toLowerCase());
    const fileHits = isText ? scanText(buf.toString('utf8'), extra) : scanBinary(buf, extra);
    for (const h of fileHits) hits.push({ ...h, preview: `${f.path}:${h.line} ${h.preview}` });
  }
  for (const h of scanText([manifest.title, manifest.subtitle ?? '', manifest.note ?? '', manifest.signature ?? '', manifest.followUp?.offer ?? '', manifest.followUp?.prompt ?? ''].join('\n'), extra)) hits.push({ ...h, preview: `manifest ${h.preview}` });
  for (const h of hits) problems.push({ code: `secret_${h.kind}`, message: `Possible secret or private path (${h.kind}) in ${h.preview}. Remove it and resubmit.`, severity: 'error' });

  const kind = manifestPrimaryKind(manifest);
  let renderResult: RenderResult | undefined;
  const hasErrors = problems.some((p) => p.severity === 'error');
  if (opts.render !== false && !hasErrors && (kind === 'interactive-html' || (manifest.primary && mimeFor(manifest.primary) === 'text/html'))) {
    renderResult = await renderCheck(root, { primaryPath: manifest.primary! });
    if (renderResult.status === 'failed') {
      for (const n of renderResult.notes) problems.push({ code: 'render', message: n, severity: n.startsWith('Blocked request') ? 'warning' : 'error' });
    } else if (renderResult.notes.length) {
      for (const n of renderResult.notes) problems.push({ code: 'render_note', message: n, severity: 'warning' });
    }
  }

  const ok = !problems.some((p) => p.severity === 'error');
  if (!ok && !opts.keepQuarantine) clearFolder(root);
  return {
    ok,
    problems,
    kind,
    files: unpacked.length,
    render: renderResult?.status ?? 'skipped',
    manifest,
    root: ok ? root : undefined,
    unpacked,
    renderResult,
    media: checks.media,
    secretHits: hits,
    needsDay: false,
    form: built.form,
    warnings,
  };
}

export interface SealOptions {
  attempt: number;
  mode: ConnectionMode;
  adapter?: string;
  networkConsent?: string[];
}

/** Copy the quarantine into the gift folder, hash every file, write the sealed manifest. The quarantine is removed. */
export function sealGift(result: GateResult, giftDir: string, opts: SealOptions): SealedGift {
  if (!result.ok || !result.manifest || !result.root || !result.unpacked) throw new Error('Cannot seal a gift that did not pass the gate.');
  if (existsSync(giftDir)) rmSync(giftDir, { recursive: true, force: true });
  mkdirSync(giftDir, { recursive: true });
  const files: SealedFile[] = [];
  for (const f of result.unpacked) {
    const src = join(result.root, ...f.path.split('/'));
    const dst = join(giftDir, ...f.path.split('/'));
    mkdirSync(dirname(dst), { recursive: true });
    copyFileSync(src, dst);
    const data = readFileSync(dst);
    files.push({ path: f.path, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex'), mime: mimeFor(f.path), downloadOnly: f.downloadOnly });
  }
  let thumbnail: string | undefined;
  if (result.renderResult?.screenshot) {
    const thumbDir = join(giftDir, '.advent');
    mkdirSync(thumbDir, { recursive: true });
    writeFileSync(join(thumbDir, 'thumbnail.png'), result.renderResult.screenshot);
    thumbnail = '.advent/thumbnail.png';
  }
  const sealed: SealedGift = {
    manifest: result.manifest,
    kind: result.kind as SealedGift['kind'],
    files,
    sealedAt: new Date().toISOString(),
    attempt: opts.attempt,
    mode: opts.mode,
    adapter: opts.adapter,
    verification: {
      render: result.renderResult?.status ?? 'skipped',
      renderNotes: result.renderResult?.notes ?? [],
      media: result.media ?? 'skipped',
      secretScan: 'clean',
      warnings: [...result.warnings, ...result.problems.filter((p) => p.severity === 'warning').map((p) => p.message)],
    },
    thumbnail,
    networkConsent: opts.networkConsent ?? [],
  };
  mkdirSync(join(giftDir, '.advent'), { recursive: true });
  writeFileSync(join(giftDir, '.advent', 'manifest.sealed.json'), JSON.stringify(sealed, null, 2));
  clearFolder(result.root);
  return sealed;
}

export function readSealedGift(giftDir: string): SealedGift | undefined {
  const file = join(giftDir, '.advent', 'manifest.sealed.json');
  if (!existsSync(file)) return undefined;
  return JSON.parse(readFileSync(file, 'utf8')) as SealedGift;
}

/** Spoiler-free report for the UI; the full report goes to the agent. */
export function reportForAgent(result: GateResult): GateReport {
  return { ok: result.ok, problems: result.problems, kind: result.kind, files: result.files, render: result.render };
}
