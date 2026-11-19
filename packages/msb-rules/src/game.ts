/**
 * Mammoth Sea Battles as a GameDef (engineering design §4): setup, legal actions, apply, views.
 *
 * Phases so far: programming (each player marks ready; cards come in step P2), then resolving, which may stop
 * for decisions (engineering design §5). Answers are option indexes.
 */

import {
  answerResolution,
  runResolution,
  seedRng,
  startResolution,
  type GameDef,
  type PendingDecision,
  type ResolutionOutcome,
} from '@msb/engine';
import { DEFAULT_CONFIG, type RulesConfig } from './config';
import type { GameEvent } from './events';
import type { GameSetup, GameState, PlayerId, Ship, ShipCrew } from './state';
import { resolveTurn } from './turn';

export type Action = { readonly type: 'ready' } | { readonly type: 'answer'; readonly choice: number };

/** What a player may see (engineering design §9). Grows as hidden information arrives (hands, programs). */
export interface GameView {
  readonly turn: number;
  readonly phase: GameState['phase'];
  readonly ships: Readonly<Record<string, Ship>>;
  readonly ready: readonly PlayerId[];
  /** The question being asked, if any; options are shown only to the player who must answer. */
  readonly decision?: { readonly player: PlayerId; readonly kind: string; readonly options?: readonly unknown[]; readonly defaultIndex?: number };
}

/** Starting crew (rules §4): the Captain (3 card icons) and 2 crew. Core game: Pirates, 1 icon each. */
export function startingCrew(shipId: string): ShipCrew[] {
  return [
    { id: `${shipId}-captain`, state: 'healthy', cardIcons: 3, captain: true },
    { id: `${shipId}-pirate-1`, state: 'healthy', cardIcons: 1, captain: false },
    { id: `${shipId}-pirate-2`, state: 'healthy', cardIcons: 1, captain: false },
  ];
}

export function newGame(setup: GameSetup): GameState {
  if (setup.seats.length < 2) throw new Error('A game needs at least 2 seats (rules §2)');
  const state: GameState = {
    setup,
    rng: seedRng(setup.seed),
    turn: 1,
    phase: 'programming',
    teams: {},
    players: {},
    ships: {},
    ready: [],
  };
  for (const seat of setup.seats) {
    if (state.players[seat.player]) throw new Error(`Duplicate player ${seat.player}`);
    const shipId = `${seat.player}-ship`;
    const team = state.teams[seat.team] ?? { id: seat.team, players: [], homePort: seat.homePort };
    team.players.push(seat.player);
    state.teams[seat.team] = team;
    state.players[seat.player] = { id: seat.player, team: seat.team, name: seat.name, ships: [shipId] };
    state.ships[shipId] = {
      id: shipId,
      player: seat.player,
      pos: seat.homePort,
      heading: seat.heading,
      sail: 'none',
      status: 'afloat',
      blocked: [],
      crew: startingCrew(shipId),
    };
  }
  return state;
}

/** The decision a paused resolution is waiting for. */
export function pendingDecision(state: GameState): PendingDecision<unknown> | undefined {
  return state.pending;
}

function settle(previous: GameState, outcome: ResolutionOutcome<GameState, GameEvent>): { state: GameState; events: GameEvent[] } {
  if (outcome.kind === 'done') return { state: outcome.state, events: outcome.events };
  const { decision } = outcome;
  const events: GameEvent[] = [
    ...outcome.events,
    {
      type: 'DecisionRequested',
      rule: '5',
      player: decision.player,
      kind: decision.kind,
      options: decision.options,
      defaultIndex: decision.defaultIndex,
    },
  ];
  return { state: { ...previous, phase: 'resolving', resolution: outcome.record, pending: decision }, events };
}

export function createGame(config: RulesConfig = DEFAULT_CONFIG): GameDef<GameState, Action, GameView, GameEvent, GameSetup, undefined> {
  const script = resolveTurn(config);
  return {
    init: newGame,

    legalActions(state, player) {
      if (state.phase === 'programming') {
        return state.players[player] && !state.ready.includes(player) ? [{ type: 'ready' }] : [];
      }
      const decision = state.pending as PendingDecision<unknown>;
      return decision.player === player ? decision.options.map((_, choice) => ({ type: 'answer', choice })) : [];
    },

    apply(state, player, action) {
      const legal = this.legalActions(state, player);
      if (!legal.some((a) => JSON.stringify(a) === JSON.stringify(action))) {
        throw new Error(`Illegal action ${JSON.stringify(action)} for ${player} in phase ${state.phase}`);
      }
      if (action.type === 'ready') {
        const ready = [...state.ready, player];
        const next: GameState = { ...state, ready };
        const events: GameEvent[] = [{ type: 'PlayerReady', rule: '5.1', player }];
        if (ready.length < Object.keys(state.players).length) return { state: next, events };
        const { resolution: _r, pending: _p, ...snapshot } = next;
        const out = settle(next, runResolution(startResolution<GameState>(snapshot), script));
        return { state: out.state, events: [...events, ...out.events] };
      }
      return settle(state, answerResolution(state.resolution as NonNullable<GameState['resolution']>, action.choice, script));
    },

    view(state, player) {
      const decision = state.pending;
      const base = { turn: state.turn, phase: state.phase, ships: state.ships, ready: state.ready };
      if (!decision) return base;
      return {
        ...base,
        decision:
          decision.player === player
            ? { player: decision.player, kind: decision.kind, options: decision.options, defaultIndex: decision.defaultIndex }
            : { player: decision.player, kind: decision.kind },
      };
    },

    result() {
      return undefined;
    },
  };
}
