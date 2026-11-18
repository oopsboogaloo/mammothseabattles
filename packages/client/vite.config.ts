import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const pkg = (name: string) => fileURLToPath(new URL(`../${name}/src/index.ts`, import.meta.url));

export default defineConfig({
  // Relative base, so the built mock-up works from any folder (a web host, a USB stick, GitHub Pages).
  base: './',
  resolve: {
    alias: {
      '@msb/engine': pkg('engine'),
      '@msb/hex': pkg('hex'),
      '@msb/msb-rules': pkg('msb-rules'),
    },
  },
  server: { host: true },
  build: { chunkSizeWarningLimit: 1200 },
});
