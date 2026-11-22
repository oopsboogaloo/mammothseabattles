// Re-check a game log saved from the game (Menu → Save game log) with the current code: rebuilds the game from its replay data,
// re-runs every check, and writes a fresh trace (engineering design §11).
// Usage: npm run replay-log -- path/to/msb-game-log.txt [--out trace.txt]
import { createServer } from 'vite';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const [file, ...rest] = process.argv.slice(2);
if (!file) throw new Error('Usage: npm run replay-log -- path/to/msb-game-log.txt [--out trace.txt]');
const out = rest[rest.indexOf('--out') + 1];
const text = readFileSync(file, 'utf8');
const marker = text.indexOf('=== REPLAY DATA');
if (marker < 0) throw new Error('No "=== REPLAY DATA" section: is this a game log from the Menu?');
const save = JSON.parse(text.slice(text.indexOf('\n', marker) + 1).trim());

const pkg = (name) => fileURLToPath(new URL(`../../${name}/src/index.ts`, import.meta.url));
const server = await createServer({
  configFile: false,
  logLevel: 'error',
  appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false },
  resolve: { alias: { '@msb/engine': pkg('engine'), '@msb/hex': pkg('hex'), '@msb/msb-rules': pkg('msb-rules') } },
});
const { auditGame, makeConfig } = await server.ssrLoadModule(pkg('msb-rules'));
// Saves from before rules v0.152 don't record their rules: crew of 3, wind drift on.
const rules = save.rules ?? { startingCrew: 3, windDrift: true };
const { trace, problems } = auditGame(save.setup, save.log, makeConfig({ safeEdge: save.safeEdge, ...rules }));
console.log(`${save.log.length} actions, seed ${save.setup.seed}, computer players: ${(save.ai ?? []).join(' ') || 'none'}, rules ${JSON.stringify(rules)}`);
console.log(`Problems found now: ${problems.length}`);
for (const p of problems) console.log(`  ${p}`);
console.log(`Notes from the board: ${(save.notes ?? []).length}`);
for (const n of save.notes ?? []) console.log(`  ${n}`);
if (out) {
  writeFileSync(out, trace);
  console.log(`Trace written to ${out}`);
}
await server.close();
