import { describe, expect, it } from 'vitest';
import { replay, type LogEntry } from '@msb/engine';
import { Direction, hex, hexKey } from '@msb/hex';
import {
  DEFAULT_CONFIG,
  PLACE_CREW_DAMAGE,
  PLACE_SHIP_DAMAGE,
  createGame,
  defaultCrewIndex,
  defaultSlotIndex,
  endOfPartHazard,
  newGame,
  pendingDecision,
  type Action,
  type GameEvent,
  type GameMap,
  type GameSetup,
  type GameState,
  type ShipCrew,
  type Terrain,
} from '@msb/msb-rules';
import { CALM_WEATHER, TEST_CARDS } from './fixtures';

// A tiny test map: A's station is in rough water, B's in a storm (by default), plus open sea and the two ports.
// Ships start at their stations, not in port, because a ship in her own port is sheltered from all weather (§8.2.4).
const PORT_A = hex(0, 2);
const PORT_B = hex(3, 2);
function map(a: Terrain, b: Terrain): GameMap {
  return {
    id: 'test',
    hexes: {
      [hexKey(hex(0, 0))]: { terrain: a },
      [hexKey(hex(3, 0))]: { terrain: b },
      [hexKey(hex(1, 0))]: { terrain: 'sea' },
      [hexKey(PORT_A)]: { terrain: 'sea' },
      [hexKey(PORT_B)]: { terrain: 'sea' },
    },
  };
}

/** A new game with the ships moved from port to their stations. */
function start(setup: GameSetup): GameState {
  const s = newGame(setup);
  s.ships['A-ship']!.pos = hex(0, 0);
  s.ships['B-ship']!.pos = hex(3, 0);
  return s;
}

function setup(a: Terrain = 'roughWater', b: Terrain = 'sea', seed = 7): GameSetup {
  return {
    seed,
    map: map(a, b),
    seats: [
      { player: 'A', team: 'red', name: 'Ann', homePort: PORT_A, heading: Direction.N },
      { player: 'B', team: 'blue', name: 'Bob', homePort: PORT_B, heading: Direction.S },
    ],
    commandCards: TEST_CARDS,
    weatherCards: CALM_WEATHER,
  };
}

const game = createGame();

/** Ready both players, then answer every question with its default. Returns the log and all events. */
function playTurnWithDefaults(state: GameState): { state: GameState; log: LogEntry<Action>[]; events: GameEvent[] } {
  const log: LogEntry<Action>[] = [];
  const events: GameEvent[] = [];
  const act = (player: string, action: Action) => {
    log.push({ player, action });
    const out = game.apply(state, player, action);
    state = out.state;
    events.push(...out.events);
  };
  act('A', { type: 'ready' });
  act('B', { type: 'ready' });
  for (let d = pendingDecision(state); d; d = pendingDecision(state)) act(d.player, { type: 'answer', choice: d.defaultIndex });
  return { state, log, events };
}

describe('setup (rules §4; NFR-13 teams, players and ships separate)', () => {
  it('puts each ship in her home port, sail down, with a Captain and 2 crew', () => {
    const s = newGame(setup());
    expect(Object.keys(s.ships)).toEqual(['A-ship', 'B-ship']);
    expect(s.ships['A-ship']).toMatchObject({ pos: PORT_A, heading: Direction.N, sail: 'none', status: 'afloat', blocked: [] });
    expect(s.ships['A-ship']?.crew.map((c) => [c.cardIcons, c.captain])).toEqual([[3, true], [1, false], [1, false]]);
    expect(s.players['A']).toEqual({ id: 'A', team: 'red', name: 'Ann', ships: ['A-ship'] });
    expect(s.teams['red']).toEqual({ id: 'red', players: ['A'], homePort: PORT_A, score: 0, hold: [] });
  });

  it('lets two players share a team', () => {
    const base = setup();
    const s = newGame({ ...base, seats: base.seats.map((seat) => ({ ...seat, team: 'all' })) });
    expect(s.teams['all']?.players).toEqual(['A', 'B']);
  });

  it('needs a seat (1 is the Solo Challenge, §8.8) and distinct players', () => {
    const base = setup();
    expect(() => newGame({ ...base, seats: [] })).toThrow('at least 1');
    expect(Object.keys(newGame({ ...base, seats: base.seats.slice(0, 1) }).ships)).toEqual(['A-ship']);
    expect(() => newGame({ ...base, seats: [base.seats[0]!, base.seats[0]!] })).toThrow('Duplicate');
  });
});

describe('programming phase (rules §5.1; cards come in step P2)', () => {
  it('waits until every player is ready', () => {
    const s0 = start(setup('sea'));
    expect(game.legalActions(s0, 'A')).toContainEqual({ type: 'ready' });
    expect(game.legalActions(s0, 'nobody')).toEqual([]);
    const { state: s1, events } = game.apply(s0, 'A', { type: 'ready' });
    expect(events).toEqual([{ type: 'PlayerReady', rule: '5.1', player: 'A' }]);
    expect(game.legalActions(s1, 'A')).toEqual([]);
    expect(() => game.apply(s1, 'A', { type: 'ready' })).toThrow('Illegal');
  });

  it('resolves a quiet turn straight through to the next turn', () => {
    const { state, events } = playTurnWithDefaults(start(setup('sea')));
    expect(state.turn).toBe(2);
    expect(state.phase).toBe('programming');
    expect(state.ready).toEqual([]);
    expect(state.resolution).toBeUndefined();
    const P1_TYPES = ['PlayerReady', 'PartStarted', 'UpkeepStarted', 'CardsReturned', 'CardsDrawn', 'TurnStarted'];
    expect(events.map((e) => e.type).filter((t) => P1_TYPES.includes(t))).toEqual([
      'PlayerReady',
      'PlayerReady',
      'PartStarted',
      'PartStarted',
      'PartStarted',
      'UpkeepStarted',
      'CardsReturned',
      'CardsDrawn',
      'CardsDrawn',
      'TurnStarted',
    ]);
    expect(game.result(state)).toBeUndefined();
  });
});

describe('end of Part hazards (rules §5.2 step 6, §3.2.0)', () => {
  it('rough water deals 1 DD (v0.148) and a storm 3 DD; other terrain none', () => {
    const s = start(setup('roughWater', 'storm'));
    expect(endOfPartHazard(s, s.ships['A-ship']!, DEFAULT_CONFIG)).toEqual({ dd: 1, source: 'roughWater' });
    expect(endOfPartHazard(s, s.ships['B-ship']!, DEFAULT_CONFIG)).toEqual({ dd: 3, source: 'storm' });
    const off = { ...s.ships['A-ship']!, pos: hex(9, 9) };
    expect(endOfPartHazard(s, off, DEFAULT_CONFIG)).toBeUndefined();
  });
});

describe('decisions in the middle of resolution (engineering design §5, D1)', () => {
  // Find a seed where the first roll in rough water gives Ship damage, so the game must ask.
  function firstPause(): { seed: number; state: GameState; events: GameEvent[] } {
    for (let seed = 1; seed < 500; seed++) {
      let state = start(setup('roughWater', 'sea', seed));
      state = game.apply(state, 'A', { type: 'ready' }).state;
      const out = game.apply(state, 'B', { type: 'ready' });
      if (pendingDecision(out.state)?.kind === PLACE_SHIP_DAMAGE) return { seed, state: out.state, events: out.events };
    }
    throw new Error('no seed found');
  }

  it('stops, asks only the damaged ship’s player, and shows the options only to her', () => {
    const { state, events } = firstPause();
    expect(state.phase).toBe('resolving');
    const asked = events.at(-1);
    expect(asked).toMatchObject({ type: 'DecisionRequested', player: 'A', kind: PLACE_SHIP_DAMAGE });
    expect(events.some((e) => e.type === 'DamageRolled' && e.ship === 'A-ship')).toBe(true);
    expect(game.legalActions(state, 'B')).toEqual([]);
    expect(game.legalActions(state, 'A')).toHaveLength(9);
    expect(game.view(state, 'A').decision?.options).toHaveLength(9);
    expect(game.view(state, 'B').decision).toEqual({ player: 'A', kind: PLACE_SHIP_DAMAGE });
    expect(game.view(start(setup()), 'A').decision).toBeUndefined();
  });

  it('places the damage where the player chose and carries on', () => {
    const { state } = firstPause();
    const options = pendingDecision(state)!.options as { row: string; part: number }[];
    const choice = options.findIndex((o) => o.row === 'steer' && o.part === 3);
    const out = game.apply(state, 'A', { type: 'answer', choice });
    expect(out.events[0]).toEqual({ type: 'SlotBlocked', rule: '7.3', ship: 'A-ship', slot: 'steer3' });
    expect(() => game.apply(state, 'A', { type: 'answer', choice: 99 })).toThrow('Illegal');
  });

  it('is deterministic: replaying the log gives the same state and events', () => {
    const { seed } = firstPause();
    const played = playTurnWithDefaults(start(setup('roughWater', 'storm', seed)));
    const again = replay({ ...game, init: start }, setup('roughWater', 'storm', seed), played.log);
    expect(again.state).toEqual(played.state);
    expect(again.events).toEqual(played.events);
  });

  it('applies each point of damage once, in order, across many seeds', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const { state, events } = playTurnWithDefaults(start(setup('storm', 'roughWater', seed)));
      for (const ship of Object.values(state.ships)) {
        if (events.some((e) => e.type === 'ShipReturned' && e.ship === ship.id)) continue; // repaired on her return
        const blocked = events.filter((e) => e.type === 'SlotBlocked' && e.ship === ship.id).map((e) => (e as { slot: string }).slot);
        expect(blocked).toEqual(ship.blocked);
        expect(new Set(blocked).size).toBe(blocked.length);
      }
    }
  });
});

describe('sinking (rules §7.3, §7.4, §7.8)', () => {
  it('sinks a ship when a whole row is blocked or no crew are healthy, and stops dealing her damage', () => {
    const reasons = new Set<string>();
    for (let seed = 1; seed <= 200 && reasons.size < 2; seed++) {
      // Storms on both ports: 3 DD a Part, 9 DD a turn, over 3 turns.
      let state = start(setup('storm', 'storm', seed));
      const events: GameEvent[] = [];
      for (let turn = 0; turn < 3; turn++) {
        const out = playTurnWithDefaults(state);
        state = out.state;
        events.push(...out.events);
      }
      for (const e of events) {
        if (e.type !== 'ShipSank') continue;
        reasons.add(e.reason);
        const after = events.slice(events.indexOf(e) + 1);
        const back = after.findIndex((x) => x.type === 'ShipReturned' && x.ship === e.ship);
        expect(back).toBeGreaterThan(-1); // she comes back at Upkeep (§7.8)…
        const DAMAGE = ['DamageRolled', 'SlotBlocked', 'CrewWounded', 'CrewKilled'];
        expect(after.slice(0, back).some((x) => 'ship' in x && x.ship === e.ship && DAMAGE.includes(x.type))).toBe(false); // …and takes no damage until then
        expect(state.ships[e.ship]?.status).toBe('afloat');
      }
    }
    expect(reasons).toEqual(new Set(['row', 'crew']));
  });
});

describe('Crew damage (rules §7.4)', () => {
  it('a player may kill a wounded crew member instead of wounding a healthy one', () => {
    for (let seed = 1; seed < 300; seed++) {
      let state = start(setup('storm', 'sea', seed));
      state.ships['A-ship']!.crew[1] = { ...state.ships['A-ship']!.crew[1]!, state: 'wounded' };
      state = game.apply(state, 'A', { type: 'ready' }).state;
      let out = game.apply(state, 'B', { type: 'ready' });
      while (out.state.pending) {
        const d = out.state.pending;
        const kill = d.kind === PLACE_CREW_DAMAGE ? d.options.findIndex((o) => 'kill' in (o as object)) : -1;
        out = game.apply(out.state, d.player, { type: 'answer', choice: kill >= 0 ? kill : d.defaultIndex });
        const killed = out.events.find((e) => e.type === 'CrewKilled');
        if (killed) {
          expect(killed).toEqual({ type: 'CrewKilled', rule: '7.4', ship: 'A-ship', crew: 'A-ship-pirate-1' });
          return;
        }
      }
    }
    throw new Error('no seed gave Crew damage');
  });
});

describe('default answers (engineering design §5)', () => {
  it('Ship damage: avoid completing a row, then prefer Parts already resolved', () => {
    const options = [
      { row: 'sail', part: 3 },
      { row: 'steer', part: 1 },
      { row: 'action', part: 2 },
    ] as const;
    expect(defaultSlotIndex(options, [], 2)).toBe(1);
    expect(defaultSlotIndex(options, ['steer2', 'steer3'], 2)).toBe(0); // steer1 would sink her
    expect(defaultSlotIndex([{ row: 'sail', part: 1 }], ['sail2', 'sail3'], 1)).toBe(0);
  });

  it('Crew damage: wound before kill, Captain last', () => {
    const crew: ShipCrew[] = [
      { id: 'cap', state: 'healthy', cardIcons: 3, captain: true },
      { id: 'p1', state: 'wounded', cardIcons: 1, captain: false },
      { id: 'p2', state: 'healthy', cardIcons: 1, captain: false },
    ];
    expect(defaultCrewIndex([{ wound: 'cap' }, { kill: 'p1' }, { wound: 'p2' }], crew)).toBe(2);
    expect(defaultCrewIndex([{ wound: 'cap' }, { kill: 'p1' }], crew)).toBe(0);
    expect(defaultCrewIndex([{ kill: 'ghost' }], crew)).toBe(0);
  });

  it('exposes the decision kinds', () => {
    expect([PLACE_SHIP_DAMAGE, PLACE_CREW_DAMAGE]).toEqual(['placeShipDamage', 'placeCrewDamage']);
  });
});
