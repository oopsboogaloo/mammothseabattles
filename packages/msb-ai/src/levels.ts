/**
 * Difficulty levels (engineering design §10).
 * - **Easy**: thinks one move ahead, like a beginner: it plans Part I properly, then fills Parts II and III with random cards.
 * - **Normal**: the Basic AI (plan.ts): the best plan assuming rivals stand still and average luck.
 * - **Hard** ("Good", Monte Carlo): takes Normal's best few plans and plays each against several sampled futures: rivals given
 *   plausible hands (dealt from the cards it can't see) and planning with the Basic AI, and different dice. It picks the plan that
 *   does best on average, so it expects to be shot at and rammed.
 * All levels play fair (no peeking at hands or dice) and are deterministic: the same position always gives the same choice.
 */

import { Rng } from '@msb/engine';
import { freeSlots, type Weather, type GameState, type Player, type PlayerId, type RulesConfig, type Ship } from '@msb/msb-rules';
import { distanceMap } from './distance';
import type { DistanceMap } from './distance';
import { determinize, evaluate, goals, planningWeather, rankPrograms, simulate, type Program } from './plan';
import { BALANCED, type Style } from './weights';

export type AiLevel = 'easy' | 'normal' | 'hard';
export const AI_LEVELS: readonly AiLevel[] = ['easy', 'normal', 'hard'];

/** Easy: how likely it is to put a card in each later slot it hasn't thought about. */
export const EASY_FILL = 0.6;

/** Hard: how many of Normal's plans to test, and against how many sampled futures. */
export const HARD = { candidates: 5, samples: 4, lookAhead: 0.5 } as const;

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
  // What's left is the deck, in an order this player can't know (so looking ahead can't foresee the next draw).
  world.deck = unseen;
  for (const ship of rivals) if (!ship.refitting) ship.program = (rankPrograms(world, ship.id, config, 1)[0] as { program: Program }).program;
  world.rng = ((rng.int(1, 0x7fffffff) ^ world.rng) | 1) >>> 0;
  return world;
}

/**
 * Hard looks two turns ahead: the score of this turn's plan, plus part of the best score it could then get next turn (planned the
 * Basic way, narrow search), so a plan that sets up a good next turn beats one that only looks good now.
 */
export function lookAhead(world: GameState, shipId: string, program: Program, config: RulesConfig, style: Style, dist: DistanceMap, weather: Weather): number {
  const sim = simulate(world, shipId, program, config);
  const now = evaluate(world, sim, shipId, dist, program, weather, style.weights);
  if (sim.sank.has(shipId) || sim.state.phase !== 'programming') return now;
  return now + HARD.lookAhead * (rankPrograms(sim.state, shipId, config, 1, style)[0] as { score: number }).score;
}

/** Easy: Normal's Part I, then random cards (or none) in the later Parts' free slots. */
function easyProgram(state: GameState, ship: Ship, config: RulesConfig, rng: Rng, style: Style): Program {
  const best = (rankPrograms(state, ship.id, config, 2, style)[0] as { program: Program }).program;
  const program: Record<string, string> = Object.fromEntries(Object.entries(best).filter(([slot]) => slot.endsWith('1')));
  const left = rng.shuffle(ship.hand.filter((c) => !Object.values(program).includes(c)));
  for (const slot of freeSlots(ship)) {
    if (slot.endsWith('1') || left.length === 0 || rng.float() >= EASY_FILL) continue;
    program[slot] = left.pop() as string;
  }
  return program;
}

/** The program a ship's player chooses at this level. */
export function chooseProgram(state: GameState, shipId: string, config: RulesConfig, level: AiLevel, style: Style = BALANCED): Program {
  const ship = state.ships[shipId] as Ship;
  const rng = new Rng(seedFor(state, ship.player));
  if (level === 'easy') return easyProgram(state, ship, config, rng, style);
  if (level === 'normal') return (rankPrograms(state, shipId, config, undefined, style)[0] as { program: Program }).program;
  const candidates = rankPrograms(state, shipId, config, HARD.candidates, style);
  const weather = planningWeather(state);
  const dist = distanceMap(state, goals(state, ship, style.raider), weather, config);
  const totals = candidates.map(() => 0);
  for (let i = 0; i < HARD.samples; i++) {
    const world = sampleWorld(state, ship.player, config, rng);
    candidates.forEach((c, k) => {
      totals[k]! += lookAhead(world, shipId, c.program, config, style, dist, weather);
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
