/** Generates schema/gift.schema.json from the zod manifest schema (AGENT_CONNECTIONS §5). */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { GiftManifestSchema } from '../src/shared/gift.js';

export function buildGiftJsonSchema(): Record<string, unknown> {
  const json = z.toJSONSchema(GiftManifestSchema, { target: 'draft-2020-12', io: 'input' }) as Record<string, unknown>;
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://raw.githubusercontent.com/suchipizza/Advent-Agent/main/schema/gift.schema.json',
    title: 'Advent Agent gift manifest (gift.json)',
    description:
      'Manifest of a gift package submitted to an Advent Agent calendar. See the gift-director skill. The agent never purchases or books anything; realWorld entries are proposals.',
    ...json,
  };
}

const check = process.argv.includes('--check');
const out = resolve(process.cwd(), 'schema/gift.schema.json');
const text = JSON.stringify(buildGiftJsonSchema(), null, 2) + '\n';
if (check) {
  const current = existsSync(out) ? readFileSync(out, 'utf8') : '';
  if (current !== text) {
    console.error('schema/gift.schema.json is stale. Run: npm run schema:gen');
    process.exit(1);
  }
} else {
  mkdirSync(resolve(process.cwd(), 'schema'), { recursive: true });
  writeFileSync(out, text);
  console.log('wrote', out);
}
