#!/usr/bin/env node
import { main } from '../dist/cli/main.js';

main().then((code) => {
  if (code !== 0) process.exitCode = code;
}).catch((e) => {
  console.error(e?.message ?? e);
  process.exitCode = 1;
});
