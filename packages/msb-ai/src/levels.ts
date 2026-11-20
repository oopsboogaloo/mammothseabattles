/**
 * Difficulty levels (engineering design §10).
 * - **Easy**: picks at random among its five best plans, so it often settles for second best.
 * - **Normal**: the Basic AI (plan.ts): the best plan assuming rivals stand still and average luck.
 * - **Hard** ("Good", Monte Carlo): takes Normal's best few plans and plays each against several sampled futures: rivals given
 *   plausible hands (dealt from the cards it can't see) and planning with the Basic AI, and different dice. It picks the plan that
 *   does best on average, so it expects to be shot at and rammed.
 * All levels play fair (no peeking at hands or dice) and are deterministic: the same position always gives the same choice.
 */

import { Rng } from '@msb/engine';
import type { GameState, Player, PlayerId, RulesConfig, Ship } from '@msb/msb-rules';
import { distanceMap } from './distance';
import { determinize, evaluate, goals, planningWeather, rankPrograms, simulate, type Program } from './plan';

export type AiLevel = 'easy' | 'normal' | 'hard';
export const AI_LEVELS: readonly AiLevel[] = ['easy', 'normal', 'hard'];

/** Easy: how many of its best plans it picks among at random. */
export const EASY_CHOICES = 5;

/** Hard: how many of Normal's plans to test, and against how many sampled futures. */
export const HARD = { candidates: 5, samples: 4 } as const;

/** A seed for this player's choices in this position (fixed, but different for each player and each turn). */
export function seedFor(state: GameState, player: PlayerId): number {
  let h = state.rng | 0;
  for (const c of player) h = Math.imul(h ^ c.charCodeAt(0), 2654435761);
  return ((h ^ Math.imul(state.turn, 0x9e3779b9)) | 1) >>> 0;
}

/**
 * One possible world as this player sees it: rivals' hands dealt at random from the cards this player can't see (the deck and
 * the rivals' real hands, pooled), their programs planned by the Basic AI with those hands, and a different dice stream.
 */
export function sampleWorld(state: GameState, player: PlayerId, config: RulesConfig, rng: Rng): GameState {
  const world = determinize(state, player);
  const team = (world.players[player] as Player).team;
  const rivals = Object.values(world.ships).filter((s) => (world.players[s.player] as Player).team !== team && s.status === 'afloat');
  // A rival who has already programmed holds those cards too (the slots show as filled, not which cards): put them back in the
  // pool and deal her a hand of her full size, so she isn't imagined short of cards.
  const placed = (id: string) => Object.values((state.ships[id] as Ship).program);
  const unseen = rng.shuffle([...world.deck, ...rivals.flatMap((s) => [...s.hand, ...placed(s.id)])]);
  for (const ship of rivals) ship.hand = unseen.splice(0, ship.hand.length + placed(ship.id).length);
  for (const ship of rivals) if (!ship.refitting) ship.program = (rankPrograms(world, ship.id, config, 1)[0] as { program: Program }).program;
  world.rng = ((rng.int(1, 0x7fffffff) ^ world.rng) | 1) >>> 0;
  return world;
}

/** The program a ship's player chooses at this level. */
export function chooseProgram(state: GameState, shipId: string, config: RulesConfig, level: AiLevel): Program {
  const ship = state.ships[shipId] as Ship;
  const rng = new Rng(seedFor(state, ship.player));
  if (level === 'easy') {
    const ranked = rankPrograms(state, shipId, config, EASY_CHOICES);
    return (ranked[rng.int(0, ranked.length - 1)] as { program: Program }).program;
  }
  if (level === 'normal') return (rankPrograms(state, shipId, config)[0] as { program: Program }).program;
  const candidates = rankPrograms(state, shipId, config, HARD.candidates);
  const weather = planningWeather(state);
  const dist = distanceMap(state, goals(state, ship), weather, config);
  const totals = candidates.map(() => 0);
  for (let i = 0; i < HARD.samples; i++) {
    const world = sampleWorld(state, ship.player, config, rng);
    candidates.forEach((c, k) => {
      totals[k]! += evaluate(world, simulate(world, shipId, c.program, config), shipId, dist, c.program, weather);
    });
  }
  return (candidates[bestIndex(totals)] as { program: Program }).program;
}

/** The index of the largest value (the first, on a tie). */
export function bestIndex(values: readonly number[]): number {
  let best = 0;
  values.forEach((v, k) => {
    if (v > (values[best] as number)) best = k;
  });
  return best;
}
