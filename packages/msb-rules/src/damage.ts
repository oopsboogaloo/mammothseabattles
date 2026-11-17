/**
 * Damage dice (rules §7.2): a d12 per DD, giving Ship and/or Crew damage, or a Critical hit.
 * Critical (placeholder rule): roll that die again plus 1 extra DD.
 */

import { Rng } from '@msb/engine';
import type { RulesConfig } from './config';

export type DamageFace = { readonly ship: number; readonly crew: number } | { readonly critical: true };

export interface DamageResult {
  readonly ship: number;
  readonly crew: number;
  /** Every d12 rolled, in order, including criticals. */
  readonly rolls: readonly number[];
  readonly criticals: number;
}

export function isCritical(face: DamageFace): face is { readonly critical: true } {
  return 'critical' in face;
}

/** Roll `dd` damage dice. Each critical adds two more dice (the re-roll and the extra die). */
export function rollDamage(rng: Rng, dd: number, config: RulesConfig): DamageResult {
  let pending = dd;
  let ship = 0;
  let crew = 0;
  let criticals = 0;
  const rolls: number[] = [];
  while (pending > 0) {
    pending--;
    const roll = rng.die(config.damageDie.length);
    rolls.push(roll);
    const face = config.damageDie[roll - 1] as DamageFace;
    if (isCritical(face)) {
      criticals++;
      pending += 2;
    } else {
      ship += face.ship;
      crew += face.crew;
    }
  }
  return { ship, crew, rolls, criticals };
}
