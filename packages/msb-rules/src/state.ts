/**
 * Game state (engineering design §3). Plain JSON only: no classes, Maps, Sets or functions,
 * so a state can be saved, sent over a network and compared in tests.
 *
 * Teams, players and ships are separate from the start (NFR-13): a team has 1+ players,
 * a player commands 1–2 ships, and rules that count use ships.
 */

import type { Direction, Hex } from '@msb/hex';
import type { PendingDecision, ResolutionRecord } from '@msb/engine';
import type { CommandCard } from './cards';
import type { SailLevel } from './sailing';
import type { WeatherBoard, WeatherCard } from './weather';
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
  /** Whirlpool portal number; paired with the other hex of the same number (rules §3.2.1). */
  readonly whirlpool?: number;
}

/** A hex edge: the edge of `hex` (a hex key) on its `side`. */
export interface MapEdge {
  readonly hex: string;
  readonly side: Direction;
}

/** A sea cave mouth (rules §3.2.2): on the edge of an island hex, facing the sea hex on that side. Paired by letter. */
export interface MapCave extends MapEdge {
  readonly letter: string;
}

/** A map's rules content (engineering design §7.1). Grows with each rules step. */
export interface GameMap {
  readonly id: string;
  /** Keyed by `hexKey`. A hex not listed is off the map. */
  readonly hexes: Readonly<Record<string, MapHex>>;
  /** Wall reefs along hex edges (rules §3.2.0). */
  readonly wallReefs?: readonly MapEdge[];
  readonly caves?: readonly MapCave[];
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
  /** The command deck (rules §5.1: one shared deck). Content from `msb-data`. */
  readonly commandCards: readonly CommandCard[];
  /** The weather deck (rules §3.5). Content from `msb-data`. */
  readonly weatherCards: readonly WeatherCard[];
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
  /** Command card ids in hand (hidden from rivals). */
  hand: string[];
  /** Card id per slot key; cleared at the end of each turn. */
  program: Record<string, string>;
  /** Anchored this Part (rules §6.1): can't be moved by anything. */
  anchored: boolean;
  /** Parts sailed at Full Sail in a Gale this turn: 1 DD each at Upkeep (rules §3.5). */
  galeParts: number;
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
  weather: WeatherBoard;
  /** Command deck, top first (rules §5.1). */
  deck: string[];
  /** Cards discarded down to the hand limit this turn; they join the used cards at the end of the turn. */
  discards: string[];
  /** 0 while programming; 1–3 = the Part being resolved. Cards in Parts up to this one are revealed (D6). */
  part: number;
  /** Players who have finished programming this turn. */
  ready: PlayerId[];
  /** Present only while a turn is being resolved (engineering design §5). */
  resolution?: ResolutionRecord<GameState>;
  /** The question resolution is waiting for (present with `resolution`). */
  pending?: PendingDecision<unknown>;
}
