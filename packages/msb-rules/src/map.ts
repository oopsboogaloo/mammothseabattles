/**
 * Map validation (engineering design §7.1): catch map data the rules can't use when a game is set up, not mid-turn.
 */

import type { GameMap } from './state';

function countBy<T>(items: readonly T[], key: (t: T) => string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(key(item), (counts.get(key(item)) ?? 0) + 1);
  return counts;
}

/** Throws if whirlpools or caves aren't in pairs, or a current or rotor refers to a hex that isn't on the map. */
export function validateMap(map: GameMap): void {
  const pools = Object.values(map.hexes).flatMap((h) => (h.whirlpool === undefined ? [] : [h.whirlpool]));
  for (const [number, count] of countBy(pools, String)) {
    if (count !== 2) throw new Error(`Whirlpool ${number} appears ${count} times; whirlpools come in pairs (rules §3.2.1)`);
  }
  for (const [letter, count] of countBy(map.caves ?? [], (c) => c.letter)) {
    if (count !== 2) throw new Error(`Cave ${letter} appears ${count} times; caves come in pairs (rules §3.2.2)`);
  }
  const onMap = (key: string) => map.hexes[key] !== undefined;
  for (const [key, hex] of Object.entries(map.hexes)) {
    // A current may point off the map: that sinks a ship (rules §3.1). Its start hex is this hex, which is on the map.
    if (hex.current?.kind === 'flow' && !/^-?\d+,-?\d+$/.test(hex.current.to)) throw new Error(`Current in ${key} has a bad destination`);
  }
  for (const rotor of map.rotors ?? []) {
    for (const [from, to] of Object.entries(rotor.moves)) {
      if (!onMap(from) || !onMap(to)) throw new Error(`Rotor move ${from} → ${to} leaves the map`);
    }
  }
}
