/**
 * Which cards to discard down to the hand limit (rules §5.1): keep the hand that gives the most useful choice next turn.
 * Every card carries one order in each row (sail, steer, action). A hand is worth the sum, row by row, of each distinct order's
 * value; a second copy of an order is worth half the first, a third a quarter, and so on, since one is usually enough. Repair is
 * worth more on a damaged ship, Heal with crew wounded, and Fire to a personality that loves landing hits. The AI drops, one at a
 * time, the card whose loss costs the hand least.
 */

import type { CommandCard, Ship } from '@msb/msb-rules';
import { WEIGHTS, type Style } from './weights';

/** What one copy of each order is worth to keep in hand. */
export const ORDER_VALUE: Readonly<Record<string, number>> = {
  full: 3,
  half: 2.5,
  rowAhead: 1,
  rowBack: 0.8,
  anchor: 0.8,
  easePort: 1.5,
  easeStbd: 1.5,
  hardPort: 1.5,
  hardStbd: 1.5,
  hardAbout: 1,
  fire: 2,
  repair: 1,
  heal: 0.8,
};

const ROWS = ['sail', 'steer', 'action'] as const;

/** Each order's value for this ship: Repair and Heal when she needs them, Fire for a fighter. */
export function orderValues(ship: Ship, style: Style): Record<string, number> {
  const v: Record<string, number> = { ...ORDER_VALUE };
  if (ship.blocked.length > 0) v['repair'] = 2.5;
  if (ship.crew.some((c) => c.state !== 'healthy')) v['heal'] = 2.5;
  v['fire'] = (v['fire'] as number) * Math.min(2, Math.max(0.5, style.weights.enemyHurt / WEIGHTS.enemyHurt));
  return v;
}

/** How much choice a hand gives: distinct orders count in full, repeats less and less. */
export function handValue(hand: readonly string[], cards: ReadonlyMap<string, CommandCard>, values: Readonly<Record<string, number>>): number {
  let total = 0;
  for (const row of ROWS) {
    const seen = new Map<string, number>();
    for (const id of hand) {
      const order = (cards.get(id) as CommandCard)[row];
      const n = seen.get(order) ?? 0;
      seen.set(order, n + 1);
      total += (values[order] as number) / 2 ** n;
    }
  }
  return total;
}

/** The cards to discard so `hand` fits the limit, the least useful first. */
export function chooseDiscards(hand: readonly string[], limit: number, ship: Ship, cards: ReadonlyMap<string, CommandCard>, style: Style): string[] {
  const values = orderValues(ship, style);
  const keep = [...hand];
  const out: string[] = [];
  while (keep.length > limit) {
    let worst = 0;
    let best = -Infinity;
    keep.forEach((_, i) => {
      const without = handValue([...keep.slice(0, i), ...keep.slice(i + 1)], cards, values);
      if (without > best) (best = without), (worst = i);
    });
    out.push(...keep.splice(worst, 1));
  }
  return out;
}
