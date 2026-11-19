/**
 * Weather cards and the weather board (rules §3.5, §6.4): six spaces in a ring, one of them "now";
 * each space is also a tide level (High, Mid, Mid, Low, Mid, Mid).
 * Advancing the board at Upkeep comes in step P6; New Weather Front with it.
 */

import { Rng, type RngState } from '@msb/engine';
import type { Direction } from '@msb/hex';
import type { Weather, WindStrength } from './sailing';

export interface WeatherCard {
  readonly id: string;
  readonly strength: WindStrength;
  /** The wind blows towards this direction. Dead Calm has none. */
  readonly direction?: Direction;
}

export type Tide = 'high' | 'mid' | 'low';

/** §3.5: tide for each space of the weather board, starting at the top space. */
export const TIDE_BY_SPACE: readonly Tide[] = ['high', 'mid', 'mid', 'low', 'mid', 'mid'];

export interface WeatherBoard {
  /** Card id on each of the 6 spaces. */
  spaces: string[];
  /** The space that is "now" (0 = top, High tide). */
  now: number;
  deck: string[];
  discards: string[];
}

const STRENGTHS: readonly WindStrength[] = ['deadCalm', 'light', 'firm', 'strong', 'gale'];

/**
 * Throws if a weather deck can't be used: duplicate ids, an unknown strength (New Weather Front and the storm cards aren't
 * supported yet: step P6 and later), or a wind other than Dead Calm without a direction.
 */
export function validateWeatherCards(cards: readonly WeatherCard[]): void {
  const ids = new Set<string>();
  for (const card of cards) {
    if (ids.has(card.id)) throw new Error(`Duplicate weather card id ${card.id}`);
    ids.add(card.id);
    if (!STRENGTHS.includes(card.strength)) throw new Error(`Weather card ${card.id}: unsupported strength ${String(card.strength)}`);
    if (card.strength !== 'deadCalm' && card.direction === undefined) throw new Error(`Weather card ${card.id} has no wind direction`);
  }
}

/** §3.5: shuffle the weather deck, fill the 6 spaces, and pick a random space as "now" (starting tide: random). */
export function setUpWeather(cards: readonly WeatherCard[], rngState: RngState): { board: WeatherBoard; rng: RngState } {
  if (cards.length < 6) throw new Error('The weather deck needs at least 6 cards (rules §3.5)');
  validateWeatherCards(cards);
  const rng = new Rng(rngState);
  const deck = rng.shuffle(cards.map((c) => c.id));
  const spaces = deck.splice(0, 6);
  const now = rng.int(0, 5);
  return { board: { spaces, now, deck, discards: [] }, rng: rng.state };
}

export function tide(board: WeatherBoard): Tide {
  return TIDE_BY_SPACE[board.now] as Tide;
}

/** The weather now, as the sailing rules use it. */
export function currentWeather(board: WeatherBoard, cards: readonly WeatherCard[]): Weather {
  const id = board.spaces[board.now];
  const card = cards.find((c) => c.id === id) as WeatherCard;
  return { strength: card.strength, direction: card.direction ?? 0 };
}
