import { describe, expect, it } from 'vitest';
import type { PendingDecision, ResolutionContext } from '@msb/engine';
import { Direction, distance, hex, hexKey, neighbor, type Hex } from '@msb/hex';
import {
  DEFAULT_CONFIG,
  KNOCK_LOOSE,
  arrive,
  createGame,
  digUpTreasure,
  dropTreasure,
  makeConfig,
  newGame,
  offerKnockLoose,
  parseHexKey,
  runActions,
  runCurrents,
  spawnTreasure,
  stepShip,
  treasureTarget,
  treasuresInPlay,
  type GameEvent,
  type GameMap,
  type GameState,
  type MapHex,
  type MoveContext,
} from '@msb/msb-rules';
import { CALM_WEATHER, TEST_CARDS } from './fixtures';

const { N, S } = Direction;
const O = hex(0, 0);
const k = hexKey;
const MISS = makeConfig({ damageDie: Array(12).fill({ ship: 0, crew: 0 }) });
const PORT_A = hex(-4, 0);
const PORT_B = hex(4, -4);

function map(overrides: Record<string, MapHex> = {}, spawnPoints: Record<string, string> = { '1': k(hex(2, 2)) }): GameMap {
  const hexes: Record<string, MapHex> = {};
  for (let q = -4; q <= 4; q++) for (let r = -4; r <= 4; r++) if (distance(O, hex(q, r)) <= 4) hexes[k(hex(q, r))] = { terrain: 'sea' };
  return { id: 'test', hexes: { ...hexes, ...overrides }, spawnPoints };
}
function game(m: GameMap = map(), seats = 2): GameState {
  const all = [
    { player: 'A', team: 'red', name: 'A', homePort: PORT_A, heading: N },
    { player: 'B', team: 'blue', name: 'B', homePort: PORT_B, heading: N },
    { player: 'C', team: 'green', name: 'C', homePort: hex(0, 4), heading: N },
    { player: 'D', team: 'gold', name: 'D', homePort: hex(-4, 4), heading: N },
  ];
  const s = newGame({ seed: 9, map: m, seats: all.slice(0, seats), commandCards: TEST_CARDS, weatherCards: CALM_WEATHER });
  return s;
}
const ship = (s: GameState, id: string) => s.ships[`${id}-ship`]!;
function place(s: GameState, id: string, at: Hex, heading: Direction = N): void {
  Object.assign(ship(s, id), { pos: at, heading });
}
function run(s: GameState, fn: (m: MoveContext) => void, answer?: (d: PendingDecision<unknown>) => number, config = MISS) {
  const events: GameEvent[] = [];
  const asked: PendingDecision<unknown>[] = [];
  const ctx: ResolutionContext<GameEvent> = {
    ask: <T,>(d: PendingDecision<T>) => {
      if (d.options.length > 1) asked.push(d as PendingDecision<unknown>);
      return d.options[d.options.length > 1 && answer ? answer(d as PendingDecision<unknown>) : d.defaultIndex] as T;
    },
    emit: (e) => events.push(e),
  };
  fn({ state: s, config, part: 1, ctx });
  return { events, asked };
}

describe('treasure pieces (rules §3.7: rum, diamond, ruby, pearl, gold; all worth the same)', () => {
  it('the pieces come out in turn, and each keeps its identity when picked up, knocked loose, dropped and brought home', () => {
    const points = { '1': k(hex(1, 1)), '2': k(hex(2, 1)), '3': k(hex(1, 2)), '4': k(hex(2, 2)), '5': k(hex(3, 1)), '6': k(hex(0, 2)) };
    const s = game(map({}, points), 4);
    expect(s.treasures.map((t) => s.treasureKinds[t])).toEqual(['gold', 'diamond']);
    for (let i = 0; i < 4; i++) spawnTreasure(s, () => undefined);
    expect(s.treasures.map((t) => s.treasureKinds[t])).toEqual(['gold', 'diamond', 'rum', 'ruby', 'pearl', 'gold']);
    // Pick up the diamond, drop it by sinking, then pick it up and bring it home.
    const at = s.treasures[1]!;
    place(s, 'A', parseHexKey(at));
    const pick = run(s, (m) => arrive(s, ship(s, 'A'), MISS, m.ctx));
    expect(pick.events).toEqual([{ type: 'TreasurePickedUp', rule: '8.2.2', ship: 'A-ship', at, kind: 'diamond' }]);
    expect(ship(s, 'A').cargo).toBe('diamond');
    expect(s.treasureKinds[at]).toBeUndefined();
    const drop = run(s, (m) => dropTreasure(s, ship(s, 'A'), m.ctx));
    expect(drop.events).toEqual([{ type: 'TreasureDropped', rule: '7.8', ship: 'A-ship', at: parseHexKey(at), kind: 'diamond' }]);
    expect(ship(s, 'A').cargo).toBeUndefined();
    expect(s.treasureKinds[at]).toBe('diamond');
    run(s, (m) => arrive(s, ship(s, 'A'), MISS, m.ctx));
    place(s, 'A', PORT_A);
    const home = run(s, (m) => arrive(s, ship(s, 'A'), MISS, m.ctx));
    expect(home.events).toContainEqual({ type: 'TreasureScored', rule: '8.2.4', ship: 'A-ship', team: 'red', score: 1, kind: 'diamond' });
    expect(s.teams['red']!.hold).toEqual(['diamond']);
    expect(createGame(MISS).view(s, 'B')).toMatchObject({ holds: { red: ['diamond'] }, treasureKinds: s.treasureKinds });
  });
});

describe('how many treasures, and the target (rules §8.2.1, §8.2.5)', () => {
  it('treasures in play = half the ships, rounded down; target 3, or 2 with 7–8 ships', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].map(treasuresInPlay)).toEqual([1, 1, 1, 2, 2, 3, 3, 4]);
    expect([2, 6, 7, 8].map((n) => treasureTarget(n, DEFAULT_CONFIG))).toEqual([3, 3, 2, 2]);
  });

  it('the starting treasures are spawned with the treasure map deck', () => {
    const points = { '1': k(hex(1, 1)), '2': k(hex(2, 1)), '3': k(hex(1, 2)) };
    const s = game(map({}, points), 4);
    expect(s.treasures).toHaveLength(2);
    expect(s.treasures.every((t) => Object.values(points).includes(t))).toBe(true);
    expect(s.treasureDeck).toHaveLength(1);
    expect(game(map({}, {})).treasures).toEqual([]);
  });
});

describe('spawning (rules §8.2.1)', () => {
  it('draws again if the spawn point already has treasure; skips if every point has; reshuffles when the deck runs out', () => {
    const points = { '1': k(hex(1, 1)), '2': k(hex(2, 1)) };
    const s = game(map({}, points));
    expect(s.treasures).toHaveLength(1);
    s.treasureDeck = [];
    const { events } = run(s, (m) => spawnTreasure(s, m.ctx.emit));
    expect([...s.treasures].sort()).toEqual(Object.values(points).sort());
    expect(events).toHaveLength(1);
    expect(run(s, (m) => spawnTreasure(s, m.ctx.emit)).events).toEqual([]);
  });

  it('a ship on a sea spawn point claims the treasure at once; on land she must dig it up later', () => {
    const s = game(map({}, { '1': k(O) }));
    s.treasures = [];
    place(s, 'A', O);
    s.treasureDeck = ['1'];
    const { events } = run(s, (m) => spawnTreasure(s, m.ctx.emit));
    expect(events.map((e) => e.type)).toEqual(['TreasureSpawned', 'TreasurePickedUp']);
    expect(ship(s, 'A').carrying).toBe(true);
    expect(s.treasures).toEqual([]);
  });
});

describe('picking up (rules §8.2.2)', () => {
  it('passing through a sea hex picks it up; a ship already carrying one sails through', () => {
    const s = game(map({}, {}));
    s.treasures = [k(neighbor(O, N)), k(neighbor(neighbor(O, N), N))];
    place(s, 'A', O, N);
    run(s, (m) => {
      stepShip(m, ship(s, 'A'), N, 'sail');
      stepShip(m, ship(s, 'A'), N, 'sail');
    });
    expect(ship(s, 'A').carrying).toBe(true);
    expect(s.treasures).toEqual([k(neighbor(neighbor(O, N), N))]);
  });

  it('treasure on land is dug up by a ship next to it at the end of the turn', () => {
    const land = neighbor(O, S);
    const s = game(map({ [k(land)]: { terrain: 'beach' } }, {}));
    s.treasures = [k(land)];
    place(s, 'A', O);
    place(s, 'B', hex(3, -3));
    const { events } = run(s, (m) => digUpTreasure(s, [ship(s, 'B'), ship(s, 'A')], m.ctx));
    expect(events).toEqual([{ type: 'TreasurePickedUp', rule: '8.2.2', ship: 'A-ship', at: k(land), kind: 'gold' }]);
    // Arriving next to it doesn't count, and a sunk or full ship digs nothing.
    s.treasures = [k(land)];
    ship(s, 'A').carrying = true;
    expect(run(s, (m) => digUpTreasure(s, [ship(s, 'A')], m.ctx)).events).toEqual([]);
    run(s, (m) => arrive(s, ship(s, 'A'), MISS, m.ctx));
    expect(s.treasures).toEqual([k(land)]);
  });

  it('a rotor carries a ship onto treasure', () => {
    const [a, b] = [O, neighbor(O, S)];
    const s = game({ ...map({}, {}), rotors: [{ moves: { [k(a)]: k(b), [k(b)]: k(a) }, turn: 3, strength: 1 }] });
    s.treasures = [k(b)];
    place(s, 'A', a);
    run(s, (m) => runCurrents(m, [ship(s, 'A'), ship(s, 'B')]));
    expect(ship(s, 'A').carrying).toBe(true);
  });
});

describe('knocking loose and dropping (rules §8.2.3, §7.8)', () => {
  it('a rammer may knock a carrier’s treasure loose instead of dealing the DD, into a hex next to her without treasure', () => {
    const s = game(map({}, {}));
    place(s, 'A', O, N);
    place(s, 'B', neighbor(O, N));
    ship(s, 'B').carrying = true;
    // B is pushed one hex north first, then the ram is resolved against her there.
    const pushedTo = neighbor(neighbor(O, N), N);
    s.treasures = [k(neighbor(pushedTo, Direction.NE))];
    const { events, asked } = run(s, (m) => stepShip(m, ship(s, 'A'), N, 'row'), () => 1);
    expect(asked[0]).toMatchObject({ kind: KNOCK_LOOSE, player: 'A', defaultIndex: 0 });
    expect(asked[0]!.options).toHaveLength(6); // 'damage' + 5 hexes (one already has treasure)
    expect(events).toContainEqual({ type: 'TreasureKnockedLoose', rule: '8.2.3', ship: 'B-ship', by: 'A-ship', to: asked[0]!.options[1], kind: 'gold' });
    expect(events.some((e) => e.type === 'DamageRolled')).toBe(false);
    expect(ship(s, 'B').carrying).toBe(false);
  });

  it('a cannon hit can knock it loose too; by default the attacker deals the damage', () => {
    const s = game(map({}, {}));
    place(s, 'A', O, N);
    place(s, 'B', hex(2, 0));
    ship(s, 'B').carrying = true;
    ship(s, 'A').program = { action1: TEST_CARDS.find((c) => c.action === 'fire')!.id };
    const { events } = run(s, (m) => runActions(s, [ship(s, 'A'), ship(s, 'B')], 1, MISS, m.ctx));
    expect(events.some((e) => e.type === 'DamageRolled' && e.ship === 'B-ship')).toBe(true);
    expect(ship(s, 'B').carrying).toBe(true);
    const knocked = run(s, (m) => runActions(s, [ship(s, 'A'), ship(s, 'B')], 1, MISS, m.ctx), (d) => (d.kind === KNOCK_LOOSE ? 1 : 0));
    expect(knocked.events.some((e) => e.type === 'TreasureKnockedLoose')).toBe(true);
    expect(knocked.events.some((e) => e.type === 'DamageRolled')).toBe(false);
    expect(run(s, (m) => offerKnockLoose(s, ship(s, 'A'), ship(s, 'B'), m.ctx)).asked).toEqual([]); // no longer carrying
    expect(() => game(map({}, { '1': '9,9' }))).toThrow("isn't on the map");
  });

  it('with no hex free of treasure next to her, there is nothing to choose', () => {
    const s = game(map({}, {}));
    place(s, 'B', O);
    ship(s, 'B').carrying = true;
    s.treasures = ([0, 1, 2, 3, 4, 5] as Direction[]).map((d) => k(neighbor(O, d)));
    expect(run(s, (m) => offerKnockLoose(s, ship(s, 'A'), ship(s, 'B'), m.ctx)).asked).toEqual([]);
  });

  it('a sinking carrier drops her treasure where she sank', () => {
    const s = game(map({ [k(neighbor(O, N))]: { terrain: 'deathReef' } }, {}));
    place(s, 'A', O, N);
    ship(s, 'A').carrying = true;
    const { events } = run(s, (m) => stepShip(m, ship(s, 'A'), N, 'sail'));
    expect(events).toContainEqual({ type: 'TreasureDropped', rule: '7.8', ship: 'A-ship', at: neighbor(O, N), kind: 'gold' });
    expect(s.treasures).toEqual([k(neighbor(O, N))]);
  });
});

describe('scoring and winning (rules §8.2.4, §8.2.5)', () => {
  it('a carrier entering her own port scores, and a new treasure spawns at Upkeep; a rival’s port doesn’t count', () => {
    const g = createGame(MISS);
    let s = game(map({}, { '1': k(hex(2, 2)), '2': k(hex(1, 2)) }));
    place(s, 'A', neighbor(PORT_A, Direction.SE), Direction.NW);
    ship(s, 'A').carrying = true;
    place(s, 'B', neighbor(PORT_A, Direction.NE));
    const row = TEST_CARDS.find((c) => c.sail === 'rowAhead')!.id;
    s.deck = s.deck.filter((c) => c !== row);
    for (const x of Object.values(s.ships)) x.hand = x.hand.filter((c) => c !== row);
    ship(s, 'A').hand.push(row);
    s = g.apply(s, 'A', { type: 'place', ship: 'A-ship', slot: 'sail1', card: row }).state;
    const events: GameEvent[] = [];
    for (const p of ['A', 'B']) {
      const out = g.apply(s, p, { type: 'ready' });
      s = out.state;
      events.push(...out.events);
    }
    while (s.pending) {
      const out = g.apply(s, s.pending.player, { type: 'answer', choice: s.pending.options.length - 1 });
      s = out.state;
      events.push(...out.events);
    }
    expect(events).toContainEqual({ type: 'TreasureScored', rule: '8.2.4', ship: 'A-ship', team: 'red', score: 1, kind: 'gold' });
    expect(s.teams['red']!.score).toBe(1);
    expect(s.treasures).toHaveLength(2);
    expect(g.view(s, 'B').scores).toEqual({ red: 1, blue: 0 });
    const t = game(map({}, {}));
    place(t, 'B', PORT_A);
    ship(t, 'B').carrying = true;
    run(t, (m) => arrive(t, ship(t, 'B'), MISS, m.ctx));
    expect(t.teams['blue']!.score).toBe(0);
  });

  it('Solo Challenge (§8.8): no target; after the last turn’s Part III the game ends and the treasure brought home is the score', () => {
    const config = makeConfig({ ...MISS, soloTurns: 2 });
    const g = createGame(config);
    let s = game(map({}, {}), 1);
    expect(s.treasures).toHaveLength(0); // no spawn points on this map
    s.teams['red']!.score = 5;
    place(s, 'A', neighbor(PORT_A, Direction.SE), Direction.NW);
    ship(s, 'A').carrying = true;
    const row = TEST_CARDS.find((c) => c.sail === 'rowAhead')!.id;
    s.deck = s.deck.filter((c) => c !== row);
    ship(s, 'A').hand = ship(s, 'A').hand.filter((c) => c !== row).concat(row);
    s = g.apply(s, 'A', { type: 'place', ship: 'A-ship', slot: 'sail1', card: row }).state;
    // Answer any question (the refit in port) with its default.
    const settle = (out: { state: GameState; events: GameEvent[] }) => {
      while (out.state.pending) {
        const next = g.apply(out.state, 'A', { type: 'answer', choice: out.state.pending.defaultIndex });
        out = { state: next.state, events: [...out.events, ...next.events] };
      }
      return out;
    };
    const one = settle(g.apply(s, 'A', { type: 'ready' }));
    expect(one.state.teams['red']!.score).toBe(6);
    expect(one.events.some((e) => e.type === 'GameWon')).toBe(false);
    expect(one.state).toMatchObject({ phase: 'programming', turn: 2 });
    expect(g.view(one.state, 'A').turnLimit).toBe(2);
    expect(g.result(one.state)).toBeUndefined();
    const two = settle(g.apply(one.state, 'A', { type: 'ready' }));
    expect(two.events).toContainEqual({ type: 'SoloFinished', rule: '8.8', turns: 2, score: 6 });
    expect(two.events.some((e) => e.type === 'UpkeepStarted')).toBe(false);
    expect(two.state.phase).toBe('over');
    expect(g.result(two.state)).toEqual({ score: 6 });
    expect(g.view(game(), 'A').turnLimit).toBeUndefined();
    const solo = game(map(), 1);
    expect(solo.treasures).toHaveLength(1);
  });

  it('reaching the target ends the game at once', () => {
    const g = createGame(MISS);
    let s = game(map({}, {}));
    s.teams['red']!.score = 2;
    place(s, 'A', neighbor(PORT_A, Direction.SE), Direction.NW);
    ship(s, 'A').carrying = true;
    const row = TEST_CARDS.find((c) => c.sail === 'rowAhead')!.id;
    s.deck = s.deck.filter((c) => c !== row);
    for (const x of Object.values(s.ships)) x.hand = x.hand.filter((c) => c !== row);
    ship(s, 'A').hand.push(row);
    s = g.apply(s, 'A', { type: 'place', ship: 'A-ship', slot: 'sail1', card: row }).state;
    s = g.apply(s, 'A', { type: 'ready' }).state;
    const out = g.apply(s, 'B', { type: 'ready' });
    expect(out.events).toContainEqual({ type: 'GameWon', rule: '8.2.5', team: 'red' });
    expect(out.events.some((e) => e.type === 'UpkeepStarted')).toBe(false);
    expect(out.state.phase).toBe('over');
    expect(g.result(out.state)).toEqual({ winner: 'red' });
    expect(g.legalActions(out.state, 'A')).toEqual([]);
    expect(g.view(out.state, 'B').winner).toBe('red');
    expect(g.result(game())).toBeUndefined();
  });
});
