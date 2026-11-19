/**
 * A random player (engineering design §10): picks random legal actions. Used for fuzz tests now and as the weakest AI later.
 * It never takes a card back, so programming always ends: it places random cards, discards if it must, then marks ready.
 */

import type { GameDef, Rng } from '@msb/engine';
import type { Action } from './game';
import type { GameState, PlayerId } from './state';

export function randomAction<View, Event, Setup, Result>(
  def: GameDef<GameState, Action, View, Event, Setup, Result>,
  state: GameState,
  player: PlayerId,
  rng: Rng,
): Action | undefined {
  const legal = def.legalActions(state, player);
  if (legal.length === 0) return undefined;
  const pick = <T>(items: readonly T[]): T => items[rng.int(0, items.length - 1)] as T;
  const of = (type: Action['type']) => legal.filter((a) => a.type === type);
  const answers = of('answer');
  if (answers.length > 0) return pick(answers);
  const discards = of('discard');
  if (discards.length > 0) return pick(discards);
  const places = of('place');
  if (places.length === 0 || rng.float() < 0.25) return { type: 'ready' };
  return pick(places);
}
