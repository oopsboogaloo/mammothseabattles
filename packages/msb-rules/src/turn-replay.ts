/**
 * Turn replay (engineering design §11): rebuild the last turn played from the setup and action log, split its events into
 * **beats** (one thing a player would describe: "Player 1 sails Full Sail 3 hexes", "the current carries her", "the port guns
 * fire"), and work out the board after each beat, so a player can step forward and back through the turn.
 * Pure: the client draws the beats and snapshots.
 */

import { hexKey, type Direction, type Hex } from '@msb/hex';
import type { LogEntry } from '@msb/engine';
import type { RulesConfig } from './config';
import type { GameEvent } from './events';
import { createGame, type Action } from './game';
import type { SailLevel } from './sailing';
import type { GameSetup, GameState, TreasureKind } from './state';
import type { Tide } from './weather';
import { tide } from './weather';

/** What a beat is about, for its caption, its highlight and its place on the scrubber. */
export type BeatKind =
  | 'reveal' // a Part starts: everyone's cards for it are revealed
  | 'sail' // a ship's Move: sail level set, then her whole path (pushes, rams, stops, portals, treasure on the way)
  | 'steer'
  | 'current' // one current step (move and/or turn)
  | 'fire'
  | 'action' // Repair or Heal
  | 'portGuns'
  | 'hazard' // rough water or storm at the end of a Part, Gale damage at Upkeep
  | 'drift'
  | 'upkeep'
  | 'return'
  | 'refit'
  | 'wreck'
  | 'treasure' // a new treasure appears
  | 'weather'
  | 'other';

export interface Beat {
  readonly kind: BeatKind;
  /** 1–3 for the Parts, 4 for Upkeep. */
  readonly part: number;
  /** The ship the beat is about, if one. */
  readonly ship?: string;
  readonly events: readonly GameEvent[];
}

/** A ship as the board shows her. */
export interface ReplayShip {
  readonly hex: Hex;
  readonly heading: Direction;
  readonly sail: SailLevel;
  readonly afloat: boolean;
  readonly cargo?: TreasureKind;
  /** Damaged slots (`sail1` …). */
  readonly blocked: readonly string[];
}

/** The board at one moment of the replay. */
export interface BoardSnapshot {
  readonly ships: Readonly<Record<string, ReplayShip>>;
  /** Loose treasure: hex key → piece. */
  readonly loose: Readonly<Record<string, TreasureKind>>;
  /** Pieces brought home, per team. */
  readonly holds: Readonly<Record<string, readonly TreasureKind[]>>;
  /** The weather card now, and the tide. */
  readonly weather: string;
  readonly tide: Tide;
  /** The Part being played (0 before the first, 4 at Upkeep), and the cards revealed for it: ship → row → card. */
  readonly part: number;
  readonly revealed: Readonly<Record<string, Readonly<Record<string, string>>>>;
}

/** The last turn played: the state just before it resolved, its events, and the state after. */
export interface PlayedTurn {
  readonly turn: number;
  readonly start: GameState;
  readonly events: readonly GameEvent[];
  readonly end: GameState;
}

export interface TurnReplay extends PlayedTurn {
  readonly beats: readonly Beat[];
  /** `snapshots[0]` is the board before the turn; `snapshots[i + 1]` is the board after `beats[i]`. */
  readonly snapshots: readonly BoardSnapshot[];
}

/**
 * The last turn that has been played through to its end (Upkeep, or the end of the game), or undefined before the first.
 * A turn still waiting on a decision doesn't count yet.
 */
export function lastTurn(setup: GameSetup, log: readonly LogEntry<Action>[], config: RulesConfig): PlayedTurn | undefined {
  const game = createGame(config);
  let state = game.init(setup);
  let found: PlayedTurn | undefined;
  let current: { start: GameState; events: GameEvent[] } | undefined;
  for (const entry of log) {
    const before = state;
    const out = game.apply(state, entry.player, entry.action);
    state = out.state;
    // The action that started resolving the turn (the last Ready) begins it; its state before is the turn's start.
    if (!current && out.events.some((e) => e.type === 'PartStarted')) current = { start: before, events: [] };
    if (!current) continue;
    current.events.push(...out.events.filter((e) => e.type !== 'PlayerReady'));
    if (state.phase !== 'resolving') {
      found = { turn: current.start.turn, start: current.start, events: current.events, end: state };
      current = undefined;
    }
  }
  return found;
}

/** Does this event start a new beat? Returns the beat's kind and ship, or undefined to add it to the beat before. */
function beatOf(e: GameEvent, prev: Beat | undefined, last: GameEvent | undefined): { kind: BeatKind; ship?: string } | undefined {
  switch (e.type) {
    case 'PartStarted':
      return { kind: 'reveal' };
    case 'SailSet':
      return { kind: 'sail', ship: e.ship };
    case 'ShipMoved':
      if (e.cause === 'current') return { kind: 'current', ship: e.ship };
      if (e.cause === 'drift') return { kind: 'drift', ship: e.ship };
      return undefined;
    case 'ShipTurned':
      if (e.cause === 'steer') return { kind: 'steer', ship: e.ship };
      // A current that turns her as it moves her is one beat.
      if (e.cause === 'current') {
        const sameStep = prev?.kind === 'current' && prev.ship === e.ship && last?.type === 'ShipMoved' && last.ship === e.ship;
        return sameStep ? undefined : { kind: 'current', ship: e.ship };
      }
      return undefined;
    case 'CannonFired':
      return { kind: 'fire', ship: e.ship };
    case 'SlotRepaired':
    case 'CrewHealed':
      return { kind: 'action', ship: e.ship };
    case 'PortGunsFired':
      return { kind: 'portGuns' };
    case 'DamageRolled':
      return e.source === 'roughWater' || e.source === 'storm' || e.source === 'gale' ? { kind: 'hazard', ship: e.ship } : undefined;
    case 'UpkeepStarted':
      return { kind: 'upkeep' };
    case 'ShipReturned':
      return { kind: 'return', ship: e.ship };
    case 'ShipRefitted':
      return { kind: 'refit', ship: e.ship };
    case 'WreckSearched':
      return { kind: 'wreck', ship: e.ship };
    case 'TreasureSpawned':
      return { kind: 'treasure' };
    case 'WeatherAdvanced':
      return { kind: 'weather' };
    default:
      return prev ? undefined : { kind: 'other' };
  }
}

/** The turn's events, grouped into beats in order. */
export function beatsOf(events: readonly GameEvent[]): Beat[] {
  const beats: { kind: BeatKind; part: number; ship?: string; events: GameEvent[] }[] = [];
  let part = 0;
  let last: GameEvent | undefined;
  for (const e of events) {
    if (e.type === 'PlayerReady') continue;
    if (e.type === 'PartStarted') part = e.part;
    if (e.type === 'UpkeepStarted') part = 4;
    const start = beatOf(e, beats.at(-1), last);
    if (start) beats.push({ kind: start.kind, part, ...(start.ship ? { ship: start.ship } : {}), events: [e] });
    else (beats.at(-1) as { events: GameEvent[] }).events.push(e);
    last = e;
  }
  return beats;
}

/** The board as a state shows it. */
export function snapshotOf(state: GameState): BoardSnapshot {
  return {
    ships: Object.fromEntries(
      Object.values(state.ships).map((s) => [
        s.id,
        { hex: s.pos, heading: s.heading, sail: s.sail, afloat: s.status === 'afloat', ...(s.cargo ? { cargo: s.cargo } : {}), blocked: [...s.blocked] },
      ]),
    ),
    loose: Object.fromEntries(state.treasures.map((k) => [k, state.treasureKinds[k] as TreasureKind])),
    holds: Object.fromEntries(Object.values(state.teams).map((t) => [t.id, [...t.hold]])),
    weather: state.weather.spaces[state.weather.now] as string,
    tide: tide(state.weather),
    part: state.part,
    revealed: {},
  };
}

/** The board after a beat's events. */
export function applyBeat(before: BoardSnapshot, beat: Beat): BoardSnapshot {
  const ships: Record<string, ReplayShip & { cargo?: TreasureKind }> = Object.fromEntries(Object.entries(before.ships).map(([id, s]) => [id, { ...s }]));
  const loose: Record<string, TreasureKind> = { ...before.loose };
  const holds: Record<string, TreasureKind[]> = Object.fromEntries(Object.entries(before.holds).map(([t, h]) => [t, [...h]]));
  let { weather, tide: tideNow, part, revealed } = before;
  const set = (id: string, change: Partial<ReplayShip>) => Object.assign(ships[id] as object, change);
  const uncargo = (id: string) => delete (ships[id] as { cargo?: TreasureKind }).cargo;
  for (const e of beat.events) {
    switch (e.type) {
      case 'PartStarted':
        part = e.part;
        revealed = e.revealed;
        break;
      case 'UpkeepStarted':
        part = 4;
        revealed = {};
        break;
      case 'SailSet':
        set(e.ship, { sail: e.sail });
        break;
      case 'ShipMoved':
      case 'Teleported':
      case 'WentThroughCave':
        set(e.ship, { hex: e.to });
        break;
      case 'ShipTurned':
        set(e.ship, { heading: e.to });
        break;
      case 'ShipSank':
        set(e.ship, { afloat: false });
        break;
      case 'ShipReturned':
        set(e.ship, { hex: e.at, heading: e.heading, afloat: true, sail: 'none', blocked: [] });
        break;
      case 'SlotBlocked':
        set(e.ship, { blocked: [...(ships[e.ship] as ReplayShip).blocked, e.slot] });
        break;
      case 'SlotRepaired':
        set(e.ship, { blocked: (ships[e.ship] as ReplayShip).blocked.filter((s) => s !== e.slot) });
        break;
      case 'ShipRefitted':
        if (e.repair) set(e.ship, { blocked: [] });
        break;
      case 'TreasureSpawned':
        loose[e.at] = e.kind;
        break;
      case 'TreasurePickedUp':
        delete loose[e.at];
        set(e.ship, { cargo: e.kind });
        break;
      case 'TreasureKnockedLoose':
      case 'TreasureDropped':
        uncargo(e.ship);
        loose[hexKey(e.type === 'TreasureDropped' ? e.at : e.to)] = e.kind;
        break;
      case 'TreasureScored':
        uncargo(e.ship);
        (holds[e.team] ??= []).push(e.kind);
        break;
      case 'WeatherAdvanced':
        weather = e.now;
        break;
      case 'TideChanged':
        tideNow = e.tide;
        break;
      default:
        break;
    }
  }
  return { ships, loose, holds, weather, tide: tideNow, part, revealed };
}

/** The last turn played, as beats and a board snapshot after each; undefined before the first turn has been played. */
export function turnReplay(setup: GameSetup, log: readonly LogEntry<Action>[], config: RulesConfig): TurnReplay | undefined {
  const played = lastTurn(setup, log, config);
  if (!played) return undefined;
  const beats = beatsOf(played.events);
  const snapshots = [snapshotOf(played.start)];
  for (const beat of beats) snapshots.push(applyBeat(snapshots.at(-1) as BoardSnapshot, beat));
  return { ...played, beats, snapshots };
}
