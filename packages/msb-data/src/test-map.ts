/**
 * The prototype's test map (implementation plan P7): a radius-5 hexagon of sea (91 hexes) using every board feature the engine
 * supports, so a play-test meets all of them. It isn't a real board: the real boards are still being designed (rules §3.1.1).
 *
 * Coordinates are (q, r), flat-topped, "north" = towards negative r (packages/hex). Port hexes sit on the rim, one per seat.
 */

import { distance, hex, hexKey, type Direction } from '@msb/hex';
import type { GameMap, MapHex, Terrain } from '@msb/msb-rules';

const k = (q: number, r: number): string => hexKey(hex(q, r));
const N: Direction = 0;
const NW: Direction = 5;

/** Home port hexes for up to 4 seats, in seat order: west, east, north, south rims. */
export const TEST_MAP_PORTS: readonly string[] = [k(-5, 0), k(5, 0), k(0, -5), k(0, 5)];

const TERRAIN: Readonly<Record<string, Terrain>> = {
  [k(0, 0)]: 'cliff', // the island, with a sea cave through it
  [k(0, 1)]: 'cliff',
  [k(1, -1)]: 'beach',
  [k(-1, 1)]: 'beach',
  [k(2, -2)]: 'sandbank', // water only at High tide
  [k(3, -2)]: 'sandbank',
  [k(-2, 2)]: 'underwaterReef', // land only at Low tide
  [k(-3, 3)]: 'underwaterReef',
  [k(3, 1)]: 'deathReef',
  [k(-2, -1)]: 'roughWater',
  [k(2, 2)]: 'storm',
};

const FEATURES: Readonly<Record<string, Omit<MapHex, 'terrain'>>> = {
  [k(-1, -2)]: { fog: true },
  [k(-1, -3)]: { fog: true },
  [k(-3, -1)]: { whirlpool: 1 },
  [k(4, -2)]: { whirlpool: 1 },
  // A triple current running south, ending on a sandbank.
  [k(2, -5)]: { current: { kind: 'flow', to: k(2, -4), turn: 0, strength: 3 } },
  [k(2, -4)]: { current: { kind: 'flow', to: k(2, -3), turn: 0, strength: 3 } },
  // A double current running north-east.
  [k(-3, 4)]: { current: { kind: 'flow', to: k(-2, 3), turn: 0, strength: 2 } },
  [k(-2, 3)]: { current: { kind: 'flow', to: k(-1, 2), turn: 0, strength: 2 } },
  // A single curved current (clockwise), and a jump across the corner between whirlpool 1 and its neighbour.
  [k(-3, 0)]: { current: { kind: 'flow', to: k(-3, 1), turn: 1, strength: 1 } },
  [k(3, -1)]: { current: { kind: 'flow', to: k(5, -2), turn: 0, strength: 1 } },
  // Eddies: 60° clockwise and 120° anticlockwise.
  [k(1, 3)]: { current: { kind: 'eddy', turn: 1, strength: 1 } },
  [k(-1, 4)]: { current: { kind: 'eddy', turn: -2, strength: 1 } },
};

function buildHexes(): Record<string, MapHex> {
  const hexes: Record<string, MapHex> = {};
  for (let q = -5; q <= 5; q++) {
    for (let r = -5; r <= 5; r++) {
      if (distance(hex(0, 0), hex(q, r)) > 5) continue;
      const key = k(q, r);
      hexes[key] = { terrain: TERRAIN[key] ?? 'sea', ...FEATURES[key] };
    }
  }
  return hexes;
}

export const TEST_MAP: GameMap = {
  id: 'test-map',
  hexes: buildHexes(),
  wallReefs: [{ hex: k(-1, 0), side: NW }],
  // Cave A runs under the island: in at the north face of (0,0), out of the south face of (0,1).
  caves: [
    { hex: k(0, 0), side: N, letter: 'A' },
    { hex: k(0, 1), side: 3, letter: 'A' },
  ],
  rotors: [
    // A 2-hex rotor (180°, ships swap) and a 3-hex ring round a corner (120° clockwise).
    { moves: { [k(-2, 0)]: k(-2, 1), [k(-2, 1)]: k(-2, 0) }, turn: 3, strength: 1 },
    { moves: { [k(1, 1)]: k(2, 1), [k(2, 1)]: k(1, 2), [k(1, 2)]: k(1, 1) }, turn: 2, strength: 1 },
  ],
  spawnPoints: {
    '1': k(-1, -4),
    '2': k(3, -3),
    '3': k(-3, 2),
    '4': k(2, 3),
    '5': k(4, -3),
    '6': k(0, -3),
    '7': k(1, -1), // on land: dig it up from next door
    '8': k(-1, 1), // on land
    '9': k(3, -2), // on a sandbank: land except at High tide
  },
  startWrecks: [k(-2, -3), k(3, 0), k(-4, 4), k(1, 4)],
};
