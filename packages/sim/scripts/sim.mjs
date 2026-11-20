// The simulator from the command line: plays AI-only games and prints a Markdown table (engineering design §10).
// Usage: npm run sim -- [--players 2] [--games 20] [--seed 1] [--beam 2] [--levels hard,normal] [--max-turns 60] [--variants base,safe-edge] [--out file.md]
// Variants (rule changes to compare, all on the same deals):
//   base, safe-edge, target-2, target-4, no-points-of-sail
import { createServer } from 'vite';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const VARIANTS = {
  base: {},
  'safe-edge': { safeEdge: true },
  'target-2': { treasureTarget: 2 },
  'target-4': { treasureTarget: 4 },
  'no-points-of-sail': { pointsOfSail: false },
};

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, a, i, all) => (a.startsWith('--') ? [...pairs, [a.slice(2), all[i + 1]]] : pairs), []),
);
const num = (k, d) => (args[k] === undefined ? d : Number(args[k]));
const names = (args.variants ?? 'base').split(',');
for (const n of names) if (!(n in VARIANTS)) throw new Error(`Unknown variant "${n}". Known: ${Object.keys(VARIANTS).join(', ')}`);

const root = fileURLToPath(new URL('../../..', import.meta.url));
const pkg = (name) => fileURLToPath(new URL(`../../${name}/src/index.ts`, import.meta.url));
const server = await createServer({
  root,
  configFile: false,
  logLevel: 'error',
  appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false },
  resolve: {
    alias: {
      '@msb/engine': pkg('engine'),
      '@msb/hex': pkg('hex'),
      '@msb/msb-rules': pkg('msb-rules'),
      '@msb/msb-data': pkg('msb-data'),
      '@msb/msb-ai': pkg('msb-ai'),
    },
  },
});
const { runExperiment, formatTable } = await server.ssrLoadModule(pkg('sim'));
const players = num('players', 2);
const games = num('games', 20);
const t0 = Date.now();
let done = 0;
const summaries = runExperiment(
  names.map((name) => ({ name, rules: VARIANTS[name] })),
  {
    players,
    games,
    firstSeed: num('seed', 1),
    maxTurns: num('max-turns', 60),
    beam: num('beam', 2),
    ...(args.levels ? { levels: args.levels.split(',') } : {}),
    onGame: (variant, r) => {
      done++;
      process.stderr.write(`\r${variant}: game ${done} of ${games * names.length} (${Math.round((Date.now() - t0) / 1000)} s)   `);
    },
  },
);
process.stderr.write('\n');
const title = `${players === 1 ? 'Solo Challenge' : `${players} players`}, ${games} games per variant, AI beam ${num('beam', 2)}, seeds ${num('seed', 1)}–${num('seed', 1) + games - 1}`;
const md = `### ${title}\n\n${formatTable(summaries)}\n`;
console.log(md);
if (args.out) writeFileSync(args.out, md);
await server.close();
