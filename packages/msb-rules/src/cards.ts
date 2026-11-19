/**
 * Command cards (rules §3.3): three bands, one initiative number. Only the band of the slot a card is placed in counts (§3.4).
 * The card list itself is content: it comes with the game setup (from `msb-data` in step P7).
 */

export type SailOrder = 'half' | 'full' | 'anchor' | 'rowAhead' | 'rowBack';
export type SteerOrder = 'easePort' | 'easeStbd' | 'hardPort' | 'hardStbd' | 'hardAbout';
export type ActionOrder = 'fire' | 'repair' | 'heal';

export interface CommandCard {
  readonly id: string;
  /** Unique; higher acts first (§5.3). */
  readonly initiative: number;
  readonly sail: SailOrder;
  readonly steer: SteerOrder;
  readonly action: ActionOrder;
  /** 🐙 icons, for the sea monster add-on (§9.1). */
  readonly octopus: number;
}

/** Throws if a card list can't make a deck: duplicate ids, or initiative numbers that aren't unique (§5.3). */
export function validateCards(cards: readonly CommandCard[]): void {
  const ids = new Set<string>();
  const initiatives = new Set<number>();
  for (const card of cards) {
    if (ids.has(card.id)) throw new Error(`Duplicate card id ${card.id}`);
    if (initiatives.has(card.initiative)) throw new Error(`Initiative ${card.initiative} is not unique (card ${card.id})`);
    ids.add(card.id);
    initiatives.add(card.initiative);
  }
}
