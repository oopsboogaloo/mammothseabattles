import { describe, expect, it } from 'vitest';
import { Rng, type LogEntry } from '@msb/engine';
import { hex } from '@msb/hex';
import { prototypeSetup } from '@msb/msb-data';
import {
  auditGame,
  checkInvariants,
  compareTracked,
  createGame,
  describeAction,
  describeCard,
  describeEvent,
  describeState,
  followEvents,
  makeConfig,
  randomAction,
  trackedFrom,
  type Action,
  type GameState,
} from '@msb/msb-rules';

const config = makeConfig({});
const game = createGame(config);
const setup = (players = 2, seed = 3) => prototypeSetup(Array.from({ length: players }, (_, i) => ({ name: `P${i + 1}` })), seed);
const clone = (s: GameState) => JSON.parse(JSON.stringify(s)) as GameState;

/** A whole game of random players on the test map (caves, whirlpools, currents), as an action log. */
function randomGame(players: number, seed: number, turns: number): LogEntry<Action>[] {
  const rng = new Rng(seed);
  let state = game.init(setup(players, seed));
  const log: LogEntry<Action>[] = [];
  while (state.phase !== 'over' && state.turn <= turns) {
    const player = state.phase === 'resolving' ? (state.pending as { player: string }).player : Object.keys(state.players).find((p) => !state.ready.includes(p))!;
    const action = randomAction(game, state, player, rng)!;
    log.push({ player, action });
    state = game.apply(state, player, action).state;
  }
  return log;
}

describe('the game log (engineering design §11)', () => {
  it('a correct game has no problems, and the trace shows every action, card, event and state', () => {
    for (const [players, seed] of [[2, 1], [3, 2], [4, 3], [1, 4]] as const) {
      const log = randomGame(players, seed, 12);
      const { trace, problems } = auditGame(setup(players, seed), log, config);
      expect(problems).toEqual([]);
      expect(trace).toContain('== start');
      expect(trace).toMatch(/#0 P1 (place|ready)/);
      expect(trace).toContain('ShipMoved §6');
      expect(trace).toContain('== after');
    }
    // A turn waiting on a decision says so.
    const { trace } = auditGame(setup(2, 1), randomGame(2, 1, 12), config);
    expect(trace).toContain('… waiting for');
  });

  it('flags an action the engine refuses', () => {
    const { problems, trace } = auditGame(setup(), [{ player: 'P1', action: { type: 'place', ship: 'P1-ship', slot: 'sail1', card: 'nope' } }], config);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/^#0 \(turn 1\): the engine refused this action/);
    expect(trace).toContain('⚠ PROBLEM');
  });

  it('follows the ships event by event and flags moves that don’t fit', () => {
    const s = game.init(setup());
    const t = trackedFrom(s);
    const p1 = s.ships['P1-ship']!.pos;
    expect(
      followEvents(t, [
        { type: 'ShipMoved', rule: '6', ship: 'P1-ship', from: hex(9, 9), to: hex(-4, 0), cause: 'sail' },
        { type: 'ShipMoved', rule: '6', ship: 'P1-ship', from: hex(-4, 0), to: hex(-2, 0), cause: 'sail' },
        { type: 'ShipMoved', rule: '6', ship: 'P1-ship', from: hex(-2, 0), to: hex(0, 0), cause: 'current' },
        { type: 'ShipMoved', rule: '6', ship: 'P1-ship', from: hex(0, 0), to: hex(0, 3), cause: 'drift', cave: 'A' },
        { type: 'ShipTurned', rule: '5.2', ship: 'P1-ship', from: 5, to: 1, cause: 'steer' },
        { type: 'Teleported', rule: '3.2.1', ship: 'P1-ship', from: hex(7, 7), to: hex(1, 1) },
        { type: 'WentThroughCave', rule: '3.2.2', ship: 'P1-ship', letter: 'A', to: hex(2, 2) },
        { type: 'TurnStarted', rule: '5', turn: 2 },
      ]),
    ).toEqual([
      `P1-ship moved from 9,9, but the events had her at ${p1.q},${p1.r}`,
      'P1-ship moved 22 hexes in one step (sail)',
      'P1-ship moved 2 hexes in one step (sail)',
      `P1-ship turned from heading 5, but the events had her facing ${s.ships['P1-ship']!.heading}`,
      'P1-ship went into a whirlpool at 7,7, but the events had her at 0,3',
    ]);
    // Where the events left her against the state: position, heading, afloat.
    expect(compareTracked(t, s)).toEqual([`P1-ship is at ${p1.q},${p1.r} in the state, but the events put her at 2,2`]);
    const turned = trackedFrom(s);
    turned['P1-ship']!.heading = ((s.ships['P1-ship']!.heading + 1) % 6) as 0;
    expect(compareTracked(turned, s)[0]).toMatch(/^P1-ship faces \d in the state, but the events left her facing \d/);
    // A whirlpool entered from where she is: fine.
    const pool = trackedFrom(s);
    expect(followEvents(pool, [{ type: 'Teleported', rule: '3.2.1', ship: 'P1-ship', from: p1, to: hex(1, 1) }])).toEqual([]);
    expect(pool['P1-ship']!.pos).toEqual(hex(1, 1));
    const sunk = trackedFrom(s);
    expect(followEvents(sunk, [{ type: 'ShipSank', rule: '7.8', ship: 'P1-ship', reason: 'edge' }])).toEqual([]);
    expect(compareTracked(sunk, s)).toEqual(['P1-ship is afloat in the state, but the events left her sunk']);
    const back = clone(s);
    back.ships['P1-ship']!.status = 'sunk';
    expect(compareTracked(trackedFrom(s), back)).toEqual(['P1-ship is sunk in the state, but the events left her afloat']);
    followEvents(sunk, [{ type: 'ShipReturned', rule: '7.8', ship: 'P1-ship', at: p1, heading: s.ships['P1-ship']!.heading }]);
    expect(compareTracked(sunk, s)).toEqual([]);
    expect(compareTracked(trackedFrom(back), back)).toEqual([]); // a sunk ship's hex isn't checked
  });

  it('checks the rules that must always hold', () => {
    const s = game.init(setup());
    expect(checkInvariants(s)).toEqual([]);
    const bad = clone(s);
    bad.ships['P1-ship']!.pos = hex(9, 9);
    bad.ships['P2-ship']!.pos = hex(9, 9);
    bad.ships['P1-ship']!.hand.push(bad.deck[0]!, 'mystery');
    bad.deck.splice(1, 1);
    bad.treasures = ['9,9', '9,9'];
    bad.ships['P2-ship']!.carrying = true;
    bad.teams['T1']!.score = 1;
    expect([...checkInvariants(bad)].sort()).toEqual([
      'P1-ship is afloat off the map, at 9,9',
      'P2-ship is afloat off the map, at 9,9',
      'P2-ship and P1-ship are both in hex 9,9',
      `card ${s.deck[0]} is in 2 places`,
      `card ${s.deck[1]} is in 0 places`,
      'unknown card mystery in play',
      'treasure off the map, at 9,9',
      'treasure off the map, at 9,9',
      'two treasures in hex 9,9',
      'P2-ship is carrying treasure with no piece',
      'T1 scored 1 but has 0 pieces home',
    ].sort());
    // A sunk ship's hex doesn't matter.
    const wreck = clone(s);
    wreck.ships['P1-ship']!.status = 'sunk';
    wreck.ships['P1-ship']!.pos = hex(9, 9);
    expect(checkInvariants(wreck)).toEqual([]);
  });

  it('describes actions, cards, events and the state in plain lines', () => {
    const s = game.init(setup());
    const card = s.ships['P1-ship']!.hand[0]!;
    expect(describeCard(s, 'nope')).toBe('nope');
    expect(describeCard(s, card)).toMatch(new RegExp(`^${card} \\(\\w+ / \\w+ / \\w+\\)$`));
    expect(describeAction(s, 'P1', { type: 'place', ship: 'P1-ship', slot: 'sail1', card })).toBe(`P1 place sail1 = ${describeCard(s, card)}`);
    expect(describeAction(s, 'P1', { type: 'remove', ship: 'P1-ship', slot: 'sail1' })).toBe('P1 take back sail1');
    expect(describeAction(s, 'P1', { type: 'discard', ship: 'P1-ship', card })).toBe(`P1 discard ${describeCard(s, card)}`);
    expect(describeAction(s, 'P1', { type: 'ready' })).toBe('P1 ready');
    expect(describeAction(s, 'P1', { type: 'answer', choice: 2 })).toBe('P1 answer 2 (option 2 of "undefined")');
    const asked = clone(s);
    asked.pending = { kind: 'holdFire', player: 'P1', options: ['fire:P2-ship'], defaultIndex: 0, timeoutSeconds: 0 };
    expect(describeAction(asked, 'P1', { type: 'answer', choice: 0 })).toBe('P1 answer "fire:P2-ship" (option 0 of "holdFire")');
    expect(describeEvent({ type: 'ShipMoved', rule: '6', ship: 'P1-ship', from: hex(1, 2), to: hex(1, 3), cause: 'sail' })).toBe(
      'ShipMoved §6 {"ship":"P1-ship","from":"1,2","to":"1,3","cause":"sail"}',
    );
    const text = describeState(s);
    expect(text).toContain('turn 1, phase programming; ready: nobody');
    expect(text).toContain('wrecks:');
    expect(text).toContain('damaged slots: none');
    // Mid-game details: a Part, who's ready, no treasure or wrecks, a damaged, flagged ship with a program and no hand.
    const mid = clone(s);
    Object.assign(mid, { part: 2, ready: ['P1'], treasures: [], wrecks: [] });
    Object.assign(mid.ships['P1-ship']!, { anchored: true, stuck: true, refitting: true, carrying: true, cargo: 'gold', blocked: ['sail1'], program: { sail2: card }, hand: [] });
    const midText = describeState(mid);
    expect(midText).toContain('Part 2; ready: P1');
    expect(midText).toContain('treasure loose: none · wrecks: none');
    expect(midText).toContain('anchored, stranded, refitting, carrying gold');
    expect(midText).toContain('damaged slots: sail1');
    expect(midText).toContain(`program: sail2=${card}`);
    expect(midText).toContain('hand (0): empty');
  });
});
