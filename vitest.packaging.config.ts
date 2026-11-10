import './vitest.polyfill';
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['test/packaging/**/*.test.ts'], testTimeout: 600_000, hookTimeout: 600_000 } });
