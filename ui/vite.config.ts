import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { resolve } from 'node:path';

export default defineConfig({
  root: resolve(import.meta.dirname),
  base: '/',
  plugins: [preact()],
  build: {
    outDir: resolve(import.meta.dirname, '..', 'dist', 'ui'),
    emptyOutDir: true,
    sourcemap: false,
    target: 'es2022',
  },
  server: { port: 5173, strictPort: true },
});
