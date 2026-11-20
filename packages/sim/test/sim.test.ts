import { describe, expect, it } from 'vitest';
import { hex } from '@msb/hex';
import type { GameEvent } from '@msb/msb-rules';
import { formatTable, newTally, runExperiment, runGame, spread, summarize, tallyEvents, type GameReport } from '@msb/sim';

describe('counting what happens', () => {
  it('tallies every kind of event the reports use, and ignores the rest', () => {
    const t = newTally();
    const events: GameEvent[] = [
      { type: 'ShipSank', rule: '7.8', ship: 'a', reason: 'edge' },
      { type: 'ShipSank', rule: '7.8', ship: 'b', reason: 'edge' },
      { type: 'CannonFired', rule: '7.1', ship: 'a', targets: ['b', 'c'], spared: [] },
      { type: 'ShipRammed', rule: '6.5', ship: 'b', by: 'a' },
      { type: 'TreasurePickedUp', rule: '8.2.2', ship: 'a', at: '0,0', kind: 'gold' },
      { type: 'TreasureKnockedLoose', rule: '8.2.3', ship: 'a', by: 'b', to: hex(0, 0), kind: 'gold' },
      { type: 'Teleported', rule: '3.2.1', ship: 'a', from: hex(0, 0), to: hex(1, 0) },
      { type: 'WentThroughCave', rule: '3.2.2', ship: 'a', letter: 'A', to: hex(0, 0) },
      { type: 'ShipStranded', rule: '6.7', ship: 'a' },
      { type: 'DamageRolled', rule: '7.2', ship: 'a', source: 'storm', dd: 3, rolls: [1, 2, 3], shipDamage: 1, crewDamage: 0 },
      { type: 'TurnStarted', rule: '5', turn: 2 },
    ];
    tallyEvents(t, events);
    expect(t).toEqual({
      sinkings: { edge: 2 },
      damageBySource: { storm: 1 },
      cannonHits: 2,
      rams: 1,
      treasuresPickedUp: 1,
      treasuresKnockedLoose: 1,
      whirlpools: 1,
      caves: 1,
      strandings: 1,
    });
  });
});

describe('playing games (engineering design §10)', () => {
  it('plays a Solo Challenge to its last turn, the same way every time', () => {
    const a = runGame({ players: 1, seed: 2, beam: 1 });
    expect(a).toMatchObject({ players: 1, turns: 14, finished: true });
    expect(a.winner).toBeUndefined();
    expect(a.scores).toHaveLength(1);
    expect(runGame({ players: 1, seed: 2, beam: 1 })).toEqual(a);
  }, 60_000);

  it('stops at the turn limit, and rule changes are applied', () => {
    const r = runGame({ players: 2, seed: 1, maxTurns: 2, beam: 1, rules: { safeEdge: true } });
    expect(r).toMatchObject({ turns: 2, finished: false, players: 2 });
    expect(r.sinkings['edge']).toBeUndefined();
  }, 60_000);

  it('names the winning seat when a team reaches the target', () => {
    const r = runGame({ players: 2, seed: 3, beam: 1, rules: { treasureTarget: 1 } });
    expect(r.finished).toBe(true);
    expect([1, 2]).toContain(r.winner);
    expect(Math.max(...r.scores)).toBe(1);
  }, 60_000);
});

describe('summaries and tables', () => {
  const report = (over: Partial<GameReport>): GameReport => ({
    seed: 1,
    players: 2,
    turns: 10,
    finished: true,
    scores: [1, 0],
    sinkings: {},
    damageBySource: {},
    cannonHits: 0,
    rams: 0,
    treasuresPickedUp: 0,
    treasuresKnockedLoose: 0,
    whirlpools: 0,
    caves: 0,
    strandings: 0,
    ...over,
  });

  it('averages, spreads and win rates by seat', () => {
    expect(spread([])).toEqual({ mean: 0, min: 0, max: 0 });
    const s = summarize('base', [
      report({ winner: 1, turns: 10, sinkings: { edge: 2 }, cannonHits: 4 }),
      report({ winner: 2, turns: 20, scores: [0, 3], damageBySource: { ram: 1 } }),
      report({ winner: 2, turns: 30 }),
      report({ finished: false, turns: 60 }),
    ]);
    expect(s).toMatchObject({ games: 4, players: 2, finishedRate: 0.75, turns: { mean: 30, min: 10, max: 60 } });
    expect(s.winRateBySeat).toEqual([1 / 3, 2 / 3]);
    expect(s.sinkingsPerGame).toEqual({ edge: 0.5 });
    expect(s.damagePerGame).toEqual({ ram: 0.25 });
    expect(s.perGame.cannonHits).toBe(1);
    expect(s.score).toEqual({ mean: 0.75, min: 0, max: 3 });
    // No games, and games nobody won.
    expect(summarize('none', [])).toMatchObject({ games: 0, players: 0, finishedRate: 0, winRateBySeat: [] });
    expect(summarize('draws', [report({ finished: false })]).winRateBySeat).toEqual([0, 0]);
  });

  it('a Markdown table with one column per variant', () => {
    const a = summarize('base', [report({ winner: 1, sinkings: { edge: 1 } })]);
    const b = summarize('safe-edge', [report({ winner: 2, damageBySource: { cliff: 2 } })]);
    const table = formatTable([a, b]);
    expect(table.split('\n')[0]).toBe('| | base | safe-edge |');
    expect(table).toContain('| Wins, seat 1 | 100% | 0% |');
    expect(table).toContain('| Sinkings per game: edge | 1 | 0 |');
    expect(table).toContain('| Times damaged per game: cliff | 0 | 2 |');
    expect(table).toContain('| Treasure home per ship |');
    const solo = formatTable([summarize('solo', [report({ players: 1, scores: [2] })])]);
    expect(solo).toContain('| Solo score (treasure in the turn limit) | 2 (2–2) |');
    expect(solo).not.toContain('Wins, seat');
    // A seat that only exists in a bigger game shows a dash.
    expect(formatTable([summarize('two', [report({ winner: 1 })]), summarize('one', [report({ players: 1, scores: [0] })])])).toContain('| Wins, seat 1 | 100% | — |');
    expect(formatTable([]).split('\n')[0]).toBe('| |  |');
  });

  it('plays the same deals under each variant', () => {
    const seen: string[] = [];
    const out = runExperiment([{ name: 'base' }, { name: 'safe', rules: { safeEdge: true } }], {
      players: 2,
      games: 1,
      maxTurns: 1,
      beam: 1,
      onGame: (v, r) => seen.push(`${v}:${r.seed}`),
    });
    expect(out.map((s) => s.name)).toEqual(['base', 'safe']);
    expect(seen).toEqual(['base:1', 'safe:1']);
    expect(runExperiment([{ name: 'x' }], { players: 1, games: 1, firstSeed: 5, beam: 1 })[0]!.games).toBe(1);
    // The AI's normal search width when none is given.
    expect(runExperiment([{ name: 'y' }], { players: 1, games: 1, maxTurns: 1 })[0]!.turns.mean).toBe(1);
  }, 120_000);
});
