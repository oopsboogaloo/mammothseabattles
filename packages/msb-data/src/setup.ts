/**
 * A ready-made game setup for the hot-seat prototype: the real card decks and the test map (implementation plan P7).
 */

import type { Direction } from '@msb/hex';
import type { GameSetup } from '@msb/msb-rules';
import { commandCards, weatherCards } from './cards';
import { parseHexKey } from '@msb/msb-rules';
import { TEST_MAP, TEST_MAP_PORTS } from './test-map';

export interface PrototypePlayer {
  readonly name: string;
  /** Defaults to facing into the map. */
  readonly heading?: Direction;
}

/** Each port's default heading, pointing into the map (west port faces east, …). */
const INTO_MAP: readonly Direction[] = [2, 4, 3, 0];

/** 1–4 players (1 is the Solo Challenge, rules §8.8), one ship each, each on her own team, on the test map; one starting wreck per ship (rules §7.9). */
export function prototypeSetup(players: readonly PrototypePlayer[], seed: number): GameSetup {
  if (players.length < 1 || players.length > TEST_MAP_PORTS.length) {
    throw new Error(`The test map takes 1–${TEST_MAP_PORTS.length} players`);
  }
  return {
    seed,
    map: { ...TEST_MAP, startWrecks: (TEST_MAP.startWrecks as readonly string[]).slice(0, players.length) },
    seats: players.map((p, i) => ({
      player: `P${i + 1}`,
      team: `T${i + 1}`,
      name: p.name,
      homePort: parseHexKey(TEST_MAP_PORTS[i] as string),
      heading: p.heading ?? (INTO_MAP[i] as Direction),
    })),
    commandCards: commandCards(),
    weatherCards: weatherCards(),
  };
}
