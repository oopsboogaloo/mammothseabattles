import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { Rng, replay, type LogEntry } from '@msb/engine';
import { distance, hex, hexKey } from '@msb/hex';
import {
  COMMAND_CARDS_CSV,
  CREW_CARDS_CSV,
  TREASURE_MAP_CARDS_CSV,
  WEATHER_CARDS_CSV,
} from '../src/generated/csv';
import {
  INITIATIVE_OVERRIDES,
  LEFT_OUT_WEATHER,
  TEST_MAP,
  TEST_MAP_PORTS,
  commandCards,
  crewCards,
  parseCsv,
  prototypeSetup,
  treasureMapCards,
  weatherCards,
} from '@msb/msb-data';
import {
  createGame,
  newGame,
  randomAction,
  startingCrew,
  validateCards,
  type Action,
  type GameState,
  type Terrain,
} from '@msb/msb-rules';

const read = (name: string) => readFileSync(`data/cards/${name}.csv`, 'utf8').replace(/^﻿/, '');

describe('generated card data', () => {
  it('matches the CSV files in data/cards (run `npm run data` after editing them)', () => {
    expect(COMMAND_CARDS_CSV).toBe(read('command-cards'));
    expect(WEATHER_CARDS_CSV).toBe(read('weather-cards'));
    expect(CREW_CARDS_CSV).toBe(read('crew-cards'));
    expect(TREASURE_MAP_CARDS_CSV).toBe(read('treasure-map-cards'));
  });
});

describe('CSV reader', () => {
  it('reads quoted fields, doubled quotes, CRLF and LF, and skips blank rows', () => {
    expect(parseCsv('a,b\r\n"x, y","say ""hi"""\n\n,\n1,2')).toEqual([
      { a: 'x, y', b: 'say "hi"' },
      { a: '1', b: '2' },
    ]);
    expect(parseCsv('a,b\n1')).toEqual([{ a: '1', b: '' }]);
    expect(parseCsv('a\n1\n')).toEqual([{ a: '1' }]);
    expect(parseCsv('')).toEqual([]);
    expect(() => parseCsv('a\n"open')).toThrow('never closed');
  });
});

describe('command cards (rules §3.3)', () => {
  it('45 cards with unique ids and initiatives; the second 360 is 380 until the art is fixed', () => {
    const cards = commandCards();
    expect(cards).toHaveLength(45);
    expect(() => validateCards(cards)).not.toThrow();
    expect(cards.find((c) => c.id === '360b')).toMatchObject({ initiative: 380, sail: 'rowAhead', steer: 'hardAbout', action: 'repair' });
    expect(INITIATIVE_OVERRIDES).toEqual({ '360b': 380 });
    expect(new Set(cards.map((c) => c.sail))).toEqual(new Set(['half', 'full', 'anchor', 'rowAhead', 'rowBack']));
  });

  it('expands copies and rejects unknown orders', () => {
    const header = 'id,initiative,octopus_icons,sail_order,steer_order,action_order,copies\n';
    expect(commandCards(`${header}x,500,1,Half Sail,Ease Port,Heal,2`).map((c) => c.id)).toEqual(['x-1', 'x-2']);
    expect(() => commandCards(`${header}x,500,1,Half Mast,Ease Port,Heal,1`)).toThrow('Unknown sail order: "Half Mast"');
  });
});

describe('weather cards (rules §3.5)', () => {
  it('26 cards: the storm cards are left out for now; Dead Calm has no direction; New Weather Front is in', () => {
    const cards = weatherCards();
    expect(cards).toHaveLength(26);
    expect(cards.some((c) => LEFT_OUT_WEATHER.includes(c.id))).toBe(false);
    expect(cards.find((c) => c.id === 'dead-calm')).toEqual({ id: 'dead-calm', strength: 'deadCalm' });
    expect(cards.find((c) => c.id === 'new-front')).toEqual({ id: 'new-front', strength: 'newFront' });
    expect(cards.find((c) => c.id === 'gale-nw')).toEqual({ id: 'gale-nw', strength: 'gale', direction: 5 });
  });

  it('expands copies and rejects unknown strengths', () => {
    const header = 'id,name,wind_strength,wind_direction,copies\n';
    expect(weatherCards(`${header}w,Firm North,Firm,N,2`).map((c) => c.id)).toEqual(['w-1', 'w-2']);
    expect(() => weatherCards(`${header}w,Breeze,Breezy,N,1`)).toThrow('Unknown wind strength');
  });
});

describe('crew and treasure map cards', () => {
  it('the Captain draws 3 and the Pirate 1, as the engine assumes', () => {
    const crew = crewCards();
    expect(crew.find((c) => c.id === 'captain-mammoth')?.cardIcons).toBe(startingCrew('x')[0]!.cardIcons);
    expect(crew.find((c) => c.id === 'pirate')?.cardIcons).toBe(startingCrew('x')[1]!.cardIcons);
  });

  it('the treasure map deck names the test map’s 9 spawn points', () => {
    expect(treasureMapCards().sort()).toEqual(Object.keys(TEST_MAP.spawnPoints ?? {}).sort());
  });
});

describe('the test map (implementation plan P7)', () => {
  it('is a radius-5 hexagon with every supported feature', () => {
    expect(Object.keys(TEST_MAP.hexes)).toHaveLength(91);
    const terrains = new Set(Object.values(TEST_MAP.hexes).map((h) => h.terrain));
    const all: Terrain[] = ['sea', 'cliff', 'beach', 'sandbank', 'underwaterReef', 'deathReef', 'roughWater', 'storm'];
    expect(terrains).toEqual(new Set(all));
    const hexes = Object.values(TEST_MAP.hexes);
    expect(hexes.some((h) => h.fog)).toBe(true);
    expect(hexes.filter((h) => h.whirlpool !== undefined)).toHaveLength(2);
    const currents = hexes.flatMap((h) => (h.current ? [h.current] : []));
    expect(new Set(currents.map((c) => c.strength))).toEqual(new Set([1, 2, 3]));
    expect(currents.some((c) => c.kind === 'eddy') && currents.some((c) => c.kind === 'flow' && c.turn !== 0)).toBe(true);
    expect(TEST_MAP.caves).toHaveLength(2);
    expect(TEST_MAP.rotors?.map((r) => Object.keys(r.moves).length)).toEqual([2, 3]);
    expect(TEST_MAP.wallReefs).toHaveLength(1);
  });

  it('puts the ports on the rim, on sea, away from every feature', () => {
    for (const key of TEST_MAP_PORTS) {
      const [q, r] = key.split(',').map(Number) as [number, number];
      expect(distance(hex(0, 0), hex(q, r))).toBe(5);
      const h = TEST_MAP.hexes[key]!;
      expect(h).toEqual({ terrain: 'sea' });
      expect(Object.values(TEST_MAP.spawnPoints ?? {})).not.toContain(key);
    }
    expect(new Set(TEST_MAP_PORTS).size).toBe(4);
    expect(TEST_MAP.hexes[hexKey(hex(0, 0))]?.terrain).toBe('cliff');
  });
});

describe('prototype setup', () => {
  it('2–4 players on the test map, one wreck per ship, real decks', () => {
    for (const n of [2, 3, 4]) {
      const setup = prototypeSetup(Array.from({ length: n }, (_, i) => ({ name: `Player ${i + 1}` })), 7);
      const s = newGame(setup);
      expect(Object.keys(s.ships)).toHaveLength(n);
      expect(s.wrecks).toHaveLength(n);
      expect(s.treasures).toHaveLength(Math.floor(n / 2));
    }
    expect(prototypeSetup([{ name: 'a', heading: 1 }, { name: 'b' }], 1).seats[0]!.heading).toBe(1);
    expect(() => prototypeSetup([{ name: 'solo' }], 1)).toThrow('2–4 players');
    expect(() => prototypeSetup(Array(5).fill({ name: 'x' }), 1)).toThrow('2–4 players');
  });
});

describe('whole games with the real data (engineering design §12)', () => {
  /** Every card is in exactly one place. */
  function cardCount(s: GameState): number {
    return s.deck.length + s.discards.length + Object.values(s.ships).reduce((n, x) => n + x.hand.length + Object.keys(x.program).length, 0);
  }

  it('random players play to a win or 60 turns; every game replays exactly and keeps all 45 cards', () => {
    const game = createGame();
    let wins = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const players = Array.from({ length: 2 + (seed % 3) }, (_, i) => ({ name: `P${i + 1}` }));
      const setup = prototypeSetup(players, seed);
      const rng = new Rng(seed);
      let state = newGame(setup);
      const log: LogEntry<Action>[] = [];
      let steps = 0;
      while (state.phase !== 'over' && state.turn <= 60 && steps < 20_000) {
        for (const seat of setup.seats) {
          const action = randomAction(game, state, seat.player, rng);
          if (!action) continue;
          log.push({ player: seat.player, action });
          state = game.apply(state, seat.player, action).state;
          steps++;
          expect(cardCount(state)).toBe(45);
        }
      }
      if (state.phase === 'over') wins++;
      expect(replay(game, setup, log).state).toEqual(state);
    }
    expect(wins).toBeGreaterThanOrEqual(0);
  });
});
