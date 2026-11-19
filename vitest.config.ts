import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const pkg = (name: string) => fileURLToPath(new URL(`./packages/${name}/src/index.ts`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@msb/engine': pkg('engine'),
      '@msb/hex': pkg('hex'),
      '@msb/msb-rules': pkg('msb-rules'),
      '@msb/msb-data': pkg('msb-data'),
    },
  },
  test: {
    include: ['packages/*/test/**/*.test.ts', 'test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.ts'],
      // The client is UI, covered by its own checks (web-spec §6), not by the rules coverage gate.
      exclude: ['packages/client/**'],
      // NFR-4: total coverage of engine, hex and rules. The build fails below 100%.
      thresholds: { lines: 100, branches: 100, functions: 100, statements: 100 },
    },
  },
});
