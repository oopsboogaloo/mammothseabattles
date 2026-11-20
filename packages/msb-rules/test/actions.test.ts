import { describe, expect, it } from 'vitest';
import type { PendingDecision, ResolutionContext } from '@msb/engine';
import { Direction, distance, hex, hexKey, neighbor, type Hex } from '@msb/hex';
import {
  DEFAULT_CONFIG,
  HEAL_CREW,
  HOLD_FIRE,
  REPAIR_SLOT,
  RETURN_HEADING,
  RETURN_HEX,
  returnHexes,
  actionOrder,
  createGame,
  fireContext,
  makeConfig,
  newGame,
  returnSunkShips,
  runActions,
  type CommandCard,
  type GameEvent,
  type GameMap,
  type GameState,
  type MapHex,
} from '@msb/msb-rules';
import { CALM_WEATHER, TEST_CARDS } from './fixtures';

const { N, NE, SE, S, SW } = Direction;
const O = hex(0, 0);
const k = hexKey;
const MISS = makeConfig({ damageDie: Array(12).fill({ ship: 0, crew: 0 }) });
const ONE_SHIP = makeConfig({ damageDie: Array(12).fill({ ship: 1, crew: 0 }) });

function map(overrides: Record<string, MapHex> = {}, extra: Partial<GameMap> = {}): GameMap {
  const hexes: Record<string, MapHex> = {};
  for (let q = -5; q <= 5; q++) for (let r = -5; r <= 5; r++) if (distance(O, hex(q, r)) <= 5) hexes[k(hex(q, r))] = { terrain: 'sea' };
  return { id: 'test', hexes: { ...hexes, ...overrides }, ...extra };
}

/** Ships A (red), B (blue), C (red, A's teammate), D (green), with home ports far apart on the rim. */
function game(m: GameMap = map()): GameState {
  const ports: Hex[] = [hex(-5, 0), hex(5, -5), hex(0, 5), hex(5, 0)];
  const teams = ['red', 'blue', 'red', 'green'];
  const seats = ['A', 'B', 'C', 'D'].map((p, i) => ({ player: p, team: teams[i]!, name: p, homePort: ports[i]!, heading: N }));
  return newGame({ seed: 3, map: m, seats, commandCards: TEST_CARDS, weatherCards: CALM_WEATHER });
}

const ship = (s: GameState, id: string) => s.ships[`${id}-ship`]!;
function place(s: GameState, id: string, at: Hex, heading: Direction = N): void {
  Object.assign(ship(s, id), { pos: at, heading });
}
function program(s: GameState, id: string, action: CommandCard['action'], slot = 'action1', pick = 0): string {
  const card = TEST_CARDS.filter((c) => c.action === action)[pick]!;
  ship(s, id).program[slot] = card.id;
  return card.id;
}

/** Run with answers chosen by `answer` (default: the decision's default). */
function run(
  s: GameState,
  fn: (ctx: ResolutionContext<GameEvent>) => void,
  answer: (d: PendingDecision<unknown>) => number = (d) => d.defaultIndex,
): { events: GameEvent[]; asked: PendingDecision<unknown>[] } {
  const events: GameEvent[] = [];
  const asked: PendingDecision<unknown>[] = [];
  fn({
    ask: <T,>(d: PendingDecision<T>) => {
      if (d.options.length > 1) asked.push(d as PendingDecision<unknown>);
      return d.options[d.options.length === 1 ? 0 : answer(d as PendingDecision<unknown>)] as T;
    },
    emit: (e) => events.push(e),
  });
  return { events, asked };
}
const ships = (s: GameState) => ['A', 'B', 'C', 'D'].map((id) => ship(s, id));
const act = (s: GameState, config = MISS, answer?: (d: PendingDecision<unknown>) => number) =>
  run(s, (ctx) => runActions(s, ships(s), 1, config, ctx), answer);

describe('cannon fire (rules §7.1)', () => {
  it('hits every enemy in both broadsides with 1 DD; not teammates, not ahead or astern', () => {
    const s = game();
    place(s, 'A', O, N);
    place(s, 'B', hex(2, 0)); // starboard (east)
    place(s, 'D', hex(-2, 1)); // port (west)
    place(s, 'C', hex(-2, 0)); // teammate, in the port arc
    program(s, 'A', 'fire');
    const { events } = act(s);
    expect(events.find((e) => e.type === 'CannonFired')).toEqual({ type: 'CannonFired', rule: '7.1', ship: 'A-ship', targets: ['B-ship', 'D-ship'], spared: [] });
    expect(events.filter((e) => e.type === 'DamageRolled' && e.source === 'cannon').map((e) => (e as { ship: string }).ship)).toEqual(['B-ship', 'D-ship']);
    const t = game();
    place(t, 'A', O, N);
    place(t, 'B', hex(0, -3)); // dead ahead
    program(t, 'A', 'fire');
    expect(act(t).events.find((e) => e.type === 'CannonFired')).toMatchObject({ targets: [] });
  });

  it('the firer may hold fire on any target', () => {
    const s = game();
    place(s, 'A', O, N);
    place(s, 'B', hex(2, 0));
    place(s, 'D', hex(-2, 1));
    program(s, 'A', 'fire');
    const { events, asked } = act(s, MISS, (d) => (d.kind === HOLD_FIRE && String(d.options[0]).endsWith('B-ship') ? 1 : 0));
    expect(asked.map((d) => d.kind)).toEqual([HOLD_FIRE, HOLD_FIRE]);
    expect(events.find((e) => e.type === 'CannonFired')).toMatchObject({ targets: ['D-ship'], spared: ['B-ship'] });
  });

  it('fog: no firing from, into or through it; nor through a whirlpool', () => {
    const fogAt = (at: Hex) => map({ [k(at)]: { terrain: 'sea', fog: true } });
    const cases: [GameMap, string][] = [
      [fogAt(O), 'firer in fog'],
      [fogAt(hex(2, 0)), 'target in fog'],
      [fogAt(hex(1, 0)), 'fog between'],
      [map({ [k(hex(1, 0))]: { terrain: 'sea', whirlpool: 1 }, [k(hex(-4, 4))]: { terrain: 'sea', whirlpool: 1 } }), 'whirlpool between'],
    ];
    for (const [m] of cases) {
      const s = game(m);
      place(s, 'A', O, N);
      place(s, 'B', hex(2, 0));
      program(s, 'A', 'fire');
      expect(act(s).events.find((e) => e.type === 'CannonFired')).toMatchObject({ targets: [] });
    }
    expect([...fireContext(game(cases[3]![0])).portals].sort()).toEqual([k(hex(-4, 4)), k(hex(1, 0))]);
  });

  it('ships act in Action initiative order, and a ship sunk earlier in the phase doesn’t act', () => {
    const s = game();
    place(s, 'A', O, N);
    place(s, 'B', hex(2, 0), N); // A is in B's port arc too
    program(s, 'A', 'fire', 'action1', 14); // the highest Fire card
    program(s, 'B', 'fire', 'action1', 0);
    expect(actionOrder(s, ships(s), 1, DEFAULT_CONFIG).map((x) => x.id).slice(0, 2)).toEqual(['A-ship', 'B-ship']);
    ship(s, 'B').blocked = ['sail1', 'sail2']; // one more Sail marker sinks her
    const { events } = act(s, ONE_SHIP, (d) => (d.kind === 'placeShipDamage' ? d.options.findIndex((o) => (o as { row: string }).row === 'sail') : d.defaultIndex));
    expect(ship(s, 'B').status).toBe('sunk');
    expect(events.filter((e) => e.type === 'CannonFired').map((e) => (e as { ship: string }).ship)).toEqual(['A-ship']);
  });

  it('a card in a slot that takes Ship damage is lost; a damaged Action slot does nothing', () => {
    const s = game();
    place(s, 'A', O, N);
    place(s, 'B', hex(2, 0));
    program(s, 'A', 'fire');
    const bCard = program(s, 'B', 'repair', 'action2');
    const { events } = act(s, ONE_SHIP, (d) => (d.kind === 'placeShipDamage' ? d.options.findIndex((o) => (o as { row: string; part: number }).row === 'action' && (o as { part: number }).part === 2) : d.defaultIndex));
    expect(events).toContainEqual({ type: 'CardLost', rule: '7.3', ship: 'B-ship', slot: 'action2', card: bCard });
    expect(ship(s, 'B').program['action2']).toBeUndefined();
    expect(s.discards).toContain(bCard);
    const t = game();
    program(t, 'A', 'fire');
    ship(t, 'A').blocked = ['action1'];
    expect(act(t).events.some((e) => e.type === 'CannonFired')).toBe(false);
  });
});

describe('repair and heal (rules §7.6)', () => {
  it('Repair removes one damage marker of the player’s choice, from any slot', () => {
    const s = game();
    ship(s, 'A').blocked = ['sail2', 'action3'];
    program(s, 'A', 'repair');
    const { events, asked } = act(s, MISS, () => 1);
    expect(asked[0]).toMatchObject({ kind: REPAIR_SLOT, options: ['sail2', 'action3'] });
    expect(ship(s, 'A').blocked).toEqual(['sail2']);
    expect(events).toContainEqual({ type: 'SlotRepaired', rule: '7.6', ship: 'A-ship', slot: 'action3' });
  });

  it('Heal flips one wounded crew member back (Captain first by default); with nothing to fix, nothing happens', () => {
    const s = game();
    ship(s, 'A').crew = ship(s, 'A').crew.map((c) => ({ ...c, state: 'wounded' as const }));
    program(s, 'A', 'heal');
    const { events } = act(s);
    expect(events).toContainEqual({ type: 'CrewHealed', rule: '7.6', ship: 'A-ship', crew: 'A-ship-captain' });
    expect(ship(s, 'A').crew.filter((c) => c.state === 'healthy').map((c) => c.id)).toEqual(['A-ship-captain']);
    const t = game();
    program(t, 'A', 'heal');
    program(t, 'B', 'repair');
    expect(act(t).events.filter((e) => e.type === 'CrewHealed' || e.type === 'SlotRepaired')).toEqual([]);
  });
});

describe('home port guns (rules §8.2.4)', () => {
  it('fire 1 DD at every rival within 2 hexes after all ships; not at their own team; fog hides a ship', () => {
    const s = game(map({ [k(hex(4, -3))]: { terrain: 'sea', fog: true } }));
    place(s, 'A', hex(-4, 0)); // 1 from her own port: safe
    place(s, 'C', hex(3, -3)); // 2 from B's port: hit
    place(s, 'D', hex(4, -3)); // 1 from B's port, but in fog
    place(s, 'B', hex(-3, 0)); // 2 from the red port: hit
    const { events } = act(s);
    expect(events.filter((e) => e.type === 'PortGunsFired')).toEqual([
      { type: 'PortGunsFired', rule: '8.2.4', team: 'red', targets: ['B-ship'] },
      { type: 'PortGunsFired', rule: '8.2.4', team: 'blue', targets: ['C-ship'] },
    ]);
  });
});

describe('sinking and coming back (rules §7.8, §7.9)', () => {
  it('a sunk ship leaves a wreck; at Upkeep she comes back at her port, heading of her player’s choice, repaired, 3 crew, no Captain', () => {
    const g = createGame(ONE_SHIP);
    let s = game(map({}, { startWrecks: [k(hex(1, 1))] }));
    expect(s.wrecks).toEqual([k(hex(1, 1))]);
    place(s, 'B', hex(2, 0));
    place(s, 'A', O, N);
    ship(s, 'B').blocked = ['sail1', 'sail2'];
    const fire = TEST_CARDS.find((c) => c.action === 'fire')!.id;
    s.deck = s.deck.filter((c) => c !== fire);
    for (const x of ships(s)) x.hand = x.hand.filter((c) => c !== fire);
    ship(s, 'A').hand.push(fire);
    s = g.apply(s, 'A', { type: 'place', ship: 'A-ship', slot: 'action1', card: fire }).state;
    for (const p of ['A', 'B', 'C', 'D']) {
      const out = g.apply(s, p, { type: 'ready' });
      s = out.state;
    }
    const kinds: string[] = [];
    while (s.pending) {
      const d = s.pending;
      kinds.push(d.kind);
      const choice = d.kind === 'placeShipDamage' ? d.options.findIndex((o) => (o as { row: string }).row === 'sail') : d.kind === RETURN_HEADING ? 3 : d.defaultIndex;
      s = g.apply(s, d.player, { type: 'answer', choice }).state;
    }
    expect(kinds).toContain(RETURN_HEADING);
    expect(s.wrecks).toEqual([k(hex(1, 1)), k(hex(2, 0))]);
    expect(ship(s, 'B')).toMatchObject({ status: 'afloat', pos: hex(5, -5), heading: S, sail: 'none', blocked: [] });
    expect(ship(s, 'B').crew.map((c) => c.captain)).toEqual([false, false, false]);
    expect(ship(s, 'B').hand).toHaveLength(3);
  });

  it('if her port is occupied she comes back at the nearest free sea hex, her choice among equally near ones (Q71)', () => {
    const P = hex(5, -5);
    const m = () => map({ [k(neighbor(P, SW))]: { terrain: 'beach' }, [k(neighbor(P, 2))]: { terrain: 'deathReef' } }); // round P: S sea, SW beach, NW sea, SE a death reef (never offered)
    const s = game(m());
    ship(s, 'B').status = 'sunk';
    place(s, 'D', P);
    const { asked } = run(s, (ctx) => returnSunkShips(s, ships(s), ctx), (d) => (d.kind === RETURN_HEX ? 1 : d.defaultIndex));
    expect(asked[0]).toMatchObject({ kind: RETURN_HEX, options: [neighbor(P, S), neighbor(P, 5)] });
    expect(ship(s, 'B').pos).toEqual(neighbor(P, 5));
    // Port and every free hex next to it taken: the nearest free hexes are 2 away, offered clockwise from north.
    const t = game(m());
    ship(t, 'B').status = 'sunk';
    place(t, 'A', P);
    place(t, 'C', neighbor(P, S));
    place(t, 'D', neighbor(P, 5));
    const two = run(t, (ctx) => returnSunkShips(t, ships(t), ctx), (d) => d.defaultIndex);
    const options = two.asked[0]?.options as Hex[];
    for (const h of options) expect(distance(P, h)).toBe(2);
    expect(options.map((h) => k(h))).toEqual(['5,-3', '4,-3', '3,-3', '3,-4', '3,-5']);
    expect(ship(t, 'B')).toMatchObject({ status: 'afloat', pos: options[0] });
  });

  it('comes back in her port if it’s free (no question), and waits only if the map has no free sea hex at all', () => {
    const P = hex(5, -5);
    const s = game();
    ship(s, 'B').status = 'sunk';
    expect(returnHexes(s, P)).toEqual([P]);
    // Every hex but her port is cliff, and her port is taken.
    const land: Record<string, MapHex> = {};
    for (const key of Object.keys(map().hexes)) if (key !== k(P)) land[key] = { terrain: 'cliff' };
    const t = game(map(land));
    ship(t, 'B').status = 'sunk';
    place(t, 'D', P);
    expect(returnHexes(t, P)).toEqual([]);
    // A whole turn: she stays sunk, and doesn't draw.
    const g = createGame(MISS);
    let u = t;
    for (const p of ['A', 'B', 'C', 'D']) u = g.apply(u, p, { type: 'ready' }).state;
    expect(ship(u, 'B').status).toBe('sunk');
    expect(ship(u, 'B').hand).toEqual(ship(t, 'B').hand);
    expect(NE + SE).toBe(3);
  });
});
