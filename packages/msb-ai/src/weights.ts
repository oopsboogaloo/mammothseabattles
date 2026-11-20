/** What the AI cares about (engineering design §10): the score weights, and a style that bundles them for a personality. */

/** Score weights: what the AI cares about. Bigger = more important. */
export const WEIGHTS = {
  sunk: -5000,
  scored: 2000,
  pickUp: 600,
  loseTreasure: -600,
  perDistance: -40,
  facingGoal: 25,
  slotDamaged: -60,
  crewHurt: -70,
  enemyHurt: 30,
  enemySunk: 300,
  inHazard: -120,
  stranded: -200,
  /** Ending the turn where next turn's wind drift (or a stray move) would carry her off the map. */
  driftOffMap: -800,
  onEdge: -15,
  cardUsed: -1,
} as const;

export type Weights = { readonly [K in keyof typeof WEIGHTS]: number };

/** A way of playing: the score weights, and whether to hunt rival ships rather than treasure. */
export interface Style {
  readonly weights: Weights;
  readonly raider: boolean;
}

export const BALANCED: Style = { weights: WEIGHTS, raider: false };
