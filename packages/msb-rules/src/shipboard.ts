/**
 * Ship board slots, ship damage and crew damage (rules §3.4, §7.3, §7.4).
 */

import type { Part } from './sailing';

export type SlotRow = 'sail' | 'steer' | 'action';
export const SLOT_ROWS: readonly SlotRow[] = ['sail', 'steer', 'action'];
export const PARTS: readonly Part[] = [1, 2, 3];

export interface Slot {
  readonly row: SlotRow;
  readonly part: Part;
}

export function slotKey(slot: Slot): string {
  return `${slot.row}${slot.part}`;
}

export function allSlots(): Slot[] {
  return SLOT_ROWS.flatMap((row) => PARTS.map((part) => ({ row, part })));
}

/** Slots without a damage marker, i.e. legal places for new Ship damage (§7.3: the damaged player chooses). */
export function usableSlots(blocked: ReadonlySet<string>): Slot[] {
  return allSlots().filter((s) => !blocked.has(slotKey(s)));
}

/** §7.3: a ship sinks when any whole row (all 3 Parts of Sail, Steer or Action) is blocked. */
export function rowBlocked(blocked: ReadonlySet<string>): boolean {
  return SLOT_ROWS.some((row) => PARTS.every((part) => blocked.has(slotKey({ row, part }))));
}

export type CrewState = 'healthy' | 'wounded';

export interface CrewMember {
  readonly id: string;
  readonly state: CrewState;
  /** Command-card icons: cards drawn per turn while healthy (§3.6). */
  readonly cardIcons: number;
}

/** §5.1: cards drawn per turn = card icons on healthy crew. */
export function cardsToDraw(crew: readonly CrewMember[]): number {
  return crew.filter((c) => c.state === 'healthy').reduce((sum, c) => sum + c.cardIcons, 0);
}

/** §7.4: a ship sinks when she has no healthy crew. */
export function noHealthyCrew(crew: readonly CrewMember[]): boolean {
  return !crew.some((c) => c.state === 'healthy');
}

/** §7.4: one point of Crew damage either wounds a healthy crew member or kills a wounded one. */
export type CrewDamageChoice = { readonly wound: string } | { readonly kill: string };

/** Legal choices for one point of Crew damage (the damaged player chooses). */
export function crewDamageOptions(crew: readonly CrewMember[]): CrewDamageChoice[] {
  return crew.map((c) => (c.state === 'healthy' ? { wound: c.id } : { kill: c.id }));
}

export function applyCrewDamage(crew: readonly CrewMember[], choice: CrewDamageChoice): CrewMember[] {
  if ('wound' in choice) {
    return crew.map((c) => (c.id === choice.wound && c.state === 'healthy' ? { ...c, state: 'wounded' } : c));
  }
  return crew.filter((c) => !(c.id === choice.kill && c.state === 'wounded'));
}

/** §7.6 Heal: flip one wounded crew member back to healthy. */
export function heal(crew: readonly CrewMember[], id: string): CrewMember[] {
  return crew.map((c) => (c.id === id && c.state === 'wounded' ? { ...c, state: 'healthy' } : c));
}
