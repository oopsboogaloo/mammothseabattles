import { describe, expect, it } from 'vitest';
import {
  Rng,
  createDecision,
  nextFloat,
  nextInt,
  resolveDecision,
  rollDie,
  seedRng,
  shuffle,
} from '@msb/engine';

describe('seeded RNG (NFR-3 determinism)', () => {
  it('produces the same sequence from the same seed', () => {
    const a = new Rng(seedRng(42));
    const b = new Rng(seedRng(42));
    const seqA = Array.from({ length: 20 }, () => a.float());
    const seqB = Array.from({ length: 20 }, () => b.float());
    expect(seqA).toEqual(seqB);
    expect(a.state).toBe(b.state);
  });

  it('produces different sequences from different seeds', () => {
    const [x] = nextFloat(seedRng(1));
    const [y] = nextFloat(seedRng(2));
    expect(x).not.toBe(y);
  });

  it('normalises seeds to unsigned 32-bit', () => {
    expect(seedRng(-1)).toBe(4294967295);
  });

  it('keeps floats in [0, 1)', () => {
    const rng = new Rng(7);
    for (let i = 0; i < 10_000; i++) {
      const f = rng.float();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
    }
  });

  it('rolls every face of a die, and only those faces, roughly evenly', () => {
    const rng = new Rng(123);
    const counts = new Array(12).fill(0) as number[];
    const n = 120_000;
    for (let i = 0; i < n; i++) {
      const roll = rng.die(12);
      expect(roll).toBeGreaterThanOrEqual(1);
      expect(roll).toBeLessThanOrEqual(12);
      counts[roll - 1]!++;
    }
    for (const c of counts) expect(Math.abs(c - n / 12)).toBeLessThan(n / 12 * 0.05);
  });

  it('nextInt is inclusive and functional', () => {
    const [v, s] = nextInt(seedRng(5), 3, 3);
    expect(v).toBe(3);
    expect(s).not.toBe(seedRng(5));
    const [d] = rollDie(seedRng(5), 6);
    expect(d).toBeGreaterThanOrEqual(1);
  });

  it('rejects invalid ranges', () => {
    expect(() => nextInt(0, 5, 4)).toThrow(RangeError);
    expect(() => nextInt(0, 0.5, 4)).toThrow(RangeError);
    expect(() => nextInt(0, 0, 4.5)).toThrow(RangeError);
  });

  it('shuffles deterministically without mutating the input', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const [a] = shuffle(seedRng(9), input);
    const [b] = shuffle(seedRng(9), input);
    expect(a).toEqual(b);
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...a].sort()).toEqual(input);
    const rng = new Rng(9);
    expect(rng.shuffle(input)).toEqual(a);
  });

  it('shuffles empty and single-item arrays', () => {
    expect(shuffle(1, [])[0]).toEqual([]);
    expect(shuffle(1, ['x'])[0]).toEqual(['x']);
  });
});

describe('decisions during resolution (web-spec §3.2)', () => {
  it('resolves the chosen option, or the default on timeout', () => {
    const d = createDecision('placeShipDamage', 'p1', ['sail1', 'steer2', 'action3'], 1);
    expect(d.timeoutSeconds).toBe(60);
    expect(resolveDecision(d, 2)).toBe('action3');
    expect(resolveDecision(d)).toBe('steer2');
  });

  it('rejects decisions with no options or a bad default', () => {
    expect(() => createDecision('x', 'p1', [])).toThrow();
    expect(() => createDecision('x', 'p1', ['a'], 1)).toThrow(RangeError);
    expect(() => createDecision('x', 'p1', ['a'], -1)).toThrow(RangeError);
    expect(() => createDecision('x', 'p1', ['a'], 0.5)).toThrow(RangeError);
  });

  it('rejects illegal choices', () => {
    const d = createDecision('x', 'p1', ['a', 'b'], 0, 5);
    expect(d.timeoutSeconds).toBe(5);
    expect(() => resolveDecision(d, 2)).toThrow(RangeError);
    expect(() => resolveDecision(d, -1)).toThrow(RangeError);
    expect(() => resolveDecision(d, 1.5)).toThrow(RangeError);
  });
});
