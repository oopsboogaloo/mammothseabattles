/**
 * Initiative (rules §5.3): higher goes first; an empty slot is 0; ties are rolled off (re-roll ties).
 * Movement uses the Sail-slot card's number; cannon fire uses the Action-slot card's number.
 */

import type { Rng } from '@msb/engine';
import type { RulesConfig } from './config';

export interface InitiativeEntry {
  readonly id: string;
  /** Initiative number of the relevant card, or null for an empty slot (= 0). */
  readonly initiative: number | null;
}

/** Return ids in acting order. Uses the rng only when there are ties. */
export function initiativeOrder(entries: readonly InitiativeEntry[], rng: Rng, config: RulesConfig): string[] {
  const groups = new Map<number, string[]>();
  for (const e of entries) {
    const value = e.initiative ?? 0;
    const group = groups.get(value) ?? [];
    group.push(e.id);
    groups.set(value, group);
  }
  const values = [...groups.keys()].sort((a, b) => b - a);
  return values.flatMap((v) => rollOff(groups.get(v) as string[], rng, config));
}

/** Tied players roll a die; highest goes first; tied rolls re-roll among themselves. */
export function rollOff(ids: readonly string[], rng: Rng, config: RulesConfig): string[] {
  if (ids.length <= 1) return [...ids];
  const byRoll = new Map<number, string[]>();
  for (const id of ids) {
    const roll = rng.die(config.tieBreakDieSides);
    const group = byRoll.get(roll) ?? [];
    group.push(id);
    byRoll.set(roll, group);
  }
  const rolls = [...byRoll.keys()].sort((a, b) => b - a);
  return rolls.flatMap((r) => rollOff(byRoll.get(r) as string[], rng, config));
}
