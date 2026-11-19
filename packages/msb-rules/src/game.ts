/**
 * Mammoth Sea Battles as a GameDef (engineering design §4): setup, legal actions, apply, views.
 *
 * Phases: programming (place cards, discard down to the hand limit, mark ready; rules §5.1), then resolving, which may stop
 * for decisions (engineering design §5). Answers are option indexes.
 */

import {
  Rng,
  answerResolution,
  runResolution,
  seedRng,
  startResolution,
  type GameDef,
  type PendingDecision,
  type ResolutionOutcome,
} from '@msb/engine';
import { hexKey } from '@msb/hex';
import { validateCards } from './cards';
import { validateMap } from './map';
import { DEFAULT_CONFIG, type RulesConfig } from './config';
import type { GameEvent } from './events';
import { applyProgramming, drawCards, programmingActions, type ProgramAction } from './programming';
import type { GameSetup, GameState, PlayerId, Ship, ShipCrew } from './state';
import { setUpWeather, tide, type Tide } from './weather';
import { spawnTreasure, treasuresInPlay } from './treasure';
import { resolveTurn, shipsInSeatOrder } from './turn';

export type Action = ProgramAction | { readonly type: 'answer'; readonly choice: number };

/** A ship as one player sees her (engineering design §9). */
export interface ShipView extends Omit<Ship, 'hand' | 'program'> {
  readonly handSize: number;
  /** Only for the player's own ships and teammates' ships (rules §8.6). */
  readonly hand?: readonly string[];
  /** Slot key → card id, or 'hidden' for a rival's card in a Part not yet revealed (D6). */
  readonly program: Readonly<Record<string, string>>;
}

export interface GameView {
  readonly turn: number;
  readonly phase: GameState['phase'];
  readonly part: number;
  readonly deckSize: number;
  readonly ships: Readonly<Record<string, ShipView>>;
  readonly ready: readonly PlayerId[];
  /** The face-up weather (rules §3.5: the current card and the next one) and the tide. Other spaces stay hidden. */
  readonly weather: { readonly now: string; readonly next: string; readonly space: number; readonly tide: Tide };
  /** Loose treasure on the map (hex keys), each team's score, and the winner once there is one (rules §8.2). */
  readonly treasures: readonly string[];
  readonly scores: Readonly<Record<string, number>>;
  readonly winner?: string;
  /** The question being asked, if any; options are shown only to the player who must answer. */
  readonly decision?: { readonly player: PlayerId; readonly kind: string; readonly options?: readonly unknown[]; readonly defaultIndex?: number };
}

export const HIDDEN = 'hidden';

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
  validateCards(setup.commandCards);
  validateMap(setup.map);
  const rng = new Rng(seedRng(setup.seed));
  const weather = setUpWeather(setup.weatherCards, rng.state);
  rng.state = weather.rng;
  const state: GameState = {
    weather: weather.board,
    setup,
    rng: 0,
    turn: 1,
    phase: 'programming',
    teams: {},
    players: {},
    ships: {},
    deck: rng.shuffle(setup.commandCards.map((c) => c.id)),
    discards: [],
    wrecks: [...(setup.map.startWrecks ?? [])],
    treasures: [],
    treasureDeck: [],
    pendingSpawns: 0,
    part: 0,
    ready: [],
  };
  state.rng = rng.state;
  for (const seat of setup.seats) {
    if (state.players[seat.player]) throw new Error(`Duplicate player ${seat.player}`);
    const shipId = `${seat.player}-ship`;
    const team = state.teams[seat.team] ?? { id: seat.team, players: [], homePort: seat.homePort, score: 0 };
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
      hand: [],
      program: {},
      anchored: false,
      stuck: false,
      refitting: false,
      carrying: false,
      galeParts: 0,
    };
  }
  const ports = new Set(setup.seats.map((s) => hexKey(s.homePort)));
  if (ports.size !== setup.seats.length) throw new Error('Two seats share a home port; ships must start on different hexes');
  for (const ship of shipsInSeatOrder(state)) drawCards(state, ship);
  // §8.2.1: the starting treasures, spawned with the treasure map deck.
  state.treasureDeck = rng.shuffle(Object.keys(setup.map.spawnPoints ?? {}));
  state.rng = rng.state;
  for (let i = 0; i < treasuresInPlay(setup.seats.length); i++) spawnTreasure(state, () => undefined);
  return state;
}

/** The decision a paused resolution is waiting for. */
export function pendingDecision(state: GameState): PendingDecision<unknown> | undefined {
  return state.pending;
}

function settle(outcome: ResolutionOutcome<GameState, GameEvent>): { state: GameState; events: GameEvent[] } {
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
  // The authoritative state is the turn part-way through; the record keeps the snapshot to re-run from (D1).
  return { state: { ...outcome.partial, phase: 'resolving', resolution: outcome.record, pending: decision }, events };
}

/** Whether `viewer` may see `ship`'s hand and program: her own ships and her team's (rules §8.6). */
export function canSeeHand(state: GameState, viewer: PlayerId, ship: Ship): boolean {
  return state.players[viewer]?.team === state.players[ship.player]?.team;
}

export function viewShip(state: GameState, viewer: PlayerId, ship: Ship): ShipView {
  const { hand, program, ...open } = ship;
  if (canSeeHand(state, viewer, ship)) return { ...open, handSize: hand.length, hand, program };
  const shown: Record<string, string> = {};
  for (const [slot, card] of Object.entries(program)) {
    const part = Number(slot.slice(-1));
    shown[slot] = state.phase === 'resolving' && part <= state.part ? card : HIDDEN;
  }
  return { ...open, handSize: hand.length, program: shown };
}

export interface GameResult {
  readonly winner: string;
}

export function createGame(config: RulesConfig = DEFAULT_CONFIG): GameDef<GameState, Action, GameView, GameEvent, GameSetup, GameResult> {
  const script = resolveTurn(config);
  return {
    init: newGame,

    legalActions(state, player) {
      if (state.phase === 'over') return [];
      if (state.phase === 'programming') return programmingActions(state, player, config);
      const decision = state.pending as PendingDecision<unknown>;
      return decision.player === player ? decision.options.map((_, choice) => ({ type: 'answer', choice })) : [];
    },

    apply(state, player, action) {
      const legal = this.legalActions(state, player);
      if (!legal.some((a) => JSON.stringify(a) === JSON.stringify(action))) {
        throw new Error(`Illegal action ${JSON.stringify(action)} for ${player} in phase ${state.phase}`);
      }
      if (action.type === 'answer') {
        return settle(answerResolution(state.resolution as NonNullable<GameState['resolution']>, action.choice, script));
      }
      if (action.type !== 'ready') return { state: applyProgramming(state, action), events: [] };
      const ready = [...state.ready, player];
      const next: GameState = { ...state, ready };
      const events: GameEvent[] = [{ type: 'PlayerReady', rule: '5.1', player }];
      if (ready.length < Object.keys(state.players).length) return { state: next, events };
      const out = settle(runResolution(startResolution<GameState>({ ...next, phase: 'resolving' }), script));
      return { state: out.state, events: [...events, ...out.events] };
    },

    view(state, player) {
      const ships: Record<string, ShipView> = {};
      for (const ship of Object.values(state.ships)) ships[ship.id] = viewShip(state, player, ship);
      const { spaces, now } = state.weather;
      const weather = { now: spaces[now] as string, next: spaces[(now + 1) % 6] as string, space: now, tide: tide(state.weather) };
      const scores = Object.fromEntries(Object.values(state.teams).map((t) => [t.id, t.score]));
      const base = {
        turn: state.turn,
        phase: state.phase,
        part: state.part,
        deckSize: state.deck.length,
        ships,
        ready: state.ready,
        weather,
        treasures: state.treasures,
        scores,
        ...(state.winner === undefined ? {} : { winner: state.winner }),
      };
      const decision = state.pending;
      if (!decision) return base;
      return {
        ...base,
        decision:
          decision.player === player
            ? { player: decision.player, kind: decision.kind, options: decision.options, defaultIndex: decision.defaultIndex }
            : { player: decision.player, kind: decision.kind },
      };
    },

    result(state) {
      return state.winner === undefined ? undefined : { winner: state.winner };
    },
  };
}
