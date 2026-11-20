/**
 * AI personalities (engineering design §10): the same planner with different priorities, so computer opponents feel different.
 * - **Balanced**: the standard weights.
 * - **Treasure hunter**: races for treasure and avoids fights.
 * - **Raider**: hunts rival ships, above all ones carrying treasure, and loves landing hits.
 * - **Cautious**: hates damage, hazards and the map edge, and rarely takes a risk.
 */

import { BALANCED, WEIGHTS, type Style, type Weights } from './weights';

export type Personality = 'balanced' | 'hunter' | 'raider' | 'cautious';
export const PERSONALITIES: readonly Personality[] = ['balanced', 'hunter', 'raider', 'cautious'];

/** The standard weights with some multiplied. */
export function scaled(factors: Partial<Record<keyof Weights, number>>): Weights {
  const out: Record<string, number> = { ...WEIGHTS };
  for (const [k, f] of Object.entries(factors)) out[k] = (WEIGHTS as Record<string, number>)[k]! * f!;
  return out as Weights;
}

export const STYLES: Readonly<Record<Personality, Style>> = {
  balanced: BALANCED,
  hunter: {
    weights: scaled({ perDistance: 1.4, pickUp: 1.5, scored: 1.3, enemyHurt: 0.3, enemySunk: 0.3, onEdge: 2, driftOffMap: 1.5 }),
    raider: false,
  },
  raider: { weights: scaled({ enemyHurt: 3, enemySunk: 2.5, perDistance: 0.8 }), raider: true },
  cautious: {
    weights: scaled({ slotDamaged: 2, crewHurt: 2, inHazard: 2, onEdge: 3, driftOffMap: 1.5, sunk: 1.5, enemyHurt: 0.6 }),
    raider: false,
  },
};
