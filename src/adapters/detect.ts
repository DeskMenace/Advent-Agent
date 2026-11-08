/** Find a CLI on PATH and read its version. shell:false everywhere. */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import type { Detection } from './types.js';

export function whichSync(binary: string): string | undefined {
  const exts = process.platform === 'win32' ? ['.cmd', '.exe', '.bat', ''] : [''];
  for (const dir of (process.env.PATH ?? '').split(delimiter)) {
    if (!dir) continue;
    for (const ext of exts) {
      const p = join(dir, binary + ext);
      if (existsSync(p)) return p;
    }
  }
  return undefined;
}

export function detectCli(binary: string, versionArgs = ['--version']): Detection {
  const path = whichSync(binary);
  if (!path) return { installed: false };
  const r = spawnSync(path, versionArgs, { encoding: 'utf8', shell: false, timeout: 15_000, env: process.env });
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`.trim();
  const version = out.match(/\d+\.\d+(?:\.\d+)?(?:[-+][\w.]+)?/)?.[0];
  return { installed: true, path, version: version ?? (out.split('\n')[0] || undefined) };
}

/** Generic usage parser: scans JSON lines for usage objects and cost fields. */
export function parseUsageGeneric(output: string): { tokens?: number; usd?: number } | undefined {
  let tokens: number | undefined;
  let usd: number | undefined;
  for (const line of output.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{')) continue;
    let obj: unknown;
    try { obj = JSON.parse(trimmed); } catch { continue; }
    const found = findUsage(obj);
    if (found.tokens !== undefined) tokens = found.tokens;
    if (found.usd !== undefined) usd = found.usd;
  }
  if (tokens === undefined && usd === undefined) return undefined;
  return { tokens, usd };
}

function findUsage(obj: unknown, depth = 0): { tokens?: number; usd?: number } {
  if (!obj || typeof obj !== 'object' || depth > 4) return {};
  const o = obj as Record<string, unknown>;
  let tokens: number | undefined;
  let usd: number | undefined;
  if (typeof o.total_cost_usd === 'number') usd = o.total_cost_usd;
  if (typeof o.cost_usd === 'number') usd = o.cost_usd;
  const usage = (o.usage ?? o.token_usage ?? o.stats) as Record<string, unknown> | undefined;
  if (usage && typeof usage === 'object') {
    const num = (k: string) => (typeof usage[k] === 'number' ? (usage[k] as number) : 0);
    const inTok = num('input_tokens') + num('cache_read_input_tokens') + num('cache_creation_input_tokens') + num('prompt_tokens') + num('promptTokenCount');
    const outTok = num('output_tokens') + num('completion_tokens') + num('candidatesTokenCount');
    const total = num('total_tokens') || num('totalTokenCount') || inTok + outTok;
    if (total > 0) tokens = total;
  }
  for (const v of Object.values(o)) {
    if (v && typeof v === 'object') {
      const inner = findUsage(v, depth + 1);
      if (inner.tokens !== undefined) tokens = inner.tokens;
      if (inner.usd !== undefined) usd = inner.usd;
    }
  }
  return { tokens, usd };
}
