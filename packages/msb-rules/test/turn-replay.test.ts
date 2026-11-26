import { describe, expect, it } from 'vitest';
import { Rng, type LogEntry } from '@msb/engine';
import { hex } from '@msb/hex';
import { prototypeSetup } from '@msb/msb-data';
import {
  applyBeat,
  beatsOf,
  createGame,
  lastTurn,
  makeConfig,
  randomAction,
  snapshotOf,
  turnReplay,
  type Action,
  type BoardSnapshot,
  type GameEvent,
  type GameState,
} from '@msb/msb-rules';

const config = makeConfig({ windDrift: true }); // drift on, so drift beats are exercised too
const game = createGame(config);
const setup = (players: number, seed: number) => prototypeSetup(Array.from({ length: players }, (_, i) => ({ name: `P${i + 1}` })), seed);

/** A random game, and the log length at the end of each turn (when a new turn's programming has just begun). */
function randomGame(players: number, seed: number, turns: number) {
  const rng = new Rng(seed);
  let state: GameState = game.init(setup(players, seed));
  const log: LogEntry<Action>[] = [];
  const turnEnds: number[] = [];
  while (state.phase !== 'over' && state.turn <= turns) {
    const player = state.phase === 'resolving' ? (state.pending as { player: string }).player : Object.keys(state.players).find((p) => !state.ready.includes(p))!;
    const before = state.turn;
    log.push({ player, action: randomAction(game, state, player, rng)! });
    state = game.apply(state, player, log.at(-1)!.action).state;
    if (state.turn !== before || state.phase === 'over') turnEnds.push(log.length);
  }
  return { log, turnEnds };
}

/** What the board shows, without the replay-only fields. */
const board = (s: BoardSnapshot) => ({ ships: s.ships, loose: s.loose, holds: s.holds, weather: s.weather, tide: s.tide });

describe('turn replay (engineering design §11)', () => {
  it('stepping through a turn beat by beat ends exactly where the engine ended it, every turn of real games', () => {
    const kinds = new Set<string>();
    for (const [players, seed] of [[2, 1], [3, 2], [4, 3], [2, 5]] as const) {
      const { log, turnEnds } = randomGame(players, seed, 10);
      for (const n of turnEnds) {
        const r = turnReplay(setup(players, seed), log.slice(0, n), config)!;
        expect(board(r.snapshots[0]!)).toEqual(board(snapshotOf(r.start)));
        expect(board(r.snapshots.at(-1)!)).toEqual(board(snapshotOf(r.end)));
        expect(r.snapshots).toHaveLength(r.beats.length + 1);
        // Every event of the turn is in exactly one beat, in order.
        expect(r.beats.flatMap((b) => b.events)).toEqual(r.events);
        for (const b of r.beats) kinds.add(b.kind);
      }
    }
    for (const k of ['reveal', 'sail', 'steer', 'current', 'fire', 'drift', 'upkeep', 'weather']) expect(kinds).toContain(k);
  }, 60_000);

  it('the last turn is the last one finished: none before the first, and not one still waiting on a decision', () => {
    expect(lastTurn(setup(2, 1), [], config)).toBeUndefined();
    const { log, turnEnds } = randomGame(2, 1, 6);
    const first = lastTurn(setup(2, 1), log.slice(0, turnEnds[0]), config)!;
    expect(first.turn).toBe(1);
    expect(first.end.turn).toBe(2);
    // Part-way into the next turn (programming, or waiting on a decision), the last turn is still turn 1.
    for (let n = turnEnds[0]! + 1; n < turnEnds[1]!; n++) expect(lastTurn(setup(2, 1), log.slice(0, n), config)!.turn).toBe(1);
  }, 60_000);

  it('groups events into beats: a whole move is one beat, a current that moves and turns her is one, the rest start their own', () => {
    const at = hex(0, 0), to = hex(1, 0);
    const events: GameEvent[] = [
      { type: 'PlayerReady', rule: '5.1', player: 'P1' },
      { type: 'TurnStarted', rule: '5', turn: 1 }, // nothing before it: a beat of its own
      { type: 'PartStarted', rule: '5.2', part: 1, revealed: { 'A-ship': { sail: '700' } } },
      { type: 'SailSet', rule: '6.1', ship: 'A-ship', sail: 'full', order: 'full' },
      { type: 'ShipMoved', rule: '6', ship: 'A-ship', from: at, to, cause: 'sail' },
      { type: 'ShipStopped', rule: '3.2.0', ship: 'A-ship', at: to, by: 'cliff' },
      { type: 'DamageRolled', rule: '7.2', ship: 'A-ship', source: 'cliff', dd: 2, rolls: [1, 2], shipDamage: 1, crewDamage: 0 },
      { type: 'ShipTurned', rule: '5.2', ship: 'A-ship', from: 0, to: 1, cause: 'steer' },
      { type: 'ShipMoved', rule: '6', ship: 'A-ship', from: to, to: at, cause: 'current' },
      { type: 'ShipTurned', rule: '5.2', ship: 'A-ship', from: 1, to: 2, cause: 'current' },
      { type: 'ShipTurned', rule: '5.2', ship: 'A-ship', from: 2, to: 3, cause: 'current' }, // an eddy: turned without moving
      { type: 'ShipTurned', rule: '5.2', ship: 'A-ship', from: 3, to: 4, cause: 'cave' },
      { type: 'CannonFired', rule: '7.1', ship: 'A-ship', targets: [], spared: [] },
      { type: 'SlotRepaired', rule: '7.6', ship: 'A-ship', slot: 'sail1' },
      { type: 'CrewHealed', rule: '7.6', ship: 'A-ship', crew: 'c' },
      { type: 'PortGunsFired', rule: '8.2.4', team: 'T2', targets: ['A-ship'] },
      { type: 'DamageRolled', rule: '7.2', ship: 'A-ship', source: 'roughWater', dd: 1, rolls: [1], shipDamage: 0, crewDamage: 0 },
      { type: 'ShipMoved', rule: '6', ship: 'A-ship', from: at, to, cause: 'drift' },
      { type: 'UpkeepStarted', rule: '5.4', turn: 1 },
      { type: 'DamageRolled', rule: '7.2', ship: 'A-ship', source: 'gale', dd: 1, rolls: [1], shipDamage: 0, crewDamage: 0 },
      { type: 'ShipReturned', rule: '7.8', ship: 'B-ship', at, heading: 0 },
      { type: 'ShipRefitted', rule: '7.7', ship: 'A-ship', repair: true, heal: false, recruit: 0 },
      { type: 'WreckSearched', rule: '7.9', ship: 'A-ship', at: '0,0' },
      { type: 'TreasureSpawned', rule: '8.2.1', point: '1', at: '2,0', kind: 'gold' },
      { type: 'WeatherAdvanced', rule: '3.5', now: 'firm-n-1', next: 'light-s', space: 1, newFronts: 0 },
    ];
    const beats = beatsOf(events);
    expect(beats.map((b) => `${b.kind}${b.ship ? `:${b.ship}` : ''}@${b.part}/${b.events.length}`)).toEqual([
      'other@0/1',
      'reveal@1/1',
      'sail:A-ship@1/4',
      'steer:A-ship@1/1',
      'current:A-ship@1/2',
      'current:A-ship@1/2', // the eddy's turn, with the cave turn after it
      'fire:A-ship@1/1',
      'action:A-ship@1/1',
      'action:A-ship@1/1',
      'portGuns@1/1',
      'hazard:A-ship@1/1',
      'drift:A-ship@1/1',
      'upkeep@4/1',
      'hazard:A-ship@4/1',
      'return:B-ship@4/1',
      'refit:A-ship@4/1',
      'wreck:A-ship@4/1',
      'treasure@4/1',
      'weather@4/1',
    ]);
  });

  it('follows the board through every kind of event', () => {
    const start: BoardSnapshot = {
      ships: { 'A-ship': { hex: hex(0, 0), heading: 0, sail: 'none', afloat: true, blocked: [] }, 'B-ship': { hex: hex(2, 0), heading: 3, sail: 'none', afloat: true, cargo: 'ruby', blocked: [] } },
      loose: { '1,0': 'gold' },
      holds: { T1: [] },
      weather: 'firm-n-1',
      tide: 'mid',
      part: 0,
      revealed: {},
    };
    const step = (s: BoardSnapshot, events: GameEvent[]) => applyBeat(s, { kind: 'other', part: 1, events });
    let s = step(start, [
      { type: 'PartStarted', rule: '5.2', part: 2, revealed: { 'A-ship': { sail: '700' } } },
      { type: 'SailSet', rule: '6.1', ship: 'A-ship', sail: 'full', order: 'full' },
      { type: 'ShipMoved', rule: '6', ship: 'A-ship', from: hex(0, 0), to: hex(1, 0), cause: 'sail' },
      { type: 'TreasurePickedUp', rule: '8.2.2', ship: 'A-ship', at: '1,0', kind: 'gold' },
      { type: 'ShipTurned', rule: '5.2', ship: 'A-ship', from: 0, to: 2, cause: 'steer' },
      { type: 'Teleported', rule: '3.2.1', ship: 'A-ship', from: hex(1, 0), to: hex(3, 0) },
      { type: 'WentThroughCave', rule: '3.2.2', ship: 'A-ship', letter: 'A', to: hex(4, 0) },
      { type: 'SlotBlocked', rule: '7.3', ship: 'A-ship', slot: 'sail1' },
      { type: 'SlotBlocked', rule: '7.3', ship: 'A-ship', slot: 'steer1' },
      { type: 'SlotRepaired', rule: '7.6', ship: 'A-ship', slot: 'sail1' },
      { type: 'TreasureKnockedLoose', rule: '8.2.3', ship: 'B-ship', by: 'A-ship', to: hex(2, 1), kind: 'ruby' },
      { type: 'TideChanged', rule: '6.4', tide: 'low' },
    ]);
    expect(s).toMatchObject({ part: 2, revealed: { 'A-ship': { sail: '700' } }, tide: 'low', loose: { '2,1': 'ruby' } });
    expect(s.ships['A-ship']).toEqual({ hex: hex(4, 0), heading: 2, sail: 'full', afloat: true, cargo: 'gold', blocked: ['steer1'] });
    expect(s.ships['B-ship']!.cargo).toBeUndefined();
    expect(start.ships['A-ship']!.hex).toEqual(hex(0, 0)); // the snapshot before is untouched
    s = step(s, [
      { type: 'TreasureScored', rule: '8.2.4', ship: 'A-ship', team: 'T1', score: 1, kind: 'gold' },
      { type: 'ShipRefitted', rule: '7.7', ship: 'A-ship', repair: false, heal: true, recruit: 0 },
      { type: 'TreasureDropped', rule: '7.8', ship: 'B-ship', at: hex(2, 0), kind: 'pearl' },
      { type: 'ShipSank', rule: '7.8', ship: 'B-ship', reason: 'crew' },
      { type: 'UpkeepStarted', rule: '5.4', turn: 1 },
      { type: 'ShipRefitted', rule: '7.7', ship: 'A-ship', repair: true, heal: true, recruit: 0 },
      { type: 'WeatherAdvanced', rule: '3.5', now: 'light-s', next: 'dead-calm', space: 2, newFronts: 0 },
      { type: 'TreasureSpawned', rule: '8.2.1', point: '1', at: '5,0', kind: 'rum' },
    ]);
    expect(s).toMatchObject({ part: 4, revealed: {}, weather: 'light-s', holds: { T1: ['gold'] }, loose: { '2,1': 'ruby', '2,0': 'pearl', '5,0': 'rum' } });
    expect(s.ships['A-ship']).toMatchObject({ blocked: [] });
    expect(s.ships['A-ship']!.cargo).toBeUndefined();
    expect(s.ships['B-ship']!.afloat).toBe(false);
    s = step(s, [
      { type: 'ShipReturned', rule: '7.8', ship: 'B-ship', at: hex(5, 0), heading: 4 },
      { type: 'TreasureScored', rule: '8.2.4', ship: 'B-ship', team: 'T2', score: 1, kind: 'rum' },
    ]);
    expect(s.ships['B-ship']).toEqual({ hex: hex(5, 0), heading: 4, sail: 'none', afloat: true, blocked: [] });
    expect(s.holds['T2']).toEqual(['rum']);
  });
});
