import { describe, expect, it } from 'vitest';
import {
  DIRECTION_NAMES,
  Direction,
  angleSteps,
  directionVector,
  distance,
  hex,
  hexAdd,
  hexEquals,
  hexKey,
  hexScale,
  hexSubtract,
  line,
  neighbor,
  opposite,
  rotate,
  toDirection,
  wedge,
  type Hex,
} from '@msb/hex';

const O = hex(0, 0);
const ALL_DIRS = [0, 1, 2, 3, 4, 5] as const;

describe('hex coordinates', () => {
  it('keeps q + r + s = 0 and normalises -0', () => {
    const h = hex(2, -5);
    expect(h.q + h.r + h.s).toBe(0);
    expect(Object.is(hex(0, 0).s, 0)).toBe(true);
    expect(Object.is(hexScale(hex(0, 1), -0).q, 0)).toBe(true);
  });

  it('adds, subtracts, scales, compares and keys', () => {
    expect(hexAdd(hex(1, 2), hex(3, -1))).toEqual(hex(4, 1));
    expect(hexSubtract(hex(1, 2), hex(3, -1))).toEqual(hex(-2, 3));
    expect(hexScale(hex(1, -2), 3)).toEqual(hex(3, -6));
    expect(hexEquals(hex(1, 2), hex(1, 2))).toBe(true);
    expect(hexEquals(hex(1, 2), hex(2, 1))).toBe(false);
    expect(hexKey(hex(-3, 4))).toBe('-3,4');
  });
});

describe('directions (flat-topped hexes, rules §3.5 compass N/NE/SE/S/SW/NW)', () => {
  it('names the six hex sides clockwise from North', () => {
    expect(DIRECTION_NAMES).toEqual(['N', 'NE', 'SE', 'S', 'SW', 'NW']);
    expect(Direction.SW).toBe(4);
  });

  it('has six distinct unit neighbours, and opposite directions cancel', () => {
    const ns = ALL_DIRS.map((d) => neighbor(O, d));
    expect(new Set(ns.map(hexKey)).size).toBe(6);
    for (const d of ALL_DIRS) {
      expect(distance(O, neighbor(O, d))).toBe(1);
      expect(hexAdd(directionVector(d), directionVector(opposite(d)))).toEqual(O);
    }
  });

  it('puts North straight up (negative r, q unchanged)', () => {
    expect(neighbor(O, Direction.N)).toEqual(hex(0, -1));
  });

  it('rotates and wraps', () => {
    expect(rotate(Direction.N, 1)).toBe(Direction.NE);
    expect(rotate(Direction.N, -1)).toBe(Direction.NW);
    expect(rotate(Direction.NW, 2)).toBe(Direction.NE);
    expect(toDirection(-7)).toBe(5);
    expect(toDirection(13)).toBe(1);
    expect(opposite(Direction.SE)).toBe(Direction.NW);
  });

  it('measures angles in 60° steps', () => {
    expect(angleSteps(Direction.N, Direction.N)).toBe(0);
    expect(angleSteps(Direction.N, Direction.SE)).toBe(2);
    expect(angleSteps(Direction.N, Direction.SW)).toBe(2);
    expect(angleSteps(Direction.N, Direction.S)).toBe(3);
  });
});

describe('distance and lines', () => {
  it('counts hex steps', () => {
    expect(distance(O, O)).toBe(0);
    expect(distance(O, hex(3, -1))).toBe(3);
    expect(distance(hex(-2, 4), hex(2, -1))).toBe(5);
  });

  it('draws a line of distance + 1 contiguous hexes, end to end', () => {
    const cases: [Hex, Hex][] = [
      [O, O],
      [O, hex(4, -2)],
      [hex(-3, 1), hex(2, 2)],
      [O, hex(0, -4)],
    ];
    for (const [a, b] of cases) {
      const l = line(a, b);
      expect(l.length).toBe(distance(a, b) + 1);
      expect(l[0]).toEqual(a);
      expect(l[l.length - 1]).toEqual(b);
      for (let i = 1; i < l.length; i++) expect(distance(l[i - 1]!, l[i]!)).toBe(1);
    }
  });

  it('rounds along every axis when lines pass between hex centres', () => {
    // Lines in many directions exercise every rounding branch.
    for (let q = -5; q <= 5; q++) {
      for (let r = -5; r <= 5; r++) {
        const l = line(O, hex(q, r));
        for (const h of l) expect(h.q + h.r + h.s).toBe(0);
      }
    }
  });
});

describe('wedges (rules §7.1 broadside arcs)', () => {
  it('holds k + 1 hexes at distance k: 14 hexes out to range 4', () => {
    for (const d of ALL_DIRS) {
      const w = wedge(O, d, 4);
      expect(w.length).toBe(14);
      expect(new Set(w.map(hexKey)).size).toBe(14);
      for (const h of w) {
        expect(distance(O, h)).toBeGreaterThanOrEqual(1);
        expect(distance(O, h)).toBeLessThanOrEqual(4);
      }
    }
  });

  it('includes both boundary lines', () => {
    const w = wedge(O, Direction.NE, 4).map(hexKey);
    for (let k = 1; k <= 4; k++) {
      expect(w).toContain(hexKey(hexScale(directionVector(Direction.NE), k)));
      expect(w).toContain(hexKey(hexScale(directionVector(Direction.SE), k)));
    }
  });

  it('is empty at range 0', () => {
    expect(wedge(O, Direction.N, 0)).toEqual([]);
  });
});
