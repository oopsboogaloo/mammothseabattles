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
      '@msb/msb-data': pkg('msb-data'),
      '@msb/msb-ai': pkg('msb-ai'),
    },
  },
  server: { host: true },
  build: {
    chunkSizeWarningLimit: 1200,
    // Two pages: the layout A mock-up (index.html) and the hot-seat prototype on the real rules engine (play.html).
    rollupOptions: { input: { mockup: fileURLToPath(new URL('index.html', import.meta.url)), play: fileURLToPath(new URL('play.html', import.meta.url)) } },
  },
});
