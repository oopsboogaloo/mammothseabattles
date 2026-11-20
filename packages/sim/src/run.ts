/**
 * The simulator (engineering design §10): plays whole games with every seat taken by the AI and records what happened, so rules
 * questions can be answered with numbers ("is the map edge too harsh?", "how long is a game?", "does seat 1 have an edge?").
 * Pure and deterministic: the same options always give the same games.
 */

import { prototypeSetup } from '@msb/msb-data';
import { answerDecision, programmingTurn, type AiLevel } from '@msb/msb-ai';
import { createGame, makeConfig, newGame, type GameEvent, type GameState, type RulesConfig } from '@msb/msb-rules';

export interface GameOptions {
  readonly players: number;
  readonly seed: number;
  /** Rule changes to try, on top of the defaults (rules config, web-spec §3.3). */
  readonly rules?: Partial<RulesConfig>;
  /** Stop a game that hasn't ended after this many turns (the Solo Challenge always ends at its limit). */
  readonly maxTurns?: number;
  /** AI search width: smaller is faster and a little weaker. */
  readonly beam?: number;
  /** Difficulty level for each seat in turn (engineering design §10); when given, it replaces `beam`. */
  readonly levels?: readonly AiLevel[];
}

/** What happened in one game. Seats are numbered from 1, as on the start screen. */
export interface GameReport {
  readonly seed: number;
  readonly players: number;
  readonly turns: number;
  /** True if a team reached the target (or a Solo Challenge reached its last turn); false if it hit `maxTurns`. */
  readonly finished: boolean;
  /** Winning seat, if any. */
  readonly winner?: number;
  /** Treasure brought home by each seat. */
  readonly scores: readonly number[];
  /** Ships sunk, by cause (rules §7.8). */
  readonly sinkings: Readonly<Record<string, number>>;
  readonly cannonHits: number;
  readonly rams: number;
  readonly treasuresPickedUp: number;
  readonly treasuresKnockedLoose: number;
  readonly whirlpools: number;
  readonly caves: number;
  readonly strandings: number;
  /** Times a ship took damage, by source (rules §7.2), counting each damage event once however many dice it rolled. */
  readonly damageBySource: Readonly<Record<string, number>>;
}

const count = (into: Record<string, number>, key: string) => {
  into[key] = (into[key] ?? 0) + 1;
};

/** Running totals while a game plays. */
export interface Tally {
  readonly sinkings: Record<string, number>;
  readonly damageBySource: Record<string, number>;
  cannonHits: number;
  rams: number;
  treasuresPickedUp: number;
  treasuresKnockedLoose: number;
  whirlpools: number;
  caves: number;
  strandings: number;
}

export function newTally(): Tally {
  return { sinkings: {}, damageBySource: {}, cannonHits: 0, rams: 0, treasuresPickedUp: 0, treasuresKnockedLoose: 0, whirlpools: 0, caves: 0, strandings: 0 };
}

/** Add a batch of events to the totals. */
export function tallyEvents(t: Tally, events: readonly GameEvent[]): void {
  for (const e of events) {
    if (e.type === 'ShipSank') count(t.sinkings, e.reason);
    else if (e.type === 'CannonFired') t.cannonHits += e.targets.length;
    else if (e.type === 'ShipRammed') t.rams++;
    else if (e.type === 'TreasurePickedUp') t.treasuresPickedUp++;
    else if (e.type === 'TreasureKnockedLoose') t.treasuresKnockedLoose++;
    else if (e.type === 'Teleported') t.whirlpools++;
    else if (e.type === 'WentThroughCave') t.caves++;
    else if (e.type === 'ShipStranded') t.strandings++;
    else if (e.type === 'DamageRolled') count(t.damageBySource, e.source);
  }
}

/** Play one game to the end (or to `maxTurns`) with the AI in every seat. */
export function runGame(options: GameOptions): GameReport {
  const config = makeConfig({ ...options.rules });
  const game = createGame(config);
  const setup = prototypeSetup(
    Array.from({ length: options.players }, (_, i) => ({ name: `AI ${i + 1}` })),
    options.seed,
  );
  let state: GameState = newGame(setup);
  const maxTurns = options.maxTurns ?? 60;
  const tally = newTally();
  const note = (events: readonly GameEvent[]) => tallyEvents(tally, events);
  while (state.phase !== 'over' && state.turn <= maxTurns) {
    if (state.phase === 'resolving') {
      const player = (state.pending as { player: string }).player;
      const out = game.apply(state, player, answerDecision(state, config));
      state = out.state;
      note(out.events);
      continue;
    }
    // Programming: each seat in turn; the last Ready starts the turn.
    const seat = setup.seats.find((s) => !state.ready.includes(s.player)) as { player: string };
    const level = options.levels?.[setup.seats.indexOf(seat as (typeof setup.seats)[number])];
    for (const action of programmingTurn(state, seat.player, config, options.beam, level)) {
      const out = game.apply(state, seat.player, action);
      state = out.state;
      note(out.events);
    }
  }
  const seatOf = (team: string) => setup.seats.findIndex((s) => s.team === team) + 1;
  return {
    seed: options.seed,
    players: options.players,
    turns: state.phase === 'over' ? state.turn : state.turn - 1,
    finished: state.phase === 'over',
    ...(state.winner === undefined ? {} : { winner: seatOf(state.winner) }),
    scores: setup.seats.map((s) => (state.teams[s.team] as { score: number }).score),
    ...tally,
  };
}
