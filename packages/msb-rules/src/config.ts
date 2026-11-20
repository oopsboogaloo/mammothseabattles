/**
 * Every tunable number in the rules lives here (web-spec §3.3), so the simulator can run experiments
 * ("what if cliffs did 1 DD?") without code changes. Defaults match rules.md v0.82.
 */

import type { DamageFace } from './damage';

export interface RulesConfig {
  /** §6.2 Points of Sail on (standard) or the basic rule (§6.1). */
  readonly pointsOfSail: boolean;
  /** §6.1 basic sail moves [Half, Full]. */
  readonly basicSailMoves: readonly [number, number];
  /** §6.2 [Half, Full] moves by point of sail; negative = backwards. */
  readonly pointsOfSailMoves: {
    readonly windward: readonly [number, number];
    readonly closeHauled: readonly [number, number];
    readonly broadReach: readonly [number, number];
    readonly running: readonly [number, number];
  };
  /** §7.1 broadside range in hexes. */
  readonly cannonRange: number;
  /** §7.2 damage die faces, indexed by roll - 1. */
  readonly damageDie: readonly DamageFace[];
  /** §7.2 DD dealt by each source. */
  readonly dd: {
    readonly cannonHit: number;
    readonly ram: number;
    readonly galePerFullSail: number;
    readonly cliff: number;
    readonly wallReef: number;
    readonly roughWater: number;
    readonly storm: number;
    readonly homePortGuns: number;
  };
  /** §8.2.4 home port gun range. */
  readonly homePortGunRange: number;
  /** §3.6 maximum crew per ship. */
  readonly crewCap: number;
  /** §5.1 maximum hand of command cards. */
  readonly handLimit: number;
  /** §7.7 crew recruited at a refit. */
  readonly refitCrew: number;
  /** §5.3 initiative tie-break die. */
  readonly tieBreakDieSides: number;
  /** §3.1 optional rule Safe edge: the map edge acts as a beach instead of sinking ships. */
  readonly safeEdge: boolean;
  /** §8.2.5 treasures to win, and with 7–8 ships. */
  readonly treasureTarget: number;
  readonly treasureTargetLarge: number;
  /** §8.8 Solo Challenge: turns played, then the treasure brought home is the score. */
  readonly soloTurns: number;
}

export const DEFAULT_DAMAGE_DIE: readonly DamageFace[] = [
  { ship: 0, crew: 0 }, // 1: miss
  { ship: 1, crew: 0 }, // 2
  { ship: 1, crew: 0 }, // 3
  { ship: 0, crew: 1 }, // 4
  { ship: 0, crew: 1 }, // 5
  { ship: 1, crew: 1 }, // 6
  { ship: 1, crew: 1 }, // 7
  { ship: 2, crew: 0 }, // 8
  { ship: 0, crew: 2 }, // 9
  { ship: 1, crew: 2 }, // 10
  { ship: 2, crew: 1 }, // 11
  { critical: true }, // 12
];

export const DEFAULT_CONFIG: RulesConfig = {
  pointsOfSail: true,
  basicSailMoves: [1, 2],
  pointsOfSailMoves: {
    windward: [0, -1],
    closeHauled: [1, 2],
    broadReach: [2, 3],
    running: [1, 2],
  },
  cannonRange: 4,
  damageDie: DEFAULT_DAMAGE_DIE,
  dd: {
    cannonHit: 1,
    ram: 1,
    galePerFullSail: 1,
    cliff: 2,
    wallReef: 2,
    roughWater: 2,
    storm: 3,
    homePortGuns: 1,
  },
  homePortGunRange: 2,
  crewCap: 6,
  handLimit: 9,
  refitCrew: 3,
  tieBreakDieSides: 6,
  safeEdge: false,
  treasureTarget: 3,
  treasureTargetLarge: 2,
  soloTurns: 14,
};

/** Make a config from the defaults with some values overridden (shallow per section). */
export function makeConfig(overrides: Partial<RulesConfig> = {}): RulesConfig {
  return { ...DEFAULT_CONFIG, ...overrides };
}
