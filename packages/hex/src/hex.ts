/**
 * Hex grid maths for flat-topped hexes (rules §3.1, §3.5: sides face N, NE, SE, S, SW, NW).
 *
 * Coordinates are cube coordinates (q + r + s = 0), which make distances, rotations and lines simple.
 * Reference: Red Blob Games, "Hexagonal Grids" (https://www.redblobgames.com/grids/hexagons/).
 */

export interface Hex {
  readonly q: number;
  readonly r: number;
  readonly s: number;
}

/** The six directions a ship can face, clockwise from North. Each is a hex side (flat-topped hexes). */
export const Direction = { N: 0, NE: 1, SE: 2, S: 3, SW: 4, NW: 5 } as const;
export type Direction = 0 | 1 | 2 | 3 | 4 | 5;

export const DIRECTION_NAMES = ['N', 'NE', 'SE', 'S', 'SW', 'NW'] as const;

/** Unit vectors for each direction (flat-topped, cube coordinates, "north" = towards negative r). */
const DIRECTION_VECTORS: readonly Hex[] = [
  { q: 0, r: -1, s: 1 }, // N
  { q: 1, r: -1, s: 0 }, // NE
  { q: 1, r: 0, s: -1 }, // SE
  { q: 0, r: 1, s: -1 }, // S
  { q: -1, r: 1, s: 0 }, // SW
  { q: -1, r: 0, s: 1 }, // NW
];

/** Normalise -0 to 0 so hexes compare and serialise cleanly. */
const z = (n: number): number => (n === 0 ? 0 : n);

export function hex(q: number, r: number): Hex {
  return { q: z(q), r: z(r), s: z(-q - r) };
}

export function hexEquals(a: Hex, b: Hex): boolean {
  return a.q === b.q && a.r === b.r;
}

/** Stable string key, for use in maps and sets. */
export function hexKey(h: Hex): string {
  return `${h.q},${h.r}`;
}

export function hexAdd(a: Hex, b: Hex): Hex {
  return hex(a.q + b.q, a.r + b.r);
}

export function hexSubtract(a: Hex, b: Hex): Hex {
  return hex(a.q - b.q, a.r - b.r);
}

export function hexScale(a: Hex, k: number): Hex {
  return hex(a.q * k, a.r * k);
}

/** Wrap any integer into a valid direction 0..5. */
export function toDirection(n: number): Direction {
  return (((n % 6) + 6) % 6) as Direction;
}

/** Rotate a direction clockwise by `steps` of 60° (negative = anticlockwise). */
export function rotate(dir: Direction, steps: number): Direction {
  return toDirection(dir + steps);
}

export function opposite(dir: Direction): Direction {
  return rotate(dir, 3);
}

export function directionVector(dir: Direction): Hex {
  return DIRECTION_VECTORS[dir] as Hex;
}

export function neighbor(h: Hex, dir: Direction): Hex {
  return hexAdd(h, directionVector(dir));
}

/** Number of hex steps between two hexes. */
export function distance(a: Hex, b: Hex): number {
  const d = hexSubtract(a, b);
  return Math.max(Math.abs(d.q), Math.abs(d.r), Math.abs(d.s));
}

/** Smallest number of 60° steps between two directions (0..3). */
export function angleSteps(a: Direction, b: Direction): number {
  const diff = toDirection(b - a);
  return Math.min(diff, 6 - diff);
}

function hexRound(q: number, r: number): Hex {
  const s = -q - r;
  let rq = Math.round(q);
  let rr = Math.round(r);
  const rs = Math.round(s);
  const dq = Math.abs(rq - q);
  const dr = Math.abs(rr - r);
  const ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;
  return hex(rq, rr);
}

/**
 * Hexes on the straight line from a to b, inclusive of both ends.
 * A tiny nudge breaks ties consistently when the line runs exactly along a hex edge.
 */
export function line(a: Hex, b: Hex): Hex[] {
  const n = distance(a, b);
  if (n === 0) return [a];
  const eps = 1e-6;
  const aq = a.q + eps;
  const ar = a.r + eps;
  const bq = b.q + eps;
  const br = b.r + eps;
  const out: Hex[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    out.push(hexRound(aq + (bq - aq) * t, ar + (br - ar) * t));
  }
  return out;
}

/**
 * Hexes within the 60° wedge between two adjacent directions `d1` and `d2 = d1 + 1`, at distances 1..range,
 * including both boundary lines. At distance k the wedge holds k + 1 hexes.
 */
export function wedge(origin: Hex, d1: Direction, range: number): Hex[] {
  const d2 = rotate(d1, 1);
  const v1 = directionVector(d1);
  const v2 = directionVector(d2);
  const out: Hex[] = [];
  for (let k = 1; k <= range; k++) {
    for (let b = 0; b <= k; b++) {
      const a = k - b;
      out.push(hexAdd(origin, hexAdd(hexScale(v1, a), hexScale(v2, b))));
    }
  }
  return out;
}
