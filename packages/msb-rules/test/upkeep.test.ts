import { describe, expect, it } from 'vitest';
import type { PendingDecision, ResolutionContext } from '@msb/engine';
import { Direction, distance, hex, hexKey, neighbor, type Hex } from '@msb/hex';
import {
  CREW_SWAP,
  DEFAULT_CONFIG,
  REFIT,
  createGame,
  newGame,
  refit,
  refitOptions,
  searchWrecks,
  wrecksFor,
  type GameEvent,
  type GameMap,
  type GameState,
  type MapHex,
  type RefitChoice,
  type ShipCrew,
} from '@msb/msb-rules';
import { CALM_WEATHER, TEST_CARDS } from './fixtures';

const { N, S } = Direction;
const O = hex(0, 0);
const k = hexKey;
const PORT_A = hex(-4, 0);

function map(overrides: Record<string, MapHex> = {}, wrecks: string[] = []): GameMap {
  const hexes: Record<string, MapHex> = {};
  for (let q = -4; q <= 4; q++) for (let r = -4; r <= 4; r++) if (distance(O, hex(q, r)) <= 4) hexes[k(hex(q, r))] = { terrain: 'sea' };
  return { id: 'test', hexes: { ...hexes, ...overrides }, startWrecks: wrecks };
}
function game(m: GameMap = map()): GameState {
  const seats = [
    { player: 'A', team: 'red', name: 'A', homePort: PORT_A, heading: N },
    { player: 'B', team: 'blue', name: 'B', homePort: hex(4, -4), heading: N },
  ];
  const s = newGame({ seed: 5, map: m, seats, commandCards: TEST_CARDS, weatherCards: CALM_WEATHER });
  s.ships['B-ship']!.pos = hex(3, -2); // out of port, so only A is asked about refitting
  return s;
}
const ship = (s: GameState, id: string) => s.ships[`${id}-ship`]!;
function place(s: GameState, id: string, at: Hex): void {
  ship(s, id).pos = at;
}
function run(s: GameState, fn: (ctx: ResolutionContext<GameEvent>) => void, answer?: (d: PendingDecision<unknown>) => number) {
  const events: GameEvent[] = [];
  const asked: PendingDecision<unknown>[] = [];
  fn({
    ask: <T,>(d: PendingDecision<T>) => {
      if (d.options.length > 1) asked.push(d as PendingDecision<unknown>);
      const i = d.options.length > 1 && answer ? answer(d as PendingDecision<unknown>) : d.defaultIndex;
      return d.options[i] as T;
    },
    emit: (e) => events.push(e),
  });
  return { events, asked };
}
const wound = (crew: ShipCrew[]) => crew.map((c, i) => (i === 1 ? { ...c, state: 'wounded' as const } : c));

describe('refit at home port (rules §7.7)', () => {
  it('offers every part of a refit: the full refit first, no refit last', () => {
    const s = game();
    ship(s, 'A').blocked = ['sail1'];
    ship(s, 'A').crew = wound(ship(s, 'A').crew);
    const options = refitOptions(ship(s, 'A'), DEFAULT_CONFIG);
    expect(options).toHaveLength(2 * 2 * 4);
    expect(options[0]).toEqual({ repair: true, heal: true, recruit: 3 });
    expect(options.at(-1)).toEqual({ repair: false, heal: false, recruit: 0 });
    ship(s, 'A').blocked = [];
    ship(s, 'A').crew = Array.from({ length: 6 }, (_, i) => ({ id: `c${i}`, state: 'healthy', cardIcons: 1, captain: false }));
    expect(refitOptions(ship(s, 'A'), DEFAULT_CONFIG)).toEqual([{ repair: false, heal: false, recruit: 0 }]);
  });

  it('a damaged ship refits fully by default: repaired, healed, 3 recruits, and she spends the next turn refitting', () => {
    const g = createGame();
    let s = game();
    ship(s, 'A').blocked = ['steer2'];
    ship(s, 'A').crew = wound(ship(s, 'A').crew);
    for (const p of ['A', 'B']) s = g.apply(s, p, { type: 'ready' }).state;
    expect(s.pending).toMatchObject({ kind: REFIT, defaultIndex: 0 });
    const out = g.apply(s, 'A', { type: 'answer', choice: 0 });
    s = out.state;
    expect(out.events).toContainEqual({ type: 'ShipRefitted', rule: '7.7', ship: 'A-ship', repair: true, heal: true, recruit: 3 });
    expect(ship(s, 'A')).toMatchObject({ blocked: [], refitting: true });
    expect(ship(s, 'A').crew).toHaveLength(6);
    expect(ship(s, 'A').crew.every((c) => c.state === 'healthy')).toBe(true);
    // Next turn she can't do anything but she still draws; at the next Upkeep she's free again.
    expect(g.legalActions(s, 'A')).toEqual([{ type: 'ready' }]);
    expect(ship(s, 'A').hand.length).toBeGreaterThan(5);
    for (const p of ['A', 'B']) {
      for (let d = g.legalActions(s, p).find((x) => x.type === 'discard'); d; d = g.legalActions(s, p).find((x) => x.type === 'discard')) {
        s = g.apply(s, p, d).state; // B now holds 10 cards: down to 9 first
      }
      s = g.apply(s, p, { type: 'ready' }).state;
    }
    while (s.pending) s = g.apply(s, s.pending.player, { type: 'answer', choice: s.pending.options.length - 1 }).state;
    expect(ship(s, 'A').refitting).toBe(false);
  });

  it('a partial refit still costs the turn; an undamaged ship doesn’t refit by default; a ship just back from sinking can’t', () => {
    const s = game();
    place(s, 'A', PORT_A);
    const { events } = run(s, (ctx) => refit(s, [ship(s, 'A')], DEFAULT_CONFIG, ctx), (d) => (d.options as RefitChoice[]).findIndex((o) => o.recruit === 1));
    expect(events).toEqual([{ type: 'ShipRefitted', rule: '7.7', ship: 'A-ship', repair: false, heal: false, recruit: 1 }]);
    expect(ship(s, 'A')).toMatchObject({ refitting: true });
    expect(ship(s, 'A').crew).toHaveLength(4);
    const t = game();
    const undamaged = run(t, (ctx) => refit(t, [ship(t, 'A')], DEFAULT_CONFIG, ctx));
    expect(undamaged.asked[0]).toMatchObject({ kind: REFIT, defaultIndex: 3 });
    expect(ship(t, 'A').refitting).toBe(false);
    const u = game();
    expect(run(u, (ctx) => refit(u, [ship(u, 'A')], DEFAULT_CONFIG, ctx, new Set(['A-ship']))).asked).toEqual([]);
  });

  it('a refitting ship doesn’t move, steer or act', () => {
    const g = createGame();
    let s = game();
    ship(s, 'A').refitting = true;
    ship(s, 'A').program = { sail1: TEST_CARDS.find((c) => c.sail === 'full')!.id, action1: TEST_CARDS.find((c) => c.action === 'fire')!.id };
    place(s, 'B', neighbor(PORT_A, Direction.SE));
    const events: GameEvent[] = [];
    for (const p of ['A', 'B']) {
      const out = g.apply(s, p, { type: 'ready' });
      s = out.state;
      events.push(...out.events);
    }
    expect(events.some((e) => 'ship' in e && e.ship === 'A-ship' && ['SailSet', 'ShipMoved', 'CannonFired'].includes(e.type))).toBe(false);
  });
});

describe('searching shipwrecks (rules §7.9)', () => {
  it('a ship on a wreck at sea, or next to one on land, searches it: the wreck goes and she gains a crew card', () => {
    const land = neighbor(O, S);
    const s = game(map({ [k(land)]: { terrain: 'beach' } }, [k(O), k(land), k(neighbor(O, N))]));
    place(s, 'A', O);
    expect(wrecksFor(s, ship(s, 'A')).sort()).toEqual([k(O), k(land)].sort()); // not the one next to her at sea
    const { events } = run(s, (ctx) => searchWrecks(s, [ship(s, 'A'), ship(s, 'B')], DEFAULT_CONFIG, ctx));
    expect(events.filter((e) => e.type === 'WreckSearched')).toHaveLength(2);
    expect(events.filter((e) => e.type === 'CrewGained')).toHaveLength(2);
    expect(ship(s, 'A').crew).toHaveLength(5);
    expect(s.wrecks).toEqual([k(neighbor(O, N))]);
  });

  it('with a full crew, her player may swap the newcomer for one of her crew, or turn the newcomer away', () => {
    const s = game(map({}, [k(O)]));
    place(s, 'A', O);
    ship(s, 'A').crew = Array.from({ length: 6 }, (_, i) => ({ id: `c${i}`, state: i === 2 ? 'wounded' : 'healthy', cardIcons: 1, captain: false }));
    const { events, asked } = run(s, (ctx) => searchWrecks(s, [ship(s, 'A')], DEFAULT_CONFIG, ctx), (d) => (d.options as string[]).indexOf('c2'));
    expect(asked[0]).toMatchObject({ kind: CREW_SWAP, defaultIndex: 0 });
    expect(events.find((e) => e.type === 'CrewGained')).toMatchObject({ replaced: 'c2' });
    expect(ship(s, 'A').crew.map((c) => c.state)).toEqual(Array(6).fill('healthy'));
    const t = game(map({}, [k(O)]));
    place(t, 'A', O);
    ship(t, 'A').crew = ship(s, 'A').crew;
    const kept = run(t, (ctx) => searchWrecks(t, [ship(t, 'A')], DEFAULT_CONFIG, ctx));
    expect(kept.events.some((e) => e.type === 'CrewGained')).toBe(false);
    expect(t.wrecks).toEqual([]);
  });

  it('a sunk ship searches nothing', () => {
    const s = game(map({}, [k(O)]));
    place(s, 'A', O);
    ship(s, 'A').status = 'sunk';
    run(s, (ctx) => searchWrecks(s, [ship(s, 'A')], DEFAULT_CONFIG, ctx));
    expect(s.wrecks).toEqual([k(O)]);
  });
});
