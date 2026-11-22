import { describe, expect, it } from 'vitest';
import { Rng, replay, type LogEntry } from '@msb/engine';
import { Direction, hex, hexKey } from '@msb/hex';
import {
  DEFAULT_CONFIG,
  HIDDEN,
  SLOT_KEYS,
  createGame,
  makeConfig,
  freeSlots,
  newGame,
  randomAction,
  validateCards,
  type Action,
  type GameEvent,
  type GameSetup,
  type GameState,
  type Terrain,
} from '@msb/msb-rules';
import { CALM_WEATHER, TEST_CARDS } from './fixtures';

// These tests count cards dealt to a 3-person crew (the pre-v0.152 size); the default of 4 is tested in game.test.ts.
const THREE_CREW = makeConfig({ startingCrew: 3 });
const game = createGame(THREE_CREW);

function setup(seed = 3, portTerrain: Terrain = 'sea', sameTeam = false): GameSetup {
  return {
    seed,
    // A's station (0,0) has the given terrain; ships start at their stations, out of port (§8.2.4 shelters ships in port).
    map: {
      id: 't',
      hexes: {
        [hexKey(hex(0, 0))]: { terrain: portTerrain },
        [hexKey(hex(4, 0))]: { terrain: 'sea' },
        [hexKey(hex(0, 2))]: { terrain: 'sea' },
        [hexKey(hex(4, 2))]: { terrain: 'sea' },
      },
    },
    seats: [
      { player: 'A', team: 'red', name: 'Ann', homePort: hex(0, 2), heading: Direction.N },
      { player: 'B', team: sameTeam ? 'red' : 'blue', name: 'Bob', homePort: hex(4, 2), heading: Direction.S },
    ],
    commandCards: TEST_CARDS,
    weatherCards: CALM_WEATHER,
  };
}

/** A new game with the ships moved out of port to their stations. */
function start(setup: GameSetup): GameState {
  const s = newGame(setup, THREE_CREW);
  s.ships['A-ship']!.pos = hex(0, 0);
  s.ships['B-ship']!.pos = hex(4, 0);
  return s;
}

/** Every card is in exactly one place: deck, a hand, a program or the discards. */
function allCards(state: GameState): string[] {
  const cards = [...state.deck, ...state.discards];
  for (const ship of Object.values(state.ships)) cards.push(...ship.hand, ...Object.values(ship.program));
  return cards.sort();
}
const ALL_IDS = TEST_CARDS.map((c) => c.id).sort();

describe('dealing (rules §5.1)', () => {
  it('shuffles the deck and deals each ship one card per icon on her healthy crew', () => {
    const s = start(setup());
    expect(s.ships['A-ship']?.hand).toHaveLength(5); // Captain 3 + 2 Pirates
    expect(s.ships['B-ship']?.hand).toHaveLength(5);
    expect(s.deck).toHaveLength(35);
    expect(allCards(s)).toEqual(ALL_IDS);
    expect(start(setup(4)).deck).not.toEqual(s.deck);
  });

  it('rejects a card list with duplicate ids or initiatives', () => {
    const [a, b] = TEST_CARDS as [(typeof TEST_CARDS)[0], (typeof TEST_CARDS)[0]];
    expect(() => validateCards([a, { ...b, id: a.id }])).toThrow('Duplicate card id');
    expect(() => validateCards([a, { ...b, initiative: a.initiative }])).toThrow('not unique');
    expect(() => newGame({ ...setup(), commandCards: [a, a] })).toThrow();
  });
});

describe('placing cards (rules §3.4, §5.1)', () => {
  it('places a card from the hand into an empty slot and takes it back', () => {
    const s0 = start(setup());
    const card = s0.ships['A-ship']!.hand[0]!;
    const s1 = game.apply(s0, 'A', { type: 'place', ship: 'A-ship', slot: 'sail1', card }).state;
    expect(s1.ships['A-ship']!.program).toEqual({ sail1: card });
    expect(s1.ships['A-ship']!.hand).not.toContain(card);
    expect(s0.ships['A-ship']!.hand).toContain(card); // the old state is untouched
    expect(game.legalActions(s1, 'A')).not.toContainEqual({ type: 'place', ship: 'A-ship', slot: 'sail1', card: s1.ships['A-ship']!.hand[0] });
    const s2 = game.apply(s1, 'A', { type: 'remove', ship: 'A-ship', slot: 'sail1' }).state;
    expect(s2.ships['A-ship']!.program).toEqual({});
    expect(s2.ships['A-ship']!.hand).toContain(card);
  });

  it('only into the player’s own ships, free slots, and cards in her hand', () => {
    const s0 = start(setup());
    const bCard = s0.ships['B-ship']!.hand[0]!;
    expect(() => game.apply(s0, 'A', { type: 'place', ship: 'B-ship', slot: 'sail1', card: bCard })).toThrow('Illegal');
    expect(() => game.apply(s0, 'A', { type: 'place', ship: 'A-ship', slot: 'sail1', card: bCard })).toThrow('Illegal');
    expect(() => game.apply(s0, 'A', { type: 'remove', ship: 'A-ship', slot: 'sail1' })).toThrow('Illegal');
  });

  it('a slot with a damage marker takes no card (rules §7.3)', () => {
    const s = start(setup());
    s.ships['A-ship']!.blocked = ['steer2'];
    expect(freeSlots(s.ships['A-ship']!)).not.toContain('steer2');
    expect(freeSlots(s.ships['A-ship']!)).toHaveLength(8);
    expect(SLOT_KEYS).toHaveLength(9);
  });

  it('a sunk ship can’t be programmed', () => {
    const s = start(setup());
    s.ships['A-ship']!.status = 'sunk';
    expect(game.legalActions(s, 'A')).toEqual([{ type: 'ready' }]);
  });

  it('a hand over 9 must be discarded down before the player can be ready', () => {
    const s0 = start(setup());
    const extra = s0.deck.splice(0, 6);
    s0.ships['A-ship']!.hand.push(...extra); // 11 cards
    const legal = game.legalActions(s0, 'A');
    expect(legal).not.toContainEqual({ type: 'ready' });
    expect(legal.filter((a) => a.type === 'discard')).toHaveLength(11);
    let s = s0;
    for (const card of s0.ships['A-ship']!.hand.slice(0, 2)) s = game.apply(s, 'A', { type: 'discard', ship: 'A-ship', card }).state;
    expect(s.ships['A-ship']!.hand).toHaveLength(DEFAULT_CONFIG.handLimit);
    expect(s.discards).toHaveLength(2);
    expect(game.legalActions(s, 'A')).toContainEqual({ type: 'ready' });
  });
});

describe('hidden programs, revealed Part by Part (D6, rules §5.1)', () => {
  function programmed(portTerrain: Terrain, seed = 3) {
    let s = start(setup(seed, portTerrain));
    const [a1, a2, a3] = s.ships['A-ship']!.hand as [string, string, string];
    const [b1, b3] = s.ships['B-ship']!.hand as [string, string];
    for (const [player, ship, slot, card] of [
      ['A', 'A-ship', 'sail1', a1],
      ['A', 'A-ship', 'steer2', a2],
      ['A', 'A-ship', 'action3', a3],
      ['B', 'B-ship', 'sail1', b1],
      ['B', 'B-ship', 'action3', b3],
    ] as const) {
      s = game.apply(s, player, { type: 'place', ship, slot, card }).state;
    }
    return { s, a1, a2, a3, b1, b3 };
  }

  it('rivals see which slots are filled and the hand size, never the cards, while programming', () => {
    const { s, a1 } = programmed('sea');
    const seenByB = game.view(s, 'B').ships['A-ship']!;
    expect(seenByB.program).toEqual({ sail1: HIDDEN, steer2: HIDDEN, action3: HIDDEN });
    expect(seenByB.hand).toBeUndefined();
    expect(seenByB.handSize).toBe(2);
    expect(game.view(s, 'A').ships['A-ship']!.program['sail1']).toBe(a1);
    expect(game.view(s, 'A').deckSize).toBe(35);
  });

  it('teammates see each other’s hands and programs (rules §8.6)', () => {
    let s = start(setup(3, 'sea', true));
    const card = s.ships['A-ship']!.hand[0]!;
    s = game.apply(s, 'A', { type: 'place', ship: 'A-ship', slot: 'sail1', card }).state;
    expect(game.view(s, 'B').ships['A-ship']!.program).toEqual({ sail1: card });
    expect(game.view(s, 'B').ships['A-ship']!.hand).toHaveLength(4);
  });

  it('each Part’s cards are revealed as it starts; later Parts stay hidden while the turn is paused', () => {
    // A's port is in a storm, so the turn pauses for her damage in Part I (find a seed that does).
    for (let seed = 1; seed < 300; seed++) {
      const { s, a1, a2, b1 } = programmed('storm', seed);
      let out = game.apply(s, 'A', { type: 'ready' });
      out = game.apply(out.state, 'B', { type: 'ready' });
      const started = out.events.filter((e) => e.type === 'PartStarted');
      if (!out.state.pending || out.state.part !== 1) continue;
      expect(started).toHaveLength(1);
      expect(started[0]).toMatchObject({ part: 1, revealed: { 'A-ship': { sail: a1 }, 'B-ship': { sail: b1 } } });
      expect(game.view(out.state, 'B').ships['A-ship']!.program).toEqual({ sail1: a1, steer2: HIDDEN, action3: HIDDEN });
      // Answer everything; Part II then reveals A's Steer card.
      let state = out.state;
      const events: GameEvent[] = [];
      while (state.pending) {
        // Keep the damage off A's programmed slots, so her cards stay for the reveal.
        const d = state.pending;
        const free = d.options.findIndex((o) => !['sail1', 'steer2', 'action3'].includes(`${(o as { row?: string }).row}${(o as { part?: number }).part}`));
        const choice = d.kind === 'placeShipDamage' && free >= 0 ? free : d.defaultIndex;
        const r = game.apply(state, d.player, { type: 'answer', choice });
        state = r.state;
        events.push(...r.events);
      }
      expect(events.find((e) => e.type === 'PartStarted' && e.part === 2)).toMatchObject({ revealed: { 'A-ship': { steer: a2 } } });
      return;
    }
    throw new Error('no seed paused in Part I');
  });
});

describe('end of turn (rules §5.1 step 4, §5.4)', () => {
  it('used and discarded cards go to the bottom of the deck, programs are cleared, and ships draw again', () => {
    let s = start(setup());
    const card = s.ships['A-ship']!.hand[0]!;
    s = game.apply(s, 'A', { type: 'place', ship: 'A-ship', slot: 'action3', card }).state;
    const top = s.deck.slice(0, 10);
    s = game.apply(s, 'A', { type: 'ready' }).state;
    const out = game.apply(s, 'B', { type: 'ready' });
    const next = out.state;
    expect(next.ships['A-ship']!.program).toEqual({});
    expect(next.ships['A-ship']!.hand).toHaveLength(4 + 5);
    expect(next.ships['A-ship']!.hand.slice(4)).toEqual(top.slice(0, 5));
    expect(next.ships['B-ship']!.hand.slice(5)).toEqual(top.slice(5, 10));
    expect(next.deck.at(-1)).toBe(card);
    expect(out.events).toContainEqual({ type: 'CardsReturned', rule: '5.1', count: 1 });
    expect(allCards(next)).toEqual(ALL_IDS);
  });

  it('a sunk ship comes back at Upkeep and draws a new hand; draws stop when the deck is empty', () => {
    let s = start(setup());
    s.ships['B-ship']!.status = 'sunk';
    s.deck = s.deck.slice(0, 2);
    s = game.apply(s, 'A', { type: 'ready' }).state;
    let out = game.apply(s, 'B', { type: 'ready' });
    const events = [...out.events];
    expect(out.state.pending).toMatchObject({ kind: 'returnHeading', player: 'B' });
    while (out.state.pending) {
      out = game.apply(out.state, out.state.pending.player, { type: 'answer', choice: out.state.pending.defaultIndex });
      events.push(...out.events);
    }
    // B's old hand of 5 goes under the deck: 7 cards for A (5) and B (2 of her 3).
    expect(out.state.ships['A-ship']!.hand).toHaveLength(10);
    expect(out.state.ships['B-ship']!.hand).toHaveLength(2);
    expect(events.filter((e) => e.type === 'CardsDrawn').map((e) => (e as { count: number }).count)).toEqual([5, 2]);
    expect(out.state.ships['B-ship']!.crew.map((c) => [c.captain, c.cardIcons])).toEqual([[false, 1], [false, 1], [false, 1]]);
  });
});

describe('random players and fuzz tests (engineering design §10, §12)', () => {
  function play(seed: number, turns: number, terrain: Terrain) {
    const rng = new Rng(seed * 7919);
    let state = start(setup(seed, terrain));
    const log: LogEntry<Action>[] = [];
    while (state.turn <= turns) {
      for (const player of ['A', 'B']) {
        const action = randomAction(game, state, player, rng);
        if (!action) continue;
        log.push({ player, action });
        state = game.apply(state, player, action).state;
        // Invariants after every action.
        expect(allCards(state)).toEqual(ALL_IDS);
        for (const ship of Object.values(state.ships)) {
          for (const slot of Object.keys(ship.program)) expect(ship.blocked.includes(slot) && state.phase === 'programming').toBe(false);
        }
      }
    }
    return { state, log };
  }

  it('random games keep every card accounted for and replay exactly from their logs', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const { state, log } = play(seed, 4, seed % 2 ? 'storm' : 'roughWater');
      expect(replay({ ...game, init: start }, setup(seed, seed % 2 ? 'storm' : 'roughWater'), log).state).toEqual(state);
    }
  });

  it('returns nothing when the player has no legal action', () => {
    const s = start(setup());
    expect(randomAction(game, s, 'nobody', new Rng(1))).toBeUndefined();
  });
});
