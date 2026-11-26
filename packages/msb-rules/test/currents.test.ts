import { describe, expect, it } from 'vitest';
import type { PendingDecision, ResolutionContext } from '@msb/engine';
import { Direction, distance, hex, hexKey, neighbor, type Hex } from '@msb/hex';
import {
  DEFAULT_CONFIG,
  activeIn,
  createGame,
  directionTo,
  makeConfig,
  newGame,
  runCurrents,
  type Current,
  type GameEvent,
  type GameMap,
  type GameState,
  type MapHex,
  type MoveContext,
  type Rotor,
} from '@msb/msb-rules';
import { CALM_WEATHER, TEST_CARDS } from './fixtures';

const { N, NE, SE, S, SW, NW } = Direction;
const O = hex(0, 0);
const k = hexKey;
const flow = (to: Hex, strength: 1 | 2 | 3 = 1, turn = 0): MapHex => ({ terrain: 'sea', current: { kind: 'flow', to: k(to), turn, strength } });
const eddy = (turn: number, strength: 1 | 2 | 3 = 1): MapHex => ({ terrain: 'sea', current: { kind: 'eddy', turn, strength } as Current });

function map(overrides: Record<string, MapHex> = {}, rotors: Rotor[] = []): GameMap {
  const hexes: Record<string, MapHex> = {};
  for (let q = -4; q <= 4; q++) for (let r = -4; r <= 4; r++) if (distance(O, hex(q, r)) <= 4) hexes[k(hex(q, r))] = { terrain: 'sea' };
  return { id: 'test', hexes: { ...hexes, ...overrides }, rotors };
}

function game(m: GameMap): GameState {
  const seats = ['A', 'B', 'C'].map((p, i) => ({ player: p, team: p, name: p, homePort: hex(-4 + i, 4), heading: N }));
  return newGame({ seed: 1, map: m, seats, commandCards: TEST_CARDS, weatherCards: CALM_WEATHER });
}

function place(s: GameState, ship: string, at: Hex, heading: Direction = N): void {
  Object.assign(s.ships[`${ship}-ship`]!, { pos: at, heading });
}
const ship = (s: GameState, id: string) => s.ships[`${id}-ship`]!;

/** Run the Currents phase with ships in the order given (as Sail initiative order). */
function currents(s: GameState, order = ['A', 'B', 'C'], config = DEFAULT_CONFIG): GameEvent[] {
  const events: GameEvent[] = [];
  const ctx: ResolutionContext<GameEvent> = { ask: <T,>(d: PendingDecision<T>) => d.options[d.defaultIndex] as T, emit: (e) => events.push(e) };
  const m: MoveContext = { state: s, config, part: 1, ctx };
  runCurrents(m, order.map((id) => ship(s, id)));
  return events;
}

describe('sub-steps (rules §6.6)', () => {
  it('triple currents act in all 3 sub-steps, double in the last 2, single in the last one', () => {
    expect([1, 2, 3].map((st) => activeIn(3, st as 1 | 2 | 3))).toEqual([true, true, true]);
    expect([1, 2, 3].map((st) => activeIn(2, st as 1 | 2 | 3))).toEqual([false, true, true]);
    expect([1, 2, 3].map((st) => activeIn(1, st as 1 | 2 | 3))).toEqual([false, false, true]);
  });

  it('a river of single arrows moves a ship only 1 hex; double 2; triple 3 (example 1)', () => {
    const line = (strength: 1 | 2 | 3) => {
      const o: Record<string, MapHex> = {};
      for (let r = 2; r >= -3; r--) o[k(hex(0, r))] = flow(hex(0, r - 1), strength);
      return o;
    };
    for (const strength of [1, 2, 3] as const) {
      const s = game(map(line(strength)));
      place(s, 'A', hex(0, 2), SW);
      currents(s);
      expect(ship(s, 'A').pos).toEqual(hex(0, 2 - strength));
      expect(ship(s, 'A').heading).toBe(SW); // straight arrows don't turn her, whatever her heading
    }
  });

  it('a ship carried onto another current between sub-steps is carried again', () => {
    const s = game(map({ [k(O)]: flow(hex(0, -1), 2), [k(hex(0, -1))]: flow(hex(1, -2), 1) }));
    place(s, 'A', O);
    currents(s);
    // Sub-step 2: the double arrow carries her north; sub-step 3: both act, so she's carried again.
    expect(ship(s, 'A').pos).toEqual(hex(1, -2));
  });
});

describe('curved currents and eddies (examples 2, 3, 6, 7)', () => {
  it('a curved arrow carries her 1 hex and turns her 1 side in its direction', () => {
    const s = game(map({ [k(O)]: flow(neighbor(O, S), 1, 1), [k(hex(2, 0))]: flow(neighbor(hex(2, 0), N), 1, -1) }));
    place(s, 'A', O, S);
    place(s, 'B', hex(2, 0), NW);
    const events = currents(s);
    expect(ship(s, 'A')).toMatchObject({ pos: neighbor(O, S), heading: SW });
    expect(ship(s, 'B')).toMatchObject({ pos: neighbor(hex(2, 0), N), heading: SW });
    expect(events).toContainEqual({ type: 'ShipTurned', rule: '5.2', ship: 'A-ship', from: S, to: SW, cause: 'current' });
  });

  it('an eddy turns her in place by 60°, 120° or 180°', () => {
    const s = game(map({ [k(O)]: eddy(1), [k(hex(2, 0))]: eddy(2), [k(hex(-2, 0))]: eddy(3) }));
    place(s, 'A', O, S);
    place(s, 'B', hex(2, 0), S);
    place(s, 'C', hex(-2, 0), S);
    currents(s);
    expect([ship(s, 'A'), ship(s, 'B'), ship(s, 'C')].map((x) => [x.pos, x.heading])).toEqual([
      [O, SW],
      [hex(2, 0), NW],
      [hex(-2, 0), N],
    ]);
  });
});

describe('rotors (examples 4, 5, 9)', () => {
  it('a 2-hex rotor swaps two ships and turns both 180°', () => {
    const a = O;
    const b = neighbor(O, S);
    const s = game(map({}, [{ moves: { [k(a)]: k(b), [k(b)]: k(a) }, turn: 3, strength: 1 }]));
    place(s, 'A', a, NE);
    place(s, 'B', b, N);
    currents(s);
    expect(ship(s, 'A')).toMatchObject({ pos: b, heading: SW });
    expect(ship(s, 'B')).toMatchObject({ pos: a, heading: S });
  });

  it('a 3-hex ring round a corner carries her to the next hex and turns her 120°', () => {
    const [a, b, c] = [O, neighbor(O, SE), neighbor(O, S)];
    const s = game(map({}, [{ moves: { [k(a)]: k(b), [k(b)]: k(c), [k(c)]: k(a) }, turn: 2, strength: 1 }]));
    place(s, 'A', a, N);
    currents(s);
    expect(ship(s, 'A')).toMatchObject({ pos: b, heading: SE });
  });

  it('a 4-hex rotor carries ships across, so ships opposite each other swap', () => {
    const [a, b, c, d] = [O, neighbor(O, SE), neighbor(neighbor(O, SE), S), neighbor(O, S)];
    const s = game(map({}, [{ moves: { [k(a)]: k(c), [k(b)]: k(d), [k(c)]: k(a), [k(d)]: k(b) }, turn: 3, strength: 1 }]));
    place(s, 'A', a, N);
    place(s, 'B', c, SE);
    currents(s);
    expect(ship(s, 'A')).toMatchObject({ pos: c, heading: S });
    expect(ship(s, 'B')).toMatchObject({ pos: a, heading: NW });
  });

  it('a ship whose destination holds an anchored ship stays put, and so does anyone heading for her', () => {
    const [a, b, c] = [O, neighbor(O, SE), neighbor(O, S)];
    const s = game(map({}, [{ moves: { [k(a)]: k(b), [k(b)]: k(c), [k(c)]: k(a) }, turn: 2, strength: 1 }]));
    place(s, 'A', a, N);
    place(s, 'B', b, N);
    place(s, 'C', c, N);
    ship(s, 'C').anchored = true;
    const events = currents(s);
    expect([ship(s, 'A').pos, ship(s, 'B').pos, ship(s, 'C').pos]).toEqual([a, b, c]);
    expect(events.filter((e) => e.type === 'ShipStopped')).toHaveLength(2);
    expect(ship(s, 'C').heading).toBe(N);
  });

  it('a weak rotor waits for its sub-step; a ship already moved this sub-step isn’t moved again', () => {
    const a = hex(0, -1);
    const b = O;
    const s = game(map({ [k(neighbor(O, S))]: flow(O, 1) }, [{ moves: { [k(a)]: k(b), [k(b)]: k(a) }, turn: 3, strength: 1 }]));
    place(s, 'A', neighbor(O, S), N);
    currents(s);
    // Sub-step 3: A is carried onto the rotor; the rotor has already been handled this sub-step (no ship on it then).
    expect(ship(s, 'A')).toMatchObject({ pos: O, heading: N });
  });
});

describe('blocked and jumping currents (example 8)', () => {
  it('currents don’t push: a blocked ship stays put and isn’t turned', () => {
    const s = game(map({ [k(O)]: flow(neighbor(O, N), 1, 1) }));
    place(s, 'A', O, N);
    place(s, 'B', neighbor(O, N));
    const events = currents(s);
    expect(ship(s, 'A')).toMatchObject({ pos: O, heading: N });
    expect(events).toEqual([{ type: 'ShipStopped', rule: '3.2.0', ship: 'A-ship', at: O, by: 'ship', blocked: neighbor(O, N) }]);
  });

  it('a jump goes straight to the end hex, ignoring the hexes between; if it is occupied she stays put', () => {
    const target = hex(1, -2);
    const between = { [k(hex(0, -1))]: { terrain: 'deathReef' } as MapHex, [k(hex(1, -1))]: { terrain: 'cliff' } as MapHex };
    const s = game(map({ ...between, [k(O)]: flow(target) }));
    place(s, 'A', O, SW);
    currents(s);
    expect(ship(s, 'A')).toMatchObject({ pos: target, heading: SW, status: 'afloat' });
    expect(directionTo(O, target)).toBeUndefined();
    expect(directionTo(O, hex(0, -1))).toBe(N);
    const t = game(map({ [k(O)]: flow(target) }));
    place(t, 'A', O);
    place(t, 'B', target);
    currents(t);
    expect(ship(t, 'A').pos).toEqual(O);
  });

  it('anchored and sunk ships aren’t carried; a current into a cliff deals 2 DD', () => {
    const s = game(map({ [k(O)]: flow(neighbor(O, N)), [k(hex(2, 0))]: flow(neighbor(hex(2, 0), N)), [k(neighbor(O, N))]: { terrain: 'cliff' } }));
    place(s, 'A', O);
    place(s, 'B', hex(2, 0));
    ship(s, 'B').anchored = true;
    place(s, 'C', hex(-2, 0));
    ship(s, 'C').status = 'sunk';
    const events = currents(s, ['A', 'B', 'C'], makeConfig({ damageDie: Array(12).fill({ ship: 0, crew: 0 }) }));
    expect(events[0]).toMatchObject({ type: 'DamageRolled', source: 'cliff', dd: 2 });
    expect(ship(s, 'B').pos).toEqual(hex(2, 0));
  });
});

describe('currents in a whole turn (rules §5.2 step 3)', () => {
  it('runs after steering, before drift', () => {
    const g = createGame();
    let s = game(map({ [k(O)]: flow(neighbor(O, N), 1, 1) }));
    place(s, 'A', O, N);
    for (const p of ['A', 'B', 'C']) s = g.apply(s, p, { type: 'ready' }).state;
    expect(ship(s, 'A')).toMatchObject({ pos: neighbor(O, N), heading: NE });
  });
});
