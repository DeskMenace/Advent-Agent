/** Secret scanner (ARCHITECTURE §7 step 5). Conservative patterns; known false positives are tested. */
import { homedir } from 'node:os';

export interface SecretHit {
  kind: string;
  line: number;
  preview: string;
}

const PATTERNS: Array<{ kind: string; re: RegExp }> = [
  { kind: 'anthropic_key', re: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/ },
  { kind: 'openai_key', re: /\bsk-(?:proj-|live-|svcacct-)?[A-Za-z0-9_-]{24,}\b/ },
  { kind: 'google_api_key', re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { kind: 'aws_access_key', re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { kind: 'github_token', re: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b/ },
  { kind: 'github_pat', re: /\bgithub_pat_[A-Za-z0-9_]{60,}\b/ },
  { kind: 'slack_token', re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { kind: 'stripe_key', re: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b/ },
  { kind: 'private_key', re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY(?: BLOCK)?-----/ },
  { kind: 'jwt', re: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/ },
  { kind: 'bearer_header', re: /\bAuthorization:\s*Bearer\s+[A-Za-z0-9._~+/=-]{16,}/i },
  { kind: 'env_assignment', re: /^\s*(?:export\s+)?[A-Z][A-Z0-9_]{2,}_(?:KEY|TOKEN|SECRET|PASSWORD|PASSWD|API_KEY|ACCESS_KEY)\s*=\s*["']?[^\s"']{8,}["']?\s*$/m },
  { kind: 'json_secret', re: /"(?:api[_-]?key|apikey|secret|password|access[_-]?token|auth[_-]?token|private[_-]?key)"\s*:\s*"[^"]{8,}"/i },
  { kind: 'url_credentials', re: /\b[a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:[^\s/@]+@[^\s/]+/i },
];

/** Text files we scan line by line; binary files are only checked for the exact api.token value. */
export function scanText(text: string, extra: { apiToken?: string; keychainValues?: string[] } = {}): SecretHit[] {
  const hits: SecretHit[] = [];
  const lines = text.split(/\r?\n/);
  const exact = [extra.apiToken, ...(extra.keychainValues ?? [])].filter((v): v is string => Boolean(v && v.length >= 16));
  const home = homedir().replace(/\\/g, '/');
  const homeRe = new RegExp(`(?:${escapeRe(home)}|/Users/[A-Za-z0-9._-]+/|/home/[A-Za-z0-9._-]+/|[A-Za-z]:[\\\\/]Users[\\\\/][A-Za-z0-9._ -]+[\\\\/])`);

  lines.forEach((line, idx) => {
    for (const v of exact) {
      if (line.includes(v)) hits.push({ kind: 'calendar_token', line: idx + 1, preview: redact(line) });
    }
    for (const { kind, re } of PATTERNS) {
      if (re.test(line)) hits.push({ kind, line: idx + 1, preview: redact(line) });
    }
    if (homeRe.test(line)) hits.push({ kind: 'home_path', line: idx + 1, preview: redact(line) });
  });
  // Multi-line env-style blocks are caught per line above; the private-key pattern is per line as well.
  return dedupe(hits);
}

export function scanBinary(buf: Buffer, extra: { apiToken?: string; keychainValues?: string[] } = {}): SecretHit[] {
  const hits: SecretHit[] = [];
  const exact = [extra.apiToken, ...(extra.keychainValues ?? [])].filter((v): v is string => Boolean(v && v.length >= 16));
  const latin = buf.toString('latin1');
  for (const v of exact) if (latin.includes(v)) hits.push({ kind: 'calendar_token', line: 0, preview: '[binary]' });
  return hits;
}

function redact(line: string): string {
  return line.length > 80 ? line.slice(0, 40) + '…' + line.slice(-10) : line;
}

function dedupe(hits: SecretHit[]): SecretHit[] {
  const seen = new Set<string>();
  return hits.filter((h) => {
    const k = `${h.kind}:${h.line}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const TEXT_EXTENSIONS = new Set(['.html', '.htm', '.css', '.js', '.mjs', '.json', '.txt', '.md', '.markdown', '.csv', '.xml', '.svg', '.ics', '.gpx', '.kml', '.yaml', '.yml', '.toml', '.env', '.ini', '.cfg', '.conf', '.sh', '.py', '.ts', '.tsx', '.jsx']);
