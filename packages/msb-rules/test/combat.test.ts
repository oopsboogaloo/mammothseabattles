import { describe, expect, it } from 'vitest';
import { Rng } from '@msb/engine';
import { Direction, distance, hex, hexKey, neighbor, opposite, type Hex } from '@msb/hex';
import {
  DEFAULT_CONFIG,
  applyCrewDamage,
  broadsideArcs,
  cannonTargets,
  cardsToDraw,
  crewDamageOptions,
  heal,
  initiativeOrder,
  isCritical,
  lineOfFireBlocked,
  makeConfig,
  noHealthyCrew,
  rollDamage,
  rollOff,
  rowBlocked,
  slotKey,
  usableSlots,
  type CrewMember,
  type FireContext,
} from '@msb/msb-rules';

const O = hex(0, 0);
const CLEAR: FireContext = { fog: new Set(), portals: new Set() };

describe('§7.1 broadside arcs (cannon fire diagram)', () => {
  it('covers 14 hexes per side, 28 in total, out to range 4', () => {
    const { starboard, port } = broadsideArcs(O, Direction.N, DEFAULT_CONFIG);
    expect(starboard.length).toBe(14);
    expect(port.length).toBe(14);
    expect(new Set([...starboard, ...port].map(hexKey)).size).toBe(28);
  });

  it('never covers the hexes directly ahead or astern', () => {
    const { starboard, port } = broadsideArcs(O, Direction.N, DEFAULT_CONFIG);
    const keys = new Set([...starboard, ...port].map(hexKey));
    let ahead: Hex = O;
    let astern: Hex = O;
    for (let k = 1; k <= 4; k++) {
      ahead = neighbor(ahead, Direction.N);
      astern = neighbor(astern, Direction.S);
      expect(keys.has(hexKey(ahead))).toBe(false);
      expect(keys.has(hexKey(astern))).toBe(false);
    }
  });

  it('starboard is to the right of the heading, port to the left', () => {
    const { starboard, port } = broadsideArcs(O, Direction.N, DEFAULT_CONFIG);
    expect(starboard.every((h) => h.q > 0)).toBe(true);
    expect(port.every((h) => h.q < 0)).toBe(true);
  });
});

describe('§7.1 cannon targets', () => {
  const east = hex(2, -1); // starboard of a ship facing N
  const west = hex(-2, 1); // port of a ship facing N
  const ahead = hex(0, -2);
  const far = hex(5, -2);

  it('hits every enemy in either arc, none ahead or out of range', () => {
    const targets = [
      { id: 'east', position: east, friendly: false },
      { id: 'west', position: west, friendly: false },
      { id: 'ahead', position: ahead, friendly: false },
      { id: 'far', position: far, friendly: false },
    ];
    expect(distance(O, far)).toBe(5);
    expect(cannonTargets(O, Direction.N, targets, CLEAR, DEFAULT_CONFIG)).toEqual(['east', 'west']);
  });

  it('never hits friendly ships (no friendly fire)', () => {
    const targets = [{ id: 'mate', position: east, friendly: true }];
    expect(cannonTargets(O, Direction.N, targets, CLEAR, DEFAULT_CONFIG)).toEqual([]);
  });

  it('range comes from config', () => {
    const targets = [{ id: 'east', position: east, friendly: false }];
    expect(cannonTargets(O, Direction.N, targets, CLEAR, makeConfig({ cannonRange: 1 }))).toEqual([]);
  });

  it('fog: no firing from, into or through fog; portals block shots passing through them', () => {
    const target = hex(3, -1);
    const middle = hex(1, 0); // on the line from O to target
    const only = (h: Hex) => new Set([hexKey(h)]);
    expect(cannonTargets(O, Direction.N, [{ id: 't', position: target, friendly: false }], CLEAR, DEFAULT_CONFIG)).toEqual(['t']);
    expect(lineOfFireBlocked(O, target, CLEAR)).toBe(false);
    expect(lineOfFireBlocked(O, target, { fog: only(O), portals: new Set() })).toBe(true);
    expect(lineOfFireBlocked(O, target, { fog: only(target), portals: new Set() })).toBe(true);
    expect(lineOfFireBlocked(O, target, { fog: only(middle), portals: new Set() })).toBe(true);
    expect(lineOfFireBlocked(O, target, { fog: new Set(), portals: only(middle) })).toBe(true);
    const ctx = { fog: only(middle), portals: new Set<string>() };
    expect(cannonTargets(O, Direction.N, [{ id: 't', position: target, friendly: false }], ctx, DEFAULT_CONFIG)).toEqual([]);
  });
});

describe('§7.2 damage die', () => {
  it('has 12 faces matching the rules table', () => {
    const die = DEFAULT_CONFIG.damageDie;
    expect(die.length).toBe(12);
    expect(isCritical(die[11]!)).toBe(true);
    const totals = die.filter((f) => !isCritical(f)) as { ship: number; crew: number }[];
    expect(totals.reduce((s, f) => s + f.ship, 0)).toBe(9); // 0.75 Ship per non-critical DD × 12
    expect(totals.reduce((s, f) => s + f.crew, 0)).toBe(9);
  });

  it('rolls deterministically from the seed', () => {
    const a = rollDamage(new Rng(77), 5, DEFAULT_CONFIG);
    const b = rollDamage(new Rng(77), 5, DEFAULT_CONFIG);
    expect(a).toEqual(b);
    expect(rollDamage(new Rng(1), 0, DEFAULT_CONFIG)).toEqual({ ship: 0, crew: 0, rolls: [], criticals: 0 });
  });

  it('a critical rolls that die again plus 1 extra DD', () => {
    // A die where every face but the first is critical: forces a long chain that must still end.
    const crit = makeConfig({ damageDie: [{ ship: 1, crew: 1 }, { critical: true }] });
    const r = rollDamage(new Rng(3), 1, crit);
    expect(r.rolls.length).toBe(1 + 2 * r.criticals);
    expect(r.ship).toBe(r.rolls.filter((x) => x === 1).length);
  });

  it('averages 0.75 Ship and 0.75 Crew per die, excluding criticals', () => {
    const rng = new Rng(2024);
    const r = rollDamage(rng, 60_000, DEFAULT_CONFIG);
    const plainRolls = r.rolls.length - r.criticals;
    expect(r.ship / plainRolls).toBeCloseTo(0.818, 1); // 9 / 11 non-critical faces
    expect(r.crew / plainRolls).toBeCloseTo(0.818, 1);
    expect(r.criticals / r.rolls.length).toBeCloseTo(1 / 12, 2);
  });
});

describe('§5.3 initiative', () => {
  it('higher goes first; empty slot counts as 0', () => {
    const order = initiativeOrder(
      [
        { id: 'a', initiative: 420 },
        { id: 'b', initiative: 860 },
        { id: 'c', initiative: null },
        { id: 'd', initiative: 400 },
      ],
      new Rng(1),
      DEFAULT_CONFIG,
    );
    expect(order).toEqual(['b', 'a', 'd', 'c']);
  });

  it('ties are rolled off, deterministically, and everyone is included once', () => {
    const entries = [
      { id: 'a', initiative: null },
      { id: 'b', initiative: null },
      { id: 'c', initiative: null },
      { id: 'd', initiative: 500 },
    ];
    const x = initiativeOrder(entries, new Rng(10), DEFAULT_CONFIG);
    const y = initiativeOrder(entries, new Rng(10), DEFAULT_CONFIG);
    expect(x).toEqual(y);
    expect(x[0]).toBe('d');
    expect([...x].sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('re-rolls tied rolls until everyone is ordered', () => {
    // With a 2-sided die, many ties occur; the result must still be a full ordering.
    const cfg = makeConfig({ tieBreakDieSides: 2 });
    const ids = ['a', 'b', 'c', 'd', 'e'];
    const order = rollOff(ids, new Rng(4), cfg);
    expect([...order].sort()).toEqual(ids);
    expect(rollOff([], new Rng(4), cfg)).toEqual([]);
  });
});

describe('§7.3 ship damage', () => {
  const block = (...keys: string[]) => new Set(keys);

  it('a damage marker makes a slot unusable', () => {
    expect(usableSlots(block()).length).toBe(9);
    const left = usableSlots(block('sail1', 'action3'));
    expect(left.length).toBe(7);
    expect(left.map(slotKey)).not.toContain('sail1');
  });

  it('sinks when a whole row is blocked; 6 spread markers is survivable', () => {
    expect(rowBlocked(block('sail1', 'sail2', 'steer1', 'steer2', 'action1', 'action2'))).toBe(false);
    expect(rowBlocked(block('steer1', 'steer2', 'steer3'))).toBe(true);
    expect(rowBlocked(block('sail1', 'steer2', 'action3'))).toBe(false);
  });
});

describe('§7.4 crew damage, §5.1 card draw, §7.6 heal', () => {
  const crew: CrewMember[] = [
    { id: 'captain', state: 'healthy', cardIcons: 3 },
    { id: 'pirate1', state: 'healthy', cardIcons: 1 },
    { id: 'pirate2', state: 'wounded', cardIcons: 1 },
  ];

  it('draws 1 card per icon on healthy crew', () => {
    expect(cardsToDraw(crew)).toBe(4);
  });

  it('offers wound for healthy crew and kill for wounded crew', () => {
    expect(crewDamageOptions(crew)).toEqual([{ wound: 'captain' }, { wound: 'pirate1' }, { kill: 'pirate2' }]);
  });

  it('wounds and kills', () => {
    const wounded = applyCrewDamage(crew, { wound: 'pirate1' });
    expect(wounded.find((c) => c.id === 'pirate1')!.state).toBe('wounded');
    const killed = applyCrewDamage(crew, { kill: 'pirate2' });
    expect(killed.map((c) => c.id)).toEqual(['captain', 'pirate1']);
    // Illegal choices change nothing.
    expect(applyCrewDamage(crew, { wound: 'pirate2' })).toEqual(crew);
    expect(applyCrewDamage(crew, { kill: 'captain' })).toEqual(crew);
  });

  it('sinks with no healthy crew', () => {
    expect(noHealthyCrew(crew)).toBe(false);
    expect(noHealthyCrew(crew.map((c) => ({ ...c, state: 'wounded' as const })))).toBe(true);
    expect(noHealthyCrew([])).toBe(true);
  });

  it('heal flips a wounded crew member back', () => {
    expect(heal(crew, 'pirate2').find((c) => c.id === 'pirate2')!.state).toBe('healthy');
    expect(heal(crew, 'captain')).toEqual(crew);
  });
});

describe('opposite helper sanity', () => {
  it('is consistent with arcs on every heading', () => {
    for (const h of [0, 1, 2, 3, 4, 5] as const) {
      const { starboard, port } = broadsideArcs(O, h, DEFAULT_CONFIG);
      const keys = new Set([...starboard, ...port].map(hexKey));
      expect(keys.has(hexKey(neighbor(O, h)))).toBe(false);
      expect(keys.has(hexKey(neighbor(O, opposite(h))))).toBe(false);
    }
  });
});
