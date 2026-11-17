/**
 * Cannon fire (rules §7.1): both broadsides, 60° wedges abeam, range 4; every enemy in either arc is hit
 * unless spared; no firing from, into or through fog; no firing through portals or caves.
 */

import { hexEquals, hexKey, line, rotate, wedge, type Direction, type Hex } from '@msb/hex';
import type { RulesConfig } from './config';

/** The hexes covered by both broadsides of a ship at `position` facing `heading`. */
export function broadsideArcs(position: Hex, heading: Direction, config: RulesConfig): { starboard: Hex[]; port: Hex[] } {
  return {
    // Starboard wedge lies between the forward-quarter (heading+1) and aft-quarter (heading+2) directions.
    starboard: wedge(position, rotate(heading, 1), config.cannonRange),
    // Port wedge lies between heading+4 and heading+5.
    port: wedge(position, rotate(heading, 4), config.cannonRange),
  };
}

export interface Target {
  readonly id: string;
  readonly position: Hex;
  /** Same team as the firer (no friendly fire). In free-for-all, nobody is. */
  readonly friendly: boolean;
}

export interface FireContext {
  /** Hex keys covered by fog. */
  readonly fog: ReadonlySet<string>;
  /** Hex keys of whirlpools and cave mouths' island hexes that cannon can't fire through. */
  readonly portals: ReadonlySet<string>;
}

/** True if a shot from `from` to `to` is blocked by fog (at either end or in between) or by a portal in between. */
export function lineOfFireBlocked(from: Hex, to: Hex, ctx: FireContext): boolean {
  if (ctx.fog.has(hexKey(from)) || ctx.fog.has(hexKey(to))) return true;
  const between = line(from, to).slice(1, -1);
  return between.some((h) => ctx.fog.has(hexKey(h)) || ctx.portals.has(hexKey(h)));
}

/**
 * Ids of every target hit by a Fire Cannons order, before the firer chooses to spare any.
 * Cannons fire over land (§7.1), so land never blocks.
 */
export function cannonTargets(
  position: Hex,
  heading: Direction,
  targets: readonly Target[],
  ctx: FireContext,
  config: RulesConfig,
): string[] {
  const { starboard, port } = broadsideArcs(position, heading, config);
  const arc = [...starboard, ...port];
  return targets
    .filter((t) => !t.friendly)
    .filter((t) => arc.some((h) => hexEquals(h, t.position)))
    .filter((t) => !lineOfFireBlocked(position, t.position, ctx))
    .map((t) => t.id);
}
