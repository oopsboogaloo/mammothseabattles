import { describe, expect, it } from 'vitest';
import type { PendingDecision, ResolutionContext } from '@msb/engine';
import { Direction, distance, hex, hexKey, neighbor, opposite, type Hex } from '@msb/hex';
import {
  DEFAULT_CONFIG,
  STEER_TURNS,
  createGame,
  currentWeather,
  isLand,
  makeConfig,
  moveShip,
  newGame,
  parseHexKey,
  sailOrder,
  steerShip,
  stepShip,
  driftShip,
  tide,
  type CommandCard,
  type GameEvent,
  type GameMap,
  type GameState,
  type MapHex,
  type MoveContext,
  type RulesConfig,
  type WeatherCard,
  type WindStrength,
} from '@msb/msb-rules';
import { CALM_WEATHER, TEST_CARDS } from './fixtures';

const { N, NE, SE, S, SW, NW } = Direction;
const O = hex(0, 0);

/** A sea map of radius 4 round the origin, with some hexes changed. */
function map(overrides: Record<string, MapHex> = {}, extra: Partial<GameMap> = {}): GameMap {
  const hexes: Record<string, MapHex> = {};
  for (let q = -4; q <= 4; q++) for (let r = -4; r <= 4; r++) if (distance(O, hex(q, r)) <= 4) hexes[hexKey(hex(q, r))] = { terrain: 'sea' };
  return { id: 'test', hexes: { ...hexes, ...overrides }, ...extra };
}

/** A game on `m` with ships A (team red), B (team blue) and, optionally, C (team red, A's teammate). */
function game3(m: GameMap, weather: readonly WeatherCard[] = CALM_WEATHER, withC = true): GameState {
  const seats = [
    { player: 'A', team: 'red', name: 'A', homePort: hex(-4, 0), heading: N },
    { player: 'B', team: 'blue', name: 'B', homePort: hex(4, -4), heading: N },
    ...(withC ? [{ player: 'C', team: 'red', name: 'C', homePort: hex(0, 4), heading: N }] : []),
  ];
  return newGame({ seed: 1, map: m, seats, commandCards: TEST_CARDS, weatherCards: weather });
}

function place(state: GameState, ship: string, at: Hex, heading: Direction = N): void {
  Object.assign(state.ships[ship]!, { pos: at, heading });
}

function setWeather(state: GameState, strength: WindStrength, direction: Direction = N, space = 1): void {
  const card: WeatherCard = { id: `w-${strength}-${direction}`, strength, direction };
  (state.setup as unknown as { weatherCards: WeatherCard[] }).weatherCards = [card];
  state.weather.spaces = Array(6).fill(card.id);
  state.weather.now = space;
}

function card(sail: CommandCard['sail'], steer: CommandCard['steer'] = 'easePort'): string {
  return TEST_CARDS.find((c) => c.sail === sail && c.steer === steer)!.id;
}

/** Run some movement with a context that answers every decision with its default. */
function run(state: GameState, fn: (m: MoveContext) => void, config: RulesConfig = DEFAULT_CONFIG): GameEvent[] {
  const events: GameEvent[] = [];
  const ctx: ResolutionContext<GameEvent> = {
    ask: <O,>(d: PendingDecision<O>) => d.options[d.defaultIndex] as O,
    emit: (e) => events.push(e),
  };
  fn({ state, config, part: 1, ctx });
  return events;
}

/** Damage dice that always miss, so obstacle tests don't sink ships by chance. */
const NO_DAMAGE = makeConfig({ damageDie: Array(12).fill({ ship: 0, crew: 0 }) });

const types = (events: GameEvent[]) => events.map((e) => e.type);
const pos = (state: GameState, ship: string) => state.ships[ship]!.pos;

describe('terrain at each tide (rules §3.2.0)', () => {
  it('follows the tide table', () => {
    expect(['high', 'mid', 'low'].map((t) => isLand('sandbank', t as never))).toEqual([false, true, true]);
    expect(['high', 'mid', 'low'].map((t) => isLand('underwaterReef', t as never))).toEqual([false, false, true]);
    expect(isLand('cliff', 'high') && isLand('beach', 'high')).toBe(true);
    expect(isLand('sea', 'low') || isLand('roughWater', 'low') || isLand('deathReef', 'low')).toBe(false);
  });

  it('the weather board space sets the tide (High, Mid, Mid, Low, Mid, Mid)', () => {
    const s = game3(map());
    expect([0, 1, 2, 3, 4, 5].map((now) => tide({ ...s.weather, now }))).toEqual(['high', 'mid', 'mid', 'low', 'mid', 'mid']);
  });

  it('a weather deck needs 6 cards', () => {
    expect(() => game3(map(), CALM_WEATHER.slice(0, 5))).toThrow('at least 6');
  });
});

describe('sailing (rules §6.1–6.3)', () => {
  it('sails forward by points of sail and weather', () => {
    const s = game3(map());
    setWeather(s, 'firm', SE); // wind blows SE; a ship heading NE has it on her beam → broad reach
    place(s, 'A-ship', O, NE);
    s.ships['A-ship']!.program = { sail1: card('full') };
    const events = run(s, (m) => moveShip(m, s.ships['A-ship']!));
    expect(pos(s, 'A-ship')).toEqual(neighbor(neighbor(neighbor(O, NE), NE), NE));
    expect(events[0]).toEqual({ type: 'SailSet', rule: '6.1', ship: 'A-ship', sail: 'full', order: 'full' });
    expect(types(events).filter((t) => t === 'ShipMoved')).toHaveLength(3);
  });

  it('Full Sail into the wind goes 1 hex backwards (taken aback)', () => {
    const s = game3(map());
    setWeather(s, 'firm', S); // blowing south; a ship heading north is in irons
    place(s, 'A-ship', O, N);
    s.ships['A-ship']!.program = { sail1: card('full') };
    run(s, (m) => moveShip(m, s.ships['A-ship']!));
    expect(pos(s, 'A-ship')).toEqual(neighbor(O, S));
  });

  it('an empty or damaged Move slot means No Sail', () => {
    const s = game3(map());
    setWeather(s, 'gale', N);
    place(s, 'A-ship', O, N);
    s.ships['A-ship']!.program = { sail1: card('full') };
    s.ships['A-ship']!.blocked = ['sail1'];
    const events = run(s, (m) => moveShip(m, s.ships['A-ship']!));
    expect(pos(s, 'A-ship')).toEqual(O);
    expect(events).toEqual([{ type: 'SailSet', rule: '6.1', ship: 'A-ship', sail: 'none', order: 'none' }]);
    expect(s.ships['A-ship']!.galeParts).toBe(0);
  });

  it('counts each Part at Full Sail in a Gale, for damage at Upkeep', () => {
    const s = game3(map());
    setWeather(s, 'gale', SE);
    place(s, 'A-ship', hex(-2, 0), NE);
    s.ships['A-ship']!.program = { sail1: card('full') };
    run(s, (m) => moveShip(m, s.ships['A-ship']!));
    expect(s.ships['A-ship']!.galeParts).toBe(1);
  });
});

describe('rowing and Anchor (rules §6.1)', () => {
  it('Row Ahead / Row Back move 1 hex whatever the wind, even in Dead Calm, at No Sail', () => {
    const s = game3(map());
    setWeather(s, 'deadCalm');
    place(s, 'A-ship', O, NE);
    s.ships['A-ship']!.program = { sail1: card('rowAhead') };
    run(s, (m) => moveShip(m, s.ships['A-ship']!));
    expect(pos(s, 'A-ship')).toEqual(neighbor(O, NE));
    expect(s.ships['A-ship']!.sail).toBe('none');
    s.ships['A-ship']!.program = { sail1: card('rowBack') };
    run(s, (m) => moveShip(m, s.ships['A-ship']!));
    expect(pos(s, 'A-ship')).toEqual(O);
  });

  it('an anchored ship doesn’t drift, can’t be pushed, stops the rammer and takes the ram damage; she still turns', () => {
    const s = game3(map());
    setWeather(s, 'gale', N);
    place(s, 'B-ship', neighbor(O, N), N);
    s.ships['B-ship']!.program = { sail1: card('anchor', 'hardAbout'), steer1: card('anchor', 'hardAbout') };
    run(s, (m) => moveShip(m, s.ships['B-ship']!));
    expect(s.ships['B-ship']!.anchored).toBe(true);
    place(s, 'A-ship', O, N);
    s.ships['A-ship']!.program = { sail1: card('rowAhead') };
    const events = run(s, (m) => {
      moveShip(m, s.ships['A-ship']!);
      driftShip(m, s.ships['B-ship']!);
      steerShip(m, s.ships['B-ship']!);
    });
    expect(pos(s, 'A-ship')).toEqual(O);
    expect(pos(s, 'B-ship')).toEqual(neighbor(O, N));
    expect(events).toContainEqual({ type: 'ShipRammed', rule: '6.5', ship: 'B-ship', by: 'A-ship' });
    expect(events).toContainEqual(expect.objectContaining({ type: 'DamageRolled', ship: 'B-ship', source: 'ram', dd: 1 }));
    expect(events).toContainEqual({ type: 'ShipStopped', rule: '3.2.0', ship: 'A-ship', at: O, by: 'anchored' });
    expect(s.ships['B-ship']!.heading).toBe(S);
  });
});

describe('Anchor holds for the whole Part (rules §6.1)', () => {
  it('a faster ship can’t push a ship that anchors later in initiative order', () => {
    const g = createGame();
    let s = game3(map(), CALM_WEATHER, false);
    setWeather(s, 'deadCalm');
    place(s, 'A-ship', O, N);
    place(s, 'B-ship', neighbor(O, N), N);
    const give = (ship: string, id: string, slot: string) => {
      s.deck = s.deck.filter((x) => x !== id);
      for (const x of Object.values(s.ships)) x.hand = x.hand.filter((c) => c !== id);
      s.ships[ship]!.hand.push(id);
      s = g.apply(s, ship[0]!, { type: 'place', ship, slot, card: id }).state;
    };
    const row = TEST_CARDS.filter((c) => c.sail === 'rowAhead').sort((a, b) => b.initiative - a.initiative)[0]!;
    const anchor = TEST_CARDS.filter((c) => c.sail === 'anchor' && c.initiative < row.initiative)[0]!;
    give('A-ship', row.id, 'sail1');
    give('B-ship', anchor.id, 'sail1');
    s = g.apply(s, 'A', { type: 'ready' }).state;
    let out = g.apply(s, 'B', { type: 'ready' });
    while (out.state.pending) out = g.apply(out.state, out.state.pending.player, { type: 'answer', choice: out.state.pending.defaultIndex });
    expect(out.state.ships['B-ship']!.pos).toEqual(neighbor(O, N));
    expect(out.state.ships['A-ship']!.pos).toEqual(O);
  });

  it('players see the current and next weather and the tide, not the rest of the board', () => {
    const s = game3(map());
    const v = createGame().view(s, 'A');
    expect(v.weather).toEqual({
      now: s.weather.spaces[s.weather.now],
      next: s.weather.spaces[(s.weather.now + 1) % 6],
      space: s.weather.now,
      tide: tide(s.weather),
    });
    expect(JSON.stringify(v)).not.toContain('"deck"');
  });
});

describe('pushing and ramming (rules §6.5)', () => {
  it('a sailing ship pushes a chain; only the first ship hit takes 1 DD', () => {
    const s = game3(map());
    setWeather(s, 'deadCalm');
    place(s, 'A-ship', O, N);
    place(s, 'B-ship', neighbor(O, N));
    place(s, 'C-ship', neighbor(neighbor(O, N), N));
    const events = run(s, (m) => stepShip(m, s.ships['A-ship']!, N, 'row'));
    expect(pos(s, 'A-ship')).toEqual(neighbor(O, N));
    expect(pos(s, 'C-ship')).toEqual(hex(0, -3));
    expect(events.filter((e) => e.type === 'ShipRammed')).toEqual([{ type: 'ShipRammed', rule: '6.5', ship: 'B-ship', by: 'A-ship' }]);
  });

  it('teammates push each other without damage (rules §8.6)', () => {
    const s = game3(map());
    place(s, 'A-ship', O, N);
    place(s, 'C-ship', neighbor(O, N));
    const events = run(s, (m) => stepShip(m, s.ships['A-ship']!, N, 'sail'));
    expect(pos(s, 'C-ship')).toEqual(hex(0, -2));
    expect(types(events)).not.toContain('ShipRammed');
  });

  it('a ship pushed into a cliff takes 2 DD and stays; the pusher stops', () => {
    const s = game3(map({ [hexKey(hex(0, -2))]: { terrain: 'cliff' } }));
    place(s, 'A-ship', O, N);
    place(s, 'B-ship', neighbor(O, N));
    const events = run(s, (m) => stepShip(m, s.ships['A-ship']!, N, 'sail'), NO_DAMAGE);
    expect(pos(s, 'A-ship')).toEqual(O);
    expect(pos(s, 'B-ship')).toEqual(neighbor(O, N));
    expect(events.filter((e) => e.type === 'DamageRolled').map((e) => (e as { source: string }).source)).toEqual(['cliff', 'ram']);
  });

  it('currents and drift don’t push: the ship stays put', () => {
    const s = game3(map());
    setWeather(s, 'gale', N);
    place(s, 'A-ship', O);
    place(s, 'B-ship', neighbor(O, N));
    const events = run(s, (m) => driftShip(m, s.ships['A-ship']!));
    expect(pos(s, 'A-ship')).toEqual(O);
    expect(events).toEqual([{ type: 'ShipStopped', rule: '3.2.0', ship: 'A-ship', at: O, by: 'ship' }]);
  });

  it('a rammed ship that sinks frees the hex for the rammer', () => {
    const s = game3(map({ [hexKey(hex(0, -2))]: { terrain: 'beach' } }));
    place(s, 'A-ship', O, N);
    place(s, 'B-ship', neighbor(O, N));
    s.ships['B-ship']!.blocked = ['sail1', 'sail2', 'sail3', 'steer1', 'steer2', 'steer3', 'action1', 'action2'];
    for (let seed = 1; seed < 400; seed++) {
      const t = structuredClone(s);
      t.rng = seed;
      run(t, (m) => stepShip(m, t.ships['A-ship']!, N, 'sail'));
      if (t.ships['B-ship']!.status === 'sunk') {
        expect(pos(t, 'A-ship')).toEqual(neighbor(O, N));
        return;
      }
    }
    throw new Error('no seed sank B');
  });
});

describe('obstacles (rules §3.2.0, §3.1)', () => {
  it('beach stops a ship without damage; cliff stops her with 2 DD; wall reefs block an edge with 2 DD', () => {
    const s = game3(map({ [hexKey(hex(0, -1))]: { terrain: 'beach' }, [hexKey(hex(1, -1))]: { terrain: 'cliff' } }, { wallReefs: [{ hex: hexKey(O), side: S }] }));
    place(s, 'A-ship', O);
    const beach = run(s, (m) => stepShip(m, s.ships['A-ship']!, N, 'sail'));
    expect(beach).toEqual([{ type: 'ShipStopped', rule: '3.2.0', ship: 'A-ship', at: O, by: 'beach' }]);
    const cliff = run(s, (m) => stepShip(m, s.ships['A-ship']!, NE, 'drift'), NO_DAMAGE);
    expect(cliff[0]).toMatchObject({ type: 'DamageRolled', source: 'cliff', dd: 2 });
    const reef = run(s, (m) => stepShip(m, s.ships['A-ship']!, S, 'current'), NO_DAMAGE);
    expect(reef[0]).toMatchObject({ type: 'DamageRolled', source: 'wallReef', dd: 2 });
    expect(reef.at(-1)).toMatchObject({ type: 'ShipStopped', by: 'wallReef' });
    // The same wall reef, written on the other hex.
    const t = game3(map({}, { wallReefs: [{ hex: hexKey(neighbor(O, S)), side: N }] }));
    place(t, 'A-ship', O);
    expect(run(t, (m) => stepShip(m, t.ships['A-ship']!, S, 'sail'))[0]).toMatchObject({ source: 'wallReef' });
  });

  it('sandbanks are water at High tide only; underwater reefs are land at Low tide only', () => {
    const s = game3(map({ [hexKey(hex(0, -1))]: { terrain: 'sandbank' }, [hexKey(hex(0, 1))]: { terrain: 'underwaterReef' } }));
    place(s, 'A-ship', O);
    setWeather(s, 'light', N, 0); // High
    run(s, (m) => stepShip(m, s.ships['A-ship']!, N, 'sail'));
    expect(pos(s, 'A-ship')).toEqual(hex(0, -1));
    place(s, 'A-ship', O);
    setWeather(s, 'light', N, 1); // Mid
    run(s, (m) => stepShip(m, s.ships['A-ship']!, N, 'sail'));
    expect(pos(s, 'A-ship')).toEqual(O);
    run(s, (m) => stepShip(m, s.ships['A-ship']!, S, 'sail'));
    expect(pos(s, 'A-ship')).toEqual(hex(0, 1));
    place(s, 'A-ship', O);
    setWeather(s, 'light', N, 3); // Low
    run(s, (m) => stepShip(m, s.ships['A-ship']!, S, 'sail'));
    expect(pos(s, 'A-ship')).toEqual(O);
  });

  it('a death reef sinks any ship that enters it', () => {
    const s = game3(map({ [hexKey(hex(0, -1))]: { terrain: 'deathReef' } }));
    place(s, 'A-ship', O);
    const events = run(s, (m) => stepShip(m, s.ships['A-ship']!, N, 'drift'));
    expect(s.ships['A-ship']!.status).toBe('sunk');
    expect(events.at(-1)).toEqual({ type: 'ShipSank', rule: '7.8', ship: 'A-ship', reason: 'deathReef' });
  });

  it('leaving the map sinks her in the hex she left; with Safe edge she stops instead', () => {
    const s = game3(map());
    place(s, 'A-ship', hex(0, -4));
    const safe = run(s, (m) => stepShip(m, s.ships['A-ship']!, N, 'sail'), makeConfig({ safeEdge: true }));
    expect(safe).toEqual([{ type: 'ShipStopped', rule: '3.2.0', ship: 'A-ship', at: hex(0, -4), by: 'edge' }]);
    const events = run(s, (m) => stepShip(m, s.ships['A-ship']!, N, 'sail'));
    expect(events).toEqual([{ type: 'ShipSank', rule: '7.8', ship: 'A-ship', reason: 'edge' }]);
    expect(pos(s, 'A-ship')).toEqual(hex(0, -4));
  });
});

describe('anchored and sunk-on-impact ships', () => {
  it('nothing moves an anchored ship, not even a current', () => {
    const s = game3(map());
    place(s, 'A-ship', O);
    s.ships['A-ship']!.anchored = true;
    const events = run(s, (m) => stepShip(m, s.ships['A-ship']!, N, 'current'));
    expect(events).toEqual([{ type: 'ShipStopped', rule: '3.2.0', ship: 'A-ship', at: O, by: 'anchored' }]);
  });

  it('cliff and wall-reef damage can sink her', () => {
    const deadly = makeConfig({ damageDie: Array(12).fill({ ship: 0, crew: 2 }) });
    const s = game3(map({ [hexKey(hex(0, -1))]: { terrain: 'cliff' } }, { wallReefs: [{ hex: hexKey(O), side: S }] }));
    place(s, 'A-ship', O);
    expect(run(s, (m) => stepShip(m, s.ships['A-ship']!, N, 'sail'), deadly).at(-1)).toMatchObject({ type: 'ShipSank', reason: 'crew' });
    place(s, 'B-ship', O);
    expect(run(s, (m) => stepShip(m, s.ships['B-ship']!, S, 'sail'), deadly).at(-1)).toMatchObject({ type: 'ShipSank', reason: 'crew' });
  });

  it('Dead Calm cards have no direction', () => {
    const s = game3(map(), [{ id: 'calm', strength: 'deadCalm' }, ...CALM_WEATHER]);
    s.weather.spaces[s.weather.now] = 'calm';
    expect(currentWeather(s.weather, s.setup.weatherCards)).toEqual({ strength: 'deadCalm', direction: 0 });
  });
});

describe('whirlpools (rules §3.2.1)', () => {
  const W1 = hex(0, -1);
  const W2 = hex(2, 1);
  const pools = () => map({ [hexKey(W1)]: { terrain: 'sea', whirlpool: 1 }, [hexKey(W2)]: { terrain: 'sea', whirlpool: 1 } });

  it('entering one takes her to its partner, same heading, and she carries on; arriving doesn’t trigger it again', () => {
    const s = game3(pools());
    setWeather(s, 'firm', S); // running north? no: wind blows S, so heading S is running
    place(s, 'A-ship', hex(0, -2), S);
    s.ships['A-ship']!.program = { sail1: card('full') };
    const events = run(s, (m) => moveShip(m, s.ships['A-ship']!));
    expect(events).toContainEqual({ type: 'Teleported', rule: '3.2.1', ship: 'A-ship', from: W1, to: W2 });
    expect(pos(s, 'A-ship')).toEqual(neighbor(W2, S));
    expect(s.ships['A-ship']!.heading).toBe(S);
  });

  it('if the partner is occupied she treats it as a normal hex', () => {
    const s = game3(pools());
    place(s, 'B-ship', W2);
    place(s, 'A-ship', hex(0, -2));
    const events = run(s, (m) => stepShip(m, s.ships['A-ship']!, S, 'drift'));
    expect(types(events)).not.toContain('Teleported');
    expect(pos(s, 'A-ship')).toEqual(W1);
  });
});

describe('sea caves (rules §3.2.2)', () => {
  // Island hexes I1 and I2, with cave A on I1's south side and on I2's north-east side.
  const I1 = hex(-1, -1);
  const I2 = hex(2, -1);
  const caveMap = () =>
    map(
      { [hexKey(I1)]: { terrain: 'cliff' }, [hexKey(I2)]: { terrain: 'cliff' } },
      { caves: [{ hex: hexKey(I1), side: S, letter: 'A' }, { hex: hexKey(I2), side: NE, letter: 'A' }] },
    );

  it('she comes out of the partner cave facing out of its mouth, and carries on', () => {
    const s = game3(caveMap());
    setWeather(s, 'firm', S);
    place(s, 'A-ship', neighbor(neighbor(I1, S), S), N); // two hexes south of the mouth, heading north
    s.ships['A-ship']!.program = { sail1: card('rowAhead') };
    run(s, (m) => stepShip(m, s.ships['A-ship']!, N, 'sail'));
    const events = run(s, (m) => stepShip(m, s.ships['A-ship']!, N, 'sail'));
    expect(pos(s, 'A-ship')).toEqual(neighbor(I2, NE));
    expect(s.ships['A-ship']!.heading).toBe(NE);
    expect(events).toContainEqual({ type: 'WentThroughCave', rule: '3.2.2', ship: 'A-ship', letter: 'A', to: neighbor(I2, NE) });
    expect(events).toContainEqual({ type: 'ShipTurned', rule: '5.2', ship: 'A-ship', from: N, to: NE, cause: 'cave' });
  });

  it('caves are ordinary movement (Q69): sailing through pushes and rams; drift is blocked by a ship at the exit', () => {
    const s = game3(caveMap());
    place(s, 'B-ship', neighbor(I2, NE));
    place(s, 'A-ship', neighbor(I1, S), NE);
    const drift = run(s, (m) => stepShip(m, s.ships['A-ship']!, N, 'drift'));
    expect(pos(s, 'A-ship')).toEqual(neighbor(I1, S));
    expect(s.ships['A-ship']!.heading).toBe(NE);
    expect(types(drift)).toEqual(['ShipStopped']);
    const sail = run(s, (m) => stepShip(m, s.ships['A-ship']!, N, 'sail'), NO_DAMAGE);
    expect(pos(s, 'A-ship')).toEqual(neighbor(I2, NE));
    expect(pos(s, 'B-ship')).toEqual(neighbor(neighbor(I2, NE), NE));
    expect(sail).toContainEqual({ type: 'ShipRammed', rule: '6.5', ship: 'B-ship', by: 'A-ship' });
  });

  it('a ship can be pushed into a cave', () => {
    const s = game3(caveMap());
    place(s, 'B-ship', neighbor(I1, S));
    place(s, 'A-ship', neighbor(neighbor(I1, S), S), N);
    run(s, (m) => stepShip(m, s.ships['A-ship']!, N, 'row'), NO_DAMAGE);
    expect(pos(s, 'B-ship')).toEqual(neighbor(I2, NE));
    expect(s.ships['B-ship']!.heading).toBe(NE);
    expect(pos(s, 'A-ship')).toEqual(neighbor(I1, S));
  });

  it('if she can’t come out, she stays where she was', () => {
    const s = game3(caveMap());
    place(s, 'B-ship', neighbor(I2, NE));
    s.ships['B-ship']!.anchored = true;
    place(s, 'A-ship', neighbor(I1, S), S);
    const events = run(s, (m) => stepShip(m, s.ships['A-ship']!, N, 'sail'));
    expect(pos(s, 'A-ship')).toEqual(neighbor(I1, S));
    expect(s.ships['A-ship']!.heading).toBe(S);
    expect(types(events)).not.toContain('WentThroughCave');
  });

  it('a ship sunk on the way out stays sunk', () => {
    const s = game3(map({ [hexKey(I1)]: { terrain: 'cliff' }, [hexKey(hex(3, -4))]: { terrain: 'cliff' } }, {
      caves: [{ hex: hexKey(I1), side: S, letter: 'A' }, { hex: hexKey(hex(3, -4)), side: N, letter: 'A' }],
    }));
    place(s, 'A-ship', neighbor(I1, S));
    run(s, (m) => stepShip(m, s.ships['A-ship']!, N, 'sail'));
    expect(s.ships['A-ship']!.status).toBe('sunk');
  });
});

describe('setup checks (engineering design §7.1)', () => {
  it('rejects unpaired whirlpools and caves, rotors leaving the map, and bad current destinations', () => {
    expect(() => game3(map({ [hexKey(O)]: { terrain: 'sea', whirlpool: 7 } }))).toThrow('Whirlpool 7 appears 1 times');
    expect(() => game3(map({}, { caves: [{ hex: hexKey(O), side: N, letter: 'Z' }] }))).toThrow('Cave Z appears 1 times');
    expect(() => game3(map({}, { rotors: [{ moves: { [hexKey(O)]: '9,9' }, turn: 3, strength: 1 }] }))).toThrow('leaves the map');
    expect(() => game3(map({}, { rotors: [{ moves: { '9,9': hexKey(O) }, turn: 3, strength: 1 }] }))).toThrow('leaves the map');
    expect(() => game3(map({ [hexKey(O)]: { terrain: 'sea', current: { kind: 'flow', to: 'north', turn: 0, strength: 1 } } }))).toThrow('bad destination');
    expect(() => game3(map({ [hexKey(O)]: { terrain: 'sea', current: { kind: 'eddy', turn: 1, strength: 1 } } }))).not.toThrow();
  });

  it('rejects weather decks with duplicate ids, unsupported cards or winds without a direction', () => {
    const base = CALM_WEATHER.slice(1);
    expect(() => game3(map(), [...base, base[0]!])).toThrow('Duplicate weather card');
    expect(() => game3(map(), [...base, { id: 'front', strength: 'newFront' as WindStrength }])).toThrow('unsupported strength');
    expect(() => game3(map(), [...base, { id: 'gust', strength: 'firm' }])).toThrow('no wind direction');
  });

  it('rejects two ships starting on the same hex', () => {
    const seats = [
      { player: 'A', team: 'a', name: 'A', homePort: O, heading: N },
      { player: 'B', team: 'b', name: 'B', homePort: O, heading: N },
    ];
    expect(() => newGame({ seed: 1, map: map(), seats, commandCards: TEST_CARDS, weatherCards: CALM_WEATHER })).toThrow('share a home port');
  });

  it('a ram that sinks an anchored ship still stops the rammer', () => {
    const deadly = makeConfig({ damageDie: Array(12).fill({ ship: 0, crew: 2 }) });
    const s = game3(map());
    place(s, 'A-ship', O, N);
    place(s, 'B-ship', neighbor(O, N));
    s.ships['B-ship']!.anchored = true;
    s.ships['B-ship']!.crew = s.ships['B-ship']!.crew.slice(0, 1);
    run(s, (m) => stepShip(m, s.ships['A-ship']!, N, 'row'), deadly);
    expect(s.ships['B-ship']!.status).toBe('sunk');
    expect(pos(s, 'A-ship')).toEqual(O);
  });
});

describe('steering and drift (rules §5.2 steps 2 and 5)', () => {
  it('turns by the Steer card: Ease 60°, Hard 120°, Hard About 180°; a damaged slot does nothing', () => {
    expect(STEER_TURNS).toEqual({ easePort: -1, easeStbd: 1, hardPort: -2, hardStbd: 2, hardAbout: 3 });
    const s = game3(map());
    place(s, 'A-ship', O, N);
    s.ships['A-ship']!.program = { steer1: card('half', 'hardStbd') };
    run(s, (m) => steerShip(m, s.ships['A-ship']!));
    expect(s.ships['A-ship']!.heading).toBe(SE);
    s.ships['A-ship']!.blocked = ['steer1'];
    run(s, (m) => steerShip(m, s.ships['A-ship']!));
    expect(s.ships['A-ship']!.heading).toBe(SE);
    s.ships['A-ship']!.blocked = [];
    s.ships['A-ship']!.program = { steer1: card('half', 'easePort') };
    run(s, (m) => steerShip(m, s.ships['A-ship']!));
    expect(s.ships['A-ship']!.heading).toBe(NE);
  });

  it('drift moves 1 hex downwind, heading unchanged', () => {
    const s = game3(map());
    setWeather(s, 'strong', SW);
    place(s, 'A-ship', O, N);
    run(s, (m) => driftShip(m, s.ships['A-ship']!));
    expect(pos(s, 'A-ship')).toEqual(neighbor(O, SW));
    expect(s.ships['A-ship']!.heading).toBe(N);
  });
});

describe('a whole turn (rules §5.2)', () => {
  const g = createGame();

  it('ships move in Sail initiative order (higher first; empty slot last)', () => {
    const s = game3(map());
    s.ships['A-ship']!.program = { sail1: '400' };
    s.ships['B-ship']!.program = { sail1: '900' };
    expect(sailOrder(s, 1, DEFAULT_CONFIG).map((x) => x.id)).toEqual(['B-ship', 'A-ship', 'C-ship']);
    s.ships['B-ship']!.status = 'sunk';
    expect(sailOrder(s, 1, DEFAULT_CONFIG).map((x) => x.id)).toEqual(['A-ship', 'C-ship']);
  });

  it('sails, steers and drifts through Parts I–III, and Gale damage arrives at Upkeep', () => {
    let s = game3(map(), CALM_WEATHER, false);
    setWeather(s, 'gale', SE);
    place(s, 'A-ship', hex(-4, 2), NE);
    place(s, 'B-ship', hex(-3, 0), N);
    const full = s.deck.find((id) => TEST_CARDS.find((c) => c.id === id)?.sail === 'full')!;
    s.deck = s.deck.filter((id) => id !== full);
    s.ships['A-ship']!.hand.push(full);
    s = g.apply(s, 'A', { type: 'place', ship: 'A-ship', slot: 'sail1', card: full }).state;
    s = g.apply(s, 'A', { type: 'ready' }).state;
    let out = g.apply(s, 'B', { type: 'ready' });
    const events = [...out.events];
    while (out.state.pending) {
      out = g.apply(out.state, out.state.pending.player, { type: 'answer', choice: out.state.pending.defaultIndex });
      events.push(...out.events);
    }
    expect(events.filter((e) => e.type === 'DamageRolled' && e.source === 'gale')).toHaveLength(1);
    expect(events.filter((e) => e.type === 'ShipMoved' && e.ship === 'A-ship' && e.cause === 'sail')).toHaveLength(4);
    expect(events.filter((e) => e.type === 'ShipMoved' && e.ship === 'B-ship' && e.cause === 'drift').length).toBeGreaterThan(0);
    expect(out.state.ships['A-ship']!.galeParts).toBe(0);
    expect(out.state.ships['A-ship']!.pos).toEqual(hex(3, -2));
    expect(out.state.ships['B-ship']!.pos).toEqual(hex(0, 0));
  });

  it('a ship pushed off the map before her own move doesn’t move, steer or drift', () => {
    let s = game3(map(), CALM_WEATHER, false);
    setWeather(s, 'gale', N);
    place(s, 'A-ship', hex(0, -4), S);
    place(s, 'B-ship', hex(0, -3), N);
    const take = (player: string, ship: string, pred: (c: CommandCard) => boolean, slot: string) => {
      const id = TEST_CARDS.find((c) => pred(c) && !Object.values(s.ships).some((x) => x.hand.includes(c.id)))!.id;
      s.deck = s.deck.filter((x) => x !== id);
      s.ships[ship]!.hand.push(id);
      s = g.apply(s, player, { type: 'place', ship, slot, card: id }).state;
    };
    take('B', 'B-ship', (c) => c.sail === 'rowAhead', 'sail1');
    take('A', 'A-ship', (c) => c.sail === 'half', 'steer1'); // A has no Sail card (initiative 0), so B moves first
    s = g.apply(s, 'A', { type: 'ready' }).state;
    let out = g.apply(s, 'B', { type: 'ready' });
    const events = [...out.events];
    while (out.state.pending) {
      out = g.apply(out.state, out.state.pending.player, { type: 'answer', choice: out.state.pending.defaultIndex });
      events.push(...out.events);
    }
    const sank = events.findIndex((e) => e.type === 'ShipSank' && e.ship === 'A-ship');
    expect(sank).toBeGreaterThan(-1);
    expect(events.slice(sank).some((e) => 'ship' in e && e.ship === 'A-ship' && e.type !== 'ShipSank')).toBe(false);
  });

  it('parses hex keys', () => {
    expect(parseHexKey('2,-3')).toEqual(hex(2, -3));
    expect(opposite(N)).toBe(S);
    expect(NW).toBe(5);
  });
});
