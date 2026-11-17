/**
 * Sailing: points of sail, weather modifiers and wind drift (rules §5.2, §6.1–6.3).
 */

import { opposite, toDirection, type Direction } from '@msb/hex';
import type { RulesConfig } from './config';

export type SailLevel = 'none' | 'half' | 'full';
export type WindStrength = 'deadCalm' | 'light' | 'firm' | 'strong' | 'gale';
export type PointOfSail = 'windward' | 'closeHauled' | 'broadReach' | 'running';
export type Part = 1 | 2 | 3;

export interface Weather {
  readonly strength: WindStrength;
  /** The wind blows TOWARDS this direction (rules §3.5: it blows the way the card's arrow points). */
  readonly direction: Direction;
}

/**
 * §6.2: the ship's heading compared with the wind.
 * Heading the same way the wind blows = running; heading straight into it = windward.
 */
export function pointOfSail(heading: Direction, wind: Direction): PointOfSail {
  switch (toDirection(heading - wind)) {
    case 0:
      return 'running';
    case 1:
    case 5:
      return 'broadReach';
    case 2:
    case 4:
      return 'closeHauled';
    default:
      return 'windward';
  }
}

/**
 * §6.1–6.3: signed number of hexes sailed in the Move phase (negative = backwards).
 *
 * Weather changes the SIZE of the move (whatever its direction), never below 0 (§6.3).
 * A sail that is set is affected even if its base move is 0 (Half Sail into a Gale: 1 hex backwards).
 * No Sail is never affected; Dead Calm stops all sailing.
 */
export function sailMove(sail: SailLevel, heading: Direction, weather: Weather, config: RulesConfig): number {
  if (sail === 'none' || weather.strength === 'deadCalm') return 0;
  const index = sail === 'half' ? 0 : 1;

  let base: number;
  let backwardsIfZero = false;
  if (config.pointsOfSail) {
    const pos = pointOfSail(heading, weather.direction);
    base = config.pointsOfSailMoves[pos][index] as number;
    backwardsIfZero = pos === 'windward';
  } else {
    base = config.basicSailMoves[index] as number;
  }

  const modifier = weatherModifier(sail, weather.strength);
  const sign = base < 0 || (base === 0 && backwardsIfZero) ? -1 : 1;
  const size = Math.max(0, Math.abs(base) + modifier);
  return size === 0 ? 0 : sign * size;
}

/** §3.5 / §6.3 printed weather modifiers. */
export function weatherModifier(sail: SailLevel, strength: WindStrength): number {
  switch (strength) {
    case 'light':
      return -1;
    case 'strong':
      return sail === 'full' ? 1 : 0;
    case 'gale':
      return 1;
    default:
      return 0;
  }
}

/** §3.5: a Gale deals DD for each Move phase sailed at Full Sail. */
export function galeDamage(sail: SailLevel, weather: Weather, config: RulesConfig): number {
  return weather.strength === 'gale' && sail === 'full' ? config.dd.galePerFullSail : 0;
}

/** §5.2 step 5: does the wind cause drift in this Part? Gale: I–III, Strong: II–III, Firm: III. */
export function driftsInPart(strength: WindStrength, part: Part): boolean {
  switch (strength) {
    case 'gale':
      return true;
    case 'strong':
      return part >= 2;
    case 'firm':
      return part === 3;
    default:
      return false;
  }
}

/** The direction a ship moves when sailing: forwards, or backwards for a negative move. */
export function sailDirection(heading: Direction, move: number): Direction {
  return move < 0 ? opposite(heading) : heading;
}
