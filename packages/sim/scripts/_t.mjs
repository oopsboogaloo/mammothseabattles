import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
const pkg = (n) => fileURLToPath(new URL(`../../${n}/src/index.ts`, import.meta.url));
const server = await createServer({ configFile: false, logLevel: 'error', appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false },
  resolve: { alias: { '@msb/engine': pkg('engine'), '@msb/hex': pkg('hex'), '@msb/msb-rules': pkg('msb-rules'), '@msb/msb-data': pkg('msb-data'), '@msb/msb-ai': pkg('msb-ai') } } });
const ai = await server.ssrLoadModule(pkg('msb-ai'));
const R = await server.ssrLoadModule(pkg('msb-rules'));
const D = await server.ssrLoadModule(pkg('msb-data'));
const config = R.makeConfig({});
const game = R.createGame(config);
for (const seed of [1, 2]) {
  let s = R.newGame(D.prototypeSetup([{ name: 'a' }, { name: 'b' }], seed));
  let turns = 0, discardTurns = 0, discards = 0, placed = 0, hands = [];
  while (s.phase !== 'over' && s.turn <= 40) {
    if (s.phase === 'resolving') { const p = s.pending.player; s = game.apply(s, p, ai.answerDecision(s, config)).state; continue; }
    const p = ['P1','P2'].find((x) => !s.ready.includes(x));
    const sh = s.ships[p + '-ship']; if (sh.status === 'afloat') hands.push(sh.hand.length);
    const acts = ai.programmingTurn(s, p, config, { beam: 2 });
    const d = acts.filter((a) => a.type === 'discard').length; turns++; if (d) discardTurns++; discards += d; placed += acts.filter((a) => a.type === 'place').length;
    for (const a of acts) s = game.apply(s, p, a).state;
  }
  console.log({ seed, turns, discardTurns, discards, placedPerTurn: (placed / turns).toFixed(1), meanHand: (hands.reduce((a, b) => a + b, 0) / hands.length).toFixed(1), maxHand: Math.max(...hands) });
}
await server.close();
