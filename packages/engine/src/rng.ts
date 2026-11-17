/**
 * Seeded, serialisable random number generator (NFR-3: determinism).
 *
 * The generator state is a plain number stored in the game state, so a game can be saved,
 * replayed and simulated exactly. Engine and rules code must never use Math.random.
 *
 * Algorithm: mulberry32 (32-bit state, fast, good enough for dice and shuffles).
 */

export type RngState = number;

/** Create a generator state from any integer seed. */
export function seedRng(seed: number): RngState {
  return seed >>> 0;
}

/** Returns a float in [0, 1) and the next state. */
export function nextFloat(state: RngState): [number, RngState] {
  const next = (state + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [value, next];
}

/** Returns an integer in [min, max] (inclusive) and the next state. */
export function nextInt(state: RngState, min: number, max: number): [number, RngState] {
  if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
    throw new RangeError(`nextInt: invalid range [${min}, ${max}]`);
  }
  const [f, next] = nextFloat(state);
  return [min + Math.floor(f * (max - min + 1)), next];
}

/** Roll one die with the given number of sides (1..sides). */
export function rollDie(state: RngState, sides: number): [number, RngState] {
  return nextInt(state, 1, sides);
}

/** Fisher–Yates shuffle. Returns a new array and the next state; the input is not modified. */
export function shuffle<T>(state: RngState, items: readonly T[]): [T[], RngState] {
  const out = items.slice();
  let s = state;
  for (let i = out.length - 1; i > 0; i--) {
    let j: number;
    [j, s] = nextInt(s, 0, i);
    const tmp = out[i] as T;
    out[i] = out[j] as T;
    out[j] = tmp;
  }
  return [out, s];
}

/**
 * A small mutable wrapper for code that makes many draws in a row.
 * Always read `.state` back into the game state afterwards.
 */
export class Rng {
  constructor(public state: RngState) {}

  float(): number {
    const [v, s] = nextFloat(this.state);
    this.state = s;
    return v;
  }

  int(min: number, max: number): number {
    const [v, s] = nextInt(this.state, min, max);
    this.state = s;
    return v;
  }

  die(sides: number): number {
    return this.int(1, sides);
  }

  shuffle<T>(items: readonly T[]): T[] {
    const [v, s] = shuffle(this.state, items);
    this.state = s;
    return v;
  }
}
