/** Tiny argv parser: `cmd positional --flag value --bool`. */
export interface Parsed {
  command?: string;
  positionals: string[];
  flags: Record<string, string | boolean>;
}

export function parseArgs(argv: string[]): Parsed {
  const out: Parsed = { positionals: [], flags: {} };
  const rest = [...argv];
  if (rest[0] && !rest[0].startsWith('-')) out.command = rest.shift();
  while (rest.length) {
    const a = rest.shift()!;
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq > 0) { out.flags[a.slice(2, eq)] = a.slice(eq + 1); continue; }
      const key = a.slice(2);
      if (rest.length && !rest[0]!.startsWith('-')) out.flags[key] = rest.shift()!;
      else out.flags[key] = true;
    } else if (a.startsWith('-') && a.length === 2) {
      out.flags[a.slice(1)] = rest.length && !rest[0]!.startsWith('-') ? rest.shift()! : true;
    } else {
      out.positionals.push(a);
    }
  }
  return out;
}
