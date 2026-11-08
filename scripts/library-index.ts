/**
 * Writes gift-library/INDEX.json and gift-library/INDEX.md from gift-library/ideas/*.md.
 * `--check` exits 1 when either file is stale (CI; GIFT_WORKSHOP.md §4). Output is deterministic.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildIndex, loadIdeas, renderIndexJson, renderIndexMarkdown } from '../src/library/index.js';

const root = resolve(process.cwd(), 'gift-library');
const check = process.argv.includes('--check');

const normalize = (s: string): string => s.replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').replace(/\n+$/, '') + '\n';

let ideas;
try {
  ideas = loadIdeas(root);
} catch (err) {
  console.error(`library-index: ${(err as Error).message}`);
  process.exit(1);
}
const index = buildIndex(ideas);
const outputs: Array<[string, string]> = [
  [resolve(root, 'INDEX.json'), renderIndexJson(index)],
  [resolve(root, 'INDEX.md'), renderIndexMarkdown(index)],
];

if (check) {
  const stale = outputs.filter(([path, text]) => !existsSync(path) || normalize(readFileSync(path, 'utf8')) !== normalize(text));
  if (stale.length > 0) {
    console.error(`library-index: stale: ${stale.map(([p]) => p.replace(process.cwd() + '/', '')).join(', ')}. Run: npm run library:index`);
    process.exit(1);
  }
  console.log(`library-index: INDEX.json and INDEX.md are up to date (${index.count} ideas).`);
} else {
  for (const [path, text] of outputs) writeFileSync(path, text);
  console.log(`library-index: wrote INDEX.json and INDEX.md (${index.count} ideas).`);
}
