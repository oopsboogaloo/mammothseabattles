/**
 * Weather cards and the weather board (rules §3.5, §6.4): six spaces in a ring, one of them "now";
 * each space is also a tide level (High, Mid, Mid, Low, Mid, Mid).
 * At Upkeep the board advances one space (§5.4 step 7); the card leaving "now" is discarded and its space refilled (v0.137).
 */

import { Rng, type RngState } from '@msb/engine';
import type { Direction } from '@msb/hex';
import type { Weather, WindStrength } from './sailing';

export interface WeatherCard {
  readonly id: string;
  /** 'newFront' = New Weather Front: reshuffle the weather deck and deal new cards, including this one (§3.5). */
  readonly strength: WindStrength | 'newFront';
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

const STRENGTHS: readonly WeatherCard['strength'][] = ['deadCalm', 'light', 'firm', 'strong', 'gale', 'newFront'];

/**
 * Throws if a weather deck can't be used: duplicate ids, an unknown strength (the storm cards aren't supported yet), a wind other
 * than Dead Calm or New Weather Front without a direction, or New Weather Front cards only.
 */
export function validateWeatherCards(cards: readonly WeatherCard[]): void {
  const ids = new Set<string>();
  for (const card of cards) {
    if (ids.has(card.id)) throw new Error(`Duplicate weather card id ${card.id}`);
    ids.add(card.id);
    if (!STRENGTHS.includes(card.strength)) throw new Error(`Weather card ${card.id}: unsupported strength ${String(card.strength)}`);
    if (card.strength !== 'deadCalm' && card.strength !== 'newFront' && card.direction === undefined) throw new Error(`Weather card ${card.id} has no wind direction`);
  }
}

/** §3.5: shuffle the weather deck, fill the 6 spaces, and pick a random space as "now" (starting tide: random). */
export function setUpWeather(cards: readonly WeatherCard[], rngState: RngState): { board: WeatherBoard; rng: RngState } {
  if (cards.length < 6) throw new Error('The weather deck needs at least 6 cards (rules §3.5)');
  validateWeatherCards(cards);
  const rng = new Rng(rngState);
  const deck = rng.shuffle(cards.map((c) => c.id));
  const spaces = deck.splice(0, 6);
  const board: WeatherBoard = { spaces, now: rng.int(0, 5), deck, discards: [] };
  resolveNewFront(board, cards, rng);
  return { board, rng: rng.state };
}

function isNewFront(id: string | undefined, cards: readonly WeatherCard[]): boolean {
  return cards.find((c) => c.id === id)?.strength === 'newFront';
}

/**
 * §3.5 New Weather Front: when it becomes "now", reshuffle all the weather cards (this one included) and deal 6 new ones.
 * Repeats if the new "now" is a New Weather Front again. Returns how many times it happened.
 */
export function resolveNewFront(board: WeatherBoard, cards: readonly WeatherCard[], rng: Rng): number {
  let fronts = 0;
  while (isNewFront(board.spaces[board.now], cards)) {
    if (cards.every((c) => c.strength === 'newFront')) throw new Error('The weather deck needs some wind cards');
    fronts++;
    const all = rng.shuffle([...board.spaces, ...board.deck, ...board.discards]);
    board.spaces = all.splice(0, 6);
    board.deck = all;
    board.discards = [];
  }
  return fronts;
}

/** §5.4 step 7: advance one space. The card leaving "now" is discarded and its space refilled from the deck (§3.5, v0.137). */
export function advanceWeather(board: WeatherBoard, cards: readonly WeatherCard[], rng: Rng): { fronts: number } {
  const old = board.now;
  board.discards.push(board.spaces[old] as string);
  if (board.deck.length === 0) {
    board.deck = rng.shuffle(board.discards);
    board.discards = [];
  }
  board.spaces[old] = board.deck.shift() as string;
  board.now = (old + 1) % 6;
  return { fronts: resolveNewFront(board, cards, rng) };
}

export function tide(board: WeatherBoard): Tide {
  return TIDE_BY_SPACE[board.now] as Tide;
}

/** The weather now, as the sailing rules use it. */
export function currentWeather(board: WeatherBoard, cards: readonly WeatherCard[]): Weather {
  const id = board.spaces[board.now];
  const card = cards.find((c) => c.id === id) as WeatherCard;
  // New Weather Front never stays "now" (resolveNewFront), so this card is a wind.
  return { strength: card.strength as WindStrength, direction: card.direction ?? 0 };
}
