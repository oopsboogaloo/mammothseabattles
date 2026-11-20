/**
 * Sailing distance (AI, engineering design §10): how far each hex is from a goal for a ship under sail, not as the crow flies.
 * A step costs less the faster a ship sails that way in this wind (rules §6.2–6.3), so the map bends round islands and away
 * from the wind's eye. Land and death reefs can't be crossed; rough water and storms cost extra because they hurt.
 */

import { hexKey, neighbor, opposite, type Direction, type Hex } from '@msb/hex';
import { isLand, parseHexKey, sailMove, tide, type GameState, type RulesConfig, type Weather } from '@msb/msb-rules';

export type DistanceMap = ReadonlyMap<string, number>;

const DIRECTIONS: readonly Direction[] = [0, 1, 2, 3, 4, 5];
/** Cost of a step straight into the wind: the ship must tack round or row. */
const UPWIND_STEP = 3;
const HAZARD: Readonly<Record<string, number>> = { roughWater: 2, storm: 3 };

/** The cost of sailing one hex in direction `d`. */
export function stepCost(d: Direction, weather: Weather, config: RulesConfig): number {
  const speed = sailMove('full', d, weather, config);
  return speed <= 0 ? UPWIND_STEP : 1 / speed;
}

/** Whether a ship can be in this hex now (sea, not a death reef). */
export function sailable(state: GameState, key: string): boolean {
  const hex = state.setup.map.hexes[key];
  return hex !== undefined && hex.terrain !== 'deathReef' && !isLand(hex.terrain, tide(state.weather));
}

/**
 * Cost from every sailable hex to the nearest of `goals` (hex keys). A goal on land counts as reached from any hex next to it
 * (treasure on land is dug up from next door, rules §8.2.2).
 */
export function distanceMap(state: GameState, goals: readonly string[], weather: Weather, config: RulesConfig): DistanceMap {
  const dist = new Map<string, number>();
  const queue: [string, number][] = [];
  const seed = (key: string) => {
    if (dist.has(key)) return;
    dist.set(key, 0);
    queue.push([key, 0]);
  };
  for (const goal of goals) {
    if (sailable(state, goal)) seed(goal);
    else for (const d of DIRECTIONS) {
      const next = hexKey(neighbor(parseHexKey(goal), d));
      if (sailable(state, next)) seed(next);
    }
  }
  // Dijkstra; the maps are small (about a hundred hexes), so a sorted array is enough.
  while (queue.length > 0) {
    queue.sort((a, b) => a[1] - b[1]);
    const [key, cost] = queue.shift() as [string, number];
    if (cost > (dist.get(key) as number)) continue;
    const here = parseHexKey(key);
    for (const d of DIRECTIONS) {
      const from = hexKey(neighbor(here, d));
      if (!sailable(state, from)) continue;
      // A ship at `from` reaches `here` by sailing in the opposite direction.
      const terrain = state.setup.map.hexes[key]?.terrain as string;
      const total = cost + stepCost(opposite(d), weather, config) + (HAZARD[terrain] ?? 0);
      if (total < (dist.get(from) ?? Infinity)) {
        dist.set(from, total);
        queue.push([from, total]);
      }
    }
  }
  return dist;
}

/** Distance of a hex on the map, or a large number if it can't reach the goal at all. */
export function distanceOf(map: DistanceMap, at: Hex): number {
  return map.get(hexKey(at)) ?? 99;
}
