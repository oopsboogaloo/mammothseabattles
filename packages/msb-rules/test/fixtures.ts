/** Test content: the 45 command cards as in the mock-up, with the second 360 card as 380 (rules v0.131). */
import type { ActionOrder, CommandCard, SailOrder, SteerOrder } from '@msb/msb-rules';

const SAILS: SailOrder[][] = [
  ['rowAhead', 'rowBack', 'anchor', 'anchor', 'rowAhead', 'rowBack', 'rowBack', 'anchor', 'rowAhead', 'rowAhead', 'rowBack', 'anchor', 'anchor', 'rowBack', 'rowAhead'],
];
const STEERS: SteerOrder[] = ['easePort', 'easeStbd', 'hardPort', 'hardStbd', 'hardAbout'];
const ACTIONS: ActionOrder[] = ['fire', 'heal', 'repair'];

export const TEST_CARDS: readonly CommandCard[] = Array.from({ length: 45 }, (_, i) => {
  const block = Math.floor(i / 15);
  const sail: SailOrder = block === 0 ? (SAILS[0]![i] as SailOrder) : block === 1 ? 'half' : 'full';
  const initiative = block === 0 ? 100 + i * 20 : block === 1 ? 400 + (i - 15) * 20 : 700 + (i - 30) * 20;
  return {
    id: String(initiative),
    initiative,
    sail,
    steer: STEERS[Math.floor((i % 15) / 3)] as SteerOrder,
    action: ACTIONS[i % 3] as ActionOrder,
    octopus: 0,
  };
});

import type { WeatherCard, WindStrength } from '@msb/msb-rules';
import type { Direction } from '@msb/hex';

/** Six Light winds: no drift, so ships stay put unless they sail. */
export const CALM_WEATHER: readonly WeatherCard[] = Array.from({ length: 6 }, (_, i) => ({
  id: `light-${i}`,
  strength: 'light' as WindStrength,
  direction: i as Direction,
}));
