/**
 * The data home: config, profile, seasons, history, ledger, migrations with backup, export/import without secrets.
 */
import { existsSync, readdirSync, rmSync, statSync, createWriteStream, mkdirSync, copyFileSync } from 'node:fs';
import { join, relative, sep, dirname } from 'node:path';
import yazl from 'yazl';
import { ConfigSchema, ProfileSchema, SeasonSchema, HistoryRecordSchema, LedgerEntrySchema, type Config, type Profile, type Season, type HistoryRecord, type LedgerEntry } from '../shared/config.js';
import { appendLine, ensureDir, readJson, readJsonRaw, readLines, readOrCreateSecret, writeJsonAtomic } from './fsutil.js';
import { makeHome, resolveHomeRoot, SECRET_FILE_NAMES, type Home } from './paths.js';
import { DoorStore } from './doors.js';
import { deviceTimeZone, seasonYearFor } from './time.js';
import { extractZipSafely } from '../intake/unpack.js';

export const CURRENT_SCHEMA_VERSION = 1;

export class Store {
  readonly home: Home;

  constructor(root?: string) {
    this.home = makeHome(resolveHomeRoot(root));
    ensureDir(this.home.root);
    this.migrate();
  }

  // ---- secrets -------------------------------------------------------------------------------
  sessionKey(): string {
    return readOrCreateSecret(this.home.sessionKeyFile);
  }
  apiToken(): string {
    return readOrCreateSecret(this.home.apiTokenFile);
  }

  // ---- config / profile ----------------------------------------------------------------------
  config(): Config {
    const existing = readJson(this.home.configFile, ConfigSchema);
    if (existing) return existing;
    const fresh = ConfigSchema.parse({ timeZone: deviceTimeZone() });
    writeJsonAtomic(this.home.configFile, fresh);
    return fresh;
  }
  saveConfig(patch: Partial<Config> | ((c: Config) => Config)): Config {
    const current = this.config();
    const next = ConfigSchema.parse(typeof patch === 'function' ? patch(current) : { ...current, ...patch });
    writeJsonAtomic(this.home.configFile, next);
    return next;
  }
  profile(): Profile {
    return readJson(this.home.profileFile, ProfileSchema) ?? ProfileSchema.parse({});
  }
  saveProfile(profile: Partial<Profile>): Profile {
    const next = ProfileSchema.parse({ ...this.profile(), ...profile });
    writeJsonAtomic(this.home.profileFile, next);
    return next;
  }

  // ---- seasons --------------------------------------------------------------------------------
  seasonYears(): number[] {
    if (!existsSync(this.home.seasonsDir)) return [];
    return readdirSync(this.home.seasonsDir)
      .filter((d) => /^\d{4}$/.test(d) && existsSync(this.home.seasonFile(Number(d))))
      .map(Number)
      .sort((a, b) => a - b);
  }
  season(year: number): Season | undefined {
    return readJson(this.home.seasonFile(year), SeasonSchema);
  }
  /** The season the calendar shows by default: the current season year if it exists, else the latest. */
  currentSeason(now = new Date()): Season | undefined {
    const cfg = this.config();
    const year = seasonYearFor(now, cfg.timeZone);
    return this.season(year) ?? (this.seasonYears().length ? this.season(this.seasonYears().at(-1)!) : undefined);
  }
  createSeason(input: Omit<Season, 'schemaVersion' | 'createdAt'> & { createdAt?: string }): Season {
    if (this.season(input.year)) throw new Error(`Season ${input.year} already exists`);
    const season = SeasonSchema.parse({ ...input, createdAt: input.createdAt ?? new Date().toISOString() });
    writeJsonAtomic(this.home.seasonFile(season.year), season);
    for (let d = 1; d <= 24; d++) ensureDir(this.home.doorDir(season.year, d));
    return season;
  }
  saveSeason(season: Season): void {
    writeJsonAtomic(this.home.seasonFile(season.year), SeasonSchema.parse(season));
  }
  deleteSeason(year: number): void {
    rmSync(this.home.seasonDir(year), { recursive: true, force: true });
  }
  doors(year: number): DoorStore {
    return new DoorStore(this.home, year);
  }

  // ---- history / ledger ---------------------------------------------------------------------
  history(year: number): HistoryRecord[] {
    return readLines(this.home.historyFile(year)).flatMap((l) => {
      const r = HistoryRecordSchema.safeParse(JSON.parse(l));
      return r.success ? [r.data] : [];
    });
  }
  appendHistory(year: number, record: HistoryRecord): void {
    appendLine(this.home.historyFile(year), JSON.stringify(HistoryRecordSchema.parse(record)));
  }
  ledger(year: number): LedgerEntry[] {
    return readLines(this.home.ledgerFile(year)).flatMap((l) => {
      const r = LedgerEntrySchema.safeParse(JSON.parse(l));
      return r.success ? [r.data] : [];
    });
  }
  appendLedger(year: number, entry: LedgerEntry): void {
    appendLine(this.home.ledgerFile(year), JSON.stringify(LedgerEntrySchema.parse(entry)));
  }

  // ---- migrations -----------------------------------------------------------------------------
  private migrate(): void {
    const raw = readJsonRaw(this.home.configFile) as { schemaVersion?: number } | undefined;
    if (!raw) return;
    const version = typeof raw.schemaVersion === 'number' ? raw.schemaVersion : 0;
    if (version >= CURRENT_SCHEMA_VERSION) return;
    this.backup(`pre-migration-v${version}`);
    // v0 → v1: files written before schemaVersion existed get the field; everything else is forward compatible.
    const migrated = { ...raw, schemaVersion: CURRENT_SCHEMA_VERSION };
    writeJsonAtomic(this.home.configFile, ConfigSchema.parse(migrated));
  }

  /** Copy of the home (without secrets or logs) into backups/<stamp>-<label>/. Returns the folder. */
  backup(label = 'backup'): string {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dest = join(this.home.backupsDir, `${stamp}-${label}`);
    for (const file of this.walkExportable()) {
      const target = join(dest, relative(this.home.root, file));
      mkdirSync(dirname(target), { recursive: true });
      copyFileSync(file, target);
    }
    return dest;
  }

  /** Every file that may leave the machine: seasons (states, sealed gifts), config, profile. Never tokens, keys, logs, workspaces, backups, lab. */
  *walkExportable(root = this.home.root): Generator<string> {
    if (!existsSync(root)) return;
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      const full = join(root, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (full === this.home.backupsDir || full === this.home.labDir) continue;
        if (entry.name === 'workspace' || /^workspace\.attempt-\d+$/.test(entry.name) || entry.name === 'quarantine') continue;
        yield* this.walkExportable(full);
      } else if (entry.isFile()) {
        if (SECRET_FILE_NAMES.has(entry.name)) continue;
        if (entry.name.endsWith('.tmp') || entry.name === 'demo.json') continue;
        yield full;
      }
    }
  }

  /** Zip of the exportable files. */
  async exportZip(targetFile: string): Promise<{ files: number }> {
    const zip = new yazl.ZipFile();
    let count = 0;
    for (const file of this.walkExportable()) {
      zip.addFile(file, relative(this.home.root, file).split(sep).join('/'));
      count++;
    }
    zip.end();
    ensureDir(dirname(targetFile));
    await new Promise<void>((resolve, reject) => {
      const out = createWriteStream(targetFile);
      zip.outputStream.pipe(out).on('close', () => resolve()).on('error', reject);
    });
    return { files: count };
  }

  /** Restore a zip produced by exportZip. Existing seasons are backed up first. Secrets in the archive are ignored. */
  async importZip(zipFile: string): Promise<{ files: number }> {
    this.backup('pre-import');
    const result = await extractZipSafely(zipFile, this.home.root, {
      maxFiles: 20_000,
      maxTotalBytes: 2 * 1024 * 1024 * 1024,
      skip: (name) => SECRET_FILE_NAMES.has(name.split('/').pop() ?? '') || name.startsWith('backups/') || name.startsWith('lab/'),
      allowOverwrite: true,
    });
    return { files: result.files.length };
  }

  sizeOnDisk(): number {
    let total = 0;
    for (const f of this.walkExportable()) total += statSync(f).size;
    return total;
  }
}
