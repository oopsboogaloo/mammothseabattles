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
  // Which build this is, for the game log: the commit on GitHub, else a local build.
  define: { __BUILD__: JSON.stringify(process.env['GITHUB_SHA']?.slice(0, 7) ?? 'local') },
  // The AI runs in a module worker (src/ai-worker.ts), which needs ES output to share code with the page.
  worker: { format: 'es' },
  build: {
    chunkSizeWarningLimit: 1200,
    // Two pages: the layout A mock-up (index.html) and the hot-seat prototype on the real rules engine (play.html).
    rollupOptions: { input: { mockup: fileURLToPath(new URL('index.html', import.meta.url)), play: fileURLToPath(new URL('play.html', import.meta.url)) } },
  },
});
