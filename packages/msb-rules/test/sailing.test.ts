import { describe, expect, it } from 'vitest';
import { Direction, opposite, rotate, type Direction as Dir } from '@msb/hex';
import {
  DEFAULT_CONFIG,
  driftsInPart,
  galeDamage,
  makeConfig,
  pointOfSail,
  sailDirection,
  sailMove,
  weatherModifier,
  type PointOfSail,
  type WindStrength,
} from '@msb/msb-rules';

const WIND = Direction.S; // wind blows towards the south

/** A heading giving each point of sail for a wind blowing towards WIND. */
const HEADING: Record<PointOfSail, Dir> = {
  running: WIND,
  broadReach: rotate(WIND, 1),
  closeHauled: rotate(WIND, 2),
  windward: opposite(WIND),
};

describe('§6.2 points of sail (wind blows the way the arrow points, §3.5)', () => {
  it('classifies all six headings, mirrored port and starboard', () => {
    expect(pointOfSail(WIND, WIND)).toBe('running');
    expect(pointOfSail(rotate(WIND, 1), WIND)).toBe('broadReach');
    expect(pointOfSail(rotate(WIND, -1), WIND)).toBe('broadReach');
    expect(pointOfSail(rotate(WIND, 2), WIND)).toBe('closeHauled');
    expect(pointOfSail(rotate(WIND, -2), WIND)).toBe('closeHauled');
    expect(pointOfSail(opposite(WIND), WIND)).toBe('windward');
  });
});

describe('§6.3 full sail-move table (points of sail + weather)', () => {
  // Half / Full, negative = backwards. Rows confirmed by the designer (windward) or derived from the same rules.
  const TABLE: Record<WindStrength, Record<PointOfSail, [number, number]>> = {
    deadCalm: { windward: [0, 0], closeHauled: [0, 0], broadReach: [0, 0], running: [0, 0] },
    light: { windward: [0, 0], closeHauled: [0, 1], broadReach: [1, 2], running: [0, 1] },
    firm: { windward: [0, -1], closeHauled: [1, 2], broadReach: [2, 3], running: [1, 2] },
    strong: { windward: [0, -2], closeHauled: [1, 3], broadReach: [2, 4], running: [1, 3] },
    gale: { windward: [-1, -2], closeHauled: [2, 3], broadReach: [3, 4], running: [2, 3] },
  };

  for (const [strength, row] of Object.entries(TABLE) as [WindStrength, Record<PointOfSail, [number, number]>][]) {
    for (const [pos, [half, full]] of Object.entries(row) as [PointOfSail, [number, number]][]) {
      it(`${strength}, ${pos}: Half ${half}, Full ${full}, No Sail 0`, () => {
        const weather = { strength, direction: WIND };
        expect(sailMove('half', HEADING[pos], weather, DEFAULT_CONFIG)).toBe(half);
        expect(sailMove('full', HEADING[pos], weather, DEFAULT_CONFIG)).toBe(full);
        expect(sailMove('none', HEADING[pos], weather, DEFAULT_CONFIG)).toBe(0);
      });
    }
  }
});

describe('§6.1 basic sailing rule (Points of Sail off)', () => {
  const basic = makeConfig({ pointsOfSail: false });
  const EXPECTED: Record<WindStrength, [number, number]> = {
    deadCalm: [0, 0],
    light: [0, 1],
    firm: [1, 2],
    strong: [1, 3],
    gale: [2, 3],
  };
  for (const [strength, [half, full]] of Object.entries(EXPECTED) as [WindStrength, [number, number]][]) {
    it(`${strength}: Half ${half}, Full ${full}, whatever the heading`, () => {
      for (const heading of [0, 1, 2, 3, 4, 5] as const) {
        const weather = { strength, direction: WIND };
        expect(sailMove('half', heading, weather, basic)).toBe(half);
        expect(sailMove('full', heading, weather, basic)).toBe(full);
      }
    });
  }
});

describe('§3.5 weather modifiers', () => {
  it('matches the printed cards', () => {
    expect(weatherModifier('half', 'light')).toBe(-1);
    expect(weatherModifier('full', 'light')).toBe(-1);
    expect(weatherModifier('half', 'firm')).toBe(0);
    expect(weatherModifier('half', 'strong')).toBe(0);
    expect(weatherModifier('full', 'strong')).toBe(1);
    expect(weatherModifier('half', 'gale')).toBe(1);
    expect(weatherModifier('full', 'deadCalm')).toBe(0);
  });

  it('Gale: 1 DD per Full Sail only', () => {
    const gale = { strength: 'gale' as const, direction: WIND };
    expect(galeDamage('full', gale, DEFAULT_CONFIG)).toBe(1);
    expect(galeDamage('half', gale, DEFAULT_CONFIG)).toBe(0);
    expect(galeDamage('full', { strength: 'strong', direction: WIND }, DEFAULT_CONFIG)).toBe(0);
  });
});

describe('§5.2 wind drift by Part', () => {
  it('Gale drifts in Parts I–III, Strong in II–III, Firm in III, Light and Dead Calm never', () => {
    const parts = [1, 2, 3] as const;
    const drifts = (s: WindStrength) => parts.filter((p) => driftsInPart(s, p));
    expect(drifts('gale')).toEqual([1, 2, 3]);
    expect(drifts('strong')).toEqual([2, 3]);
    expect(drifts('firm')).toEqual([3]);
    expect(drifts('light')).toEqual([]);
    expect(drifts('deadCalm')).toEqual([]);
  });
});

describe('sail direction', () => {
  it('moves forwards, or backwards for a negative move', () => {
    expect(sailDirection(Direction.N, 2)).toBe(Direction.N);
    expect(sailDirection(Direction.N, 0)).toBe(Direction.N);
    expect(sailDirection(Direction.N, -1)).toBe(Direction.S);
  });
});
