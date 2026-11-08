/**
 * Minimal YAML-ish frontmatter reader/writer for the idea library (GIFT_WORKSHOP.md §4).
 *
 * Supported on read: scalars, single/double quoted strings, inline arrays `[a, b, "c"]`,
 * block lists (`key:` followed by `- item` lines), blank lines and `# comments` (whole line
 * or after a value, e.g. `group: A  # comment`). Everything is kept as strings; zod does the
 * typing. No nesting beyond one level of list. No yaml dependency.
 */

export type FrontmatterValue = string | string[];
export interface ParsedDocument {
  data: Record<string, FrontmatterValue>;
  body: string;
}

export class FrontmatterError extends Error {
  constructor(message: string, public readonly line?: number) {
    super(line === undefined ? message : `${message} (line ${line})`);
    this.name = 'FrontmatterError';
  }
}

/** Splits `---\n...\n---\n` from the body. Throws when the fence is missing. */
export function splitFrontmatter(text: string): { yaml: string; body: string } {
  const normalized = text.replace(/\r\n/g, '\n');
  if (!normalized.startsWith('---\n')) throw new FrontmatterError('file must start with a "---" frontmatter fence');
  const end = normalized.indexOf('\n---', 4);
  if (end === -1) throw new FrontmatterError('closing "---" frontmatter fence not found');
  const after = normalized.indexOf('\n', end + 1);
  const closing = normalized.slice(end + 1, after === -1 ? undefined : after);
  if (closing.trim() !== '---') throw new FrontmatterError('closing "---" frontmatter fence not found');
  return { yaml: normalized.slice(4, end + 1), body: after === -1 ? '' : normalized.slice(after + 1) };
}

/** Removes a trailing ` # comment` that is outside quotes/brackets. */
function stripComment(raw: string): string {
  let quote: string | null = null;
  let depth = 0;
  let atItemStart = true; // a quote only opens a string at the start of a value or array item
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (quote) {
      if (ch === '\\' && quote === '"') i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if ((ch === '"' || ch === "'") && atItemStart) quote = ch;
    else if (ch === '[') depth++;
    else if (ch === ']') depth--;
    else if (ch === '#' && depth === 0 && (i === 0 || /\s/.test(raw[i - 1] ?? ''))) return raw.slice(0, i).trimEnd();
    if (!/\s/.test(ch ?? '')) atItemStart = ch === '[' || ch === ',';
  }
  return raw.trimEnd();
}

function unquote(raw: string, line: number): string {
  const s = raw.trim();
  if (s.startsWith('"')) {
    if (!s.endsWith('"') || s.length < 2) throw new FrontmatterError('unterminated double-quoted string', line);
    return s
      .slice(1, -1)
      .replace(/\\(["\\nt])/g, (_, c: string) => (c === 'n' ? '\n' : c === 't' ? '\t' : c));
  }
  if (s.startsWith("'")) {
    if (!s.endsWith("'") || s.length < 2) throw new FrontmatterError('unterminated single-quoted string', line);
    return s.slice(1, -1).replace(/''/g, "'");
  }
  return s;
}

/** Splits `[a, "b, c", d]` into items, respecting quotes. */
function parseInlineArray(raw: string, line: number): string[] {
  const inner = raw.trim().slice(1, -1).trim();
  if (inner === '') return [];
  const items: string[] = [];
  let current = '';
  let quote: string | null = null;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i] as string;
    if (quote) {
      current += ch;
      if (ch === '\\' && quote === '"') current += inner[++i] ?? '';
      else if (ch === quote) quote = null;
      continue;
    }
    if ((ch === '"' || ch === "'") && current.trim() === '') {
      quote = ch;
      current += ch;
    } else if (ch === ',') {
      items.push(unquote(current, line));
      current = '';
    } else current += ch;
  }
  if (quote) throw new FrontmatterError('unterminated quoted string in inline array', line);
  if (current.trim() !== '' || items.length > 0) items.push(unquote(current, line));
  return items;
}

export function parseFrontmatterBlock(yaml: string): Record<string, FrontmatterValue> {
  const data: Record<string, FrontmatterValue> = {};
  const lines = yaml.split('\n');
  let pendingListKey: string | null = null;
  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const line = lines[i] ?? '';
    if (line.trim() === '' || line.trim().startsWith('#')) continue;
    const listItem = /^\s*-\s+(.*)$/.exec(line) ?? /^\s*-$/.exec(line);
    if (listItem && pendingListKey) {
      const existing = data[pendingListKey];
      const arr = Array.isArray(existing) ? existing : [];
      arr.push(unquote(stripComment(listItem[1] ?? ''), lineNo));
      data[pendingListKey] = arr;
      continue;
    }
    const kv = /^([A-Za-z_][A-Za-z0-9_-]*):(?:\s+(.*))?$/.exec(line);
    if (!kv) throw new FrontmatterError(`cannot parse line: ${JSON.stringify(line)}`, lineNo);
    const key = kv[1] as string;
    if (key in data) throw new FrontmatterError(`duplicate key "${key}"`, lineNo);
    const value = stripComment(kv[2] ?? '');
    if (value === '') {
      data[key] = [];
      pendingListKey = key;
      continue;
    }
    pendingListKey = null;
    if (value.startsWith('[')) {
      if (!value.endsWith(']')) throw new FrontmatterError('unterminated inline array', lineNo);
      data[key] = parseInlineArray(value, lineNo);
    } else data[key] = unquote(value, lineNo);
  }
  return data;
}

export function parseFrontmatter(text: string): ParsedDocument {
  const { yaml, body } = splitFrontmatter(text);
  return { data: parseFrontmatterBlock(yaml), body };
}

const PLAIN_SCALAR = /^[A-Za-z0-9][A-Za-z0-9 _.,;!?()/'&+%-]*$/;

/** Quotes a string only when the simple parser (or YAML) would otherwise misread it. */
export function formatScalar(value: string): string {
  const needsQuotes =
    value === '' ||
    !PLAIN_SCALAR.test(value) ||
    value !== value.trim() ||
    /: |#|^[-[\]{}>|*&!%@`"']/.test(value) ||
    /^(true|false|null|yes|no|~)$/i.test(value) ||
    /^-?\d+(\.\d+)?$/.test(value);
  if (!needsQuotes) return value;
  return '"' + value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"';
}

/** Inline array items additionally need quotes around commas and brackets. */
function formatArrayItem(value: string): string {
  return /[,[\]]/.test(value) && !/^["']/.test(formatScalar(value)) ? '"' + value.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"' : formatScalar(value);
}

export interface StringifyOptions {
  /** Keys whose arrays are written as block lists instead of inline `[a, b]`. */
  blockListKeys?: string[];
  /** Trailing comments per key, e.g. { group: 'A–H as in the bank' }. */
  comments?: Record<string, string>;
}

export function stringifyFrontmatter(data: Record<string, FrontmatterValue>, body: string, options: StringifyOptions = {}): string {
  const block = new Set(options.blockListKeys ?? []);
  const out: string[] = ['---'];
  for (const [key, value] of Object.entries(data)) {
    const comment = options.comments?.[key] ? `  # ${options.comments[key]}` : '';
    if (Array.isArray(value)) {
      if (block.has(key) && value.length > 0) {
        out.push(`${key}:${comment}`);
        for (const item of value) out.push(`  - ${formatScalar(item)}`);
      } else out.push(`${key}: [${value.map(formatArrayItem).join(', ')}]${comment}`);
    } else out.push(`${key}: ${formatScalar(value)}${comment}`);
  }
  out.push('---');
  const trimmedBody = body.replace(/\s+$/, '');
  return out.join('\n') + '\n' + (trimmedBody ? trimmedBody + '\n' : '');
}
