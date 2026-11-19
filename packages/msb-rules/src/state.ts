/**
 * Game state (engineering design §3). Plain JSON only: no classes, Maps, Sets or functions,
 * so a state can be saved, sent over a network and compared in tests.
 *
 * Teams, players and ships are separate from the start (NFR-13): a team has 1+ players,
 * a player commands 1–2 ships, and rules that count use ships.
 */

import type { Direction, Hex } from '@msb/hex';
import type { PendingDecision, ResolutionRecord } from '@msb/engine';
import type { SailLevel } from './sailing';
import type { CrewMember } from './shipboard';

export type TeamId = string;
export type PlayerId = string;
export type ShipId = string;

/** Rules §3.2.0. Land and sea are one field, so a hex can never be both. */
export type Terrain =
  | 'sea'
  | 'cliff'
  | 'beach'
  | 'sandbank'
  | 'underwaterReef'
  | 'deathReef'
  | 'roughWater'
  | 'storm';

export interface MapHex {
  readonly terrain: Terrain;
}

/** A map's rules content (engineering design §7.1). Grows with each rules step. */
export interface GameMap {
  readonly id: string;
  /** Keyed by `hexKey`. A hex not listed is off the map. */
  readonly hexes: Readonly<Record<string, MapHex>>;
}

export interface SeatSetup {
  readonly player: PlayerId;
  readonly team: TeamId;
  readonly name: string;
  /** Home port hex (rules §8.2.4) and the heading the ship starts with there. */
  readonly homePort: Hex;
  readonly heading: Direction;
}

export interface GameSetup {
  readonly seed: number;
  readonly map: GameMap;
  /** One ship per seat for now; Fleets (2 ships per player) come later. */
  readonly seats: readonly SeatSetup[];
}

export interface ShipCrew extends CrewMember {
  readonly captain: boolean;
}

export type ShipStatus = 'afloat' | 'sunk';

export interface Ship {
  id: ShipId;
  player: PlayerId;
  pos: Hex;
  heading: Direction;
  sail: SailLevel;
  status: ShipStatus;
  /** Damage markers, as slot keys (`sail1` … `action3`), rules §7.3. */
  blocked: string[];
  crew: ShipCrew[];
}

export interface Team {
  id: TeamId;
  players: PlayerId[];
  homePort: Hex;
}

export interface Player {
  id: PlayerId;
  team: TeamId;
  name: string;
  ships: ShipId[];
}

export type Phase = 'programming' | 'resolving';

export interface GameState {
  setup: GameSetup;
  rng: number;
  turn: number;
  phase: Phase;
  teams: Record<TeamId, Team>;
  players: Record<PlayerId, Player>;
  ships: Record<ShipId, Ship>;
  /** Players who have finished programming this turn. */
  ready: PlayerId[];
  /** Present only while a turn is being resolved (engineering design §5). */
  resolution?: ResolutionRecord<GameState>;
  /** The question resolution is waiting for (present with `resolution`). */
  pending?: PendingDecision<unknown>;
}
