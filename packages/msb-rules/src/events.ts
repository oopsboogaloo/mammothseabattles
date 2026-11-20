/**
 * Events (engineering design §8): the only thing the client animates and captions.
 * Each carries the rules section it comes from and enough data to show it without reading the state.
 */

import type { Direction, Hex } from '@msb/hex';
import type { Part, SailLevel } from './sailing';
import type { PlayerId, ShipId } from './state';

export type DamageSource = 'roughWater' | 'storm' | 'cliff' | 'wallReef' | 'ram' | 'gale' | 'cannon' | 'portGuns';

export type SinkReason = 'row' | 'crew' | 'edge' | 'deathReef';

/** What moved a ship one hex (engineering design §6). */
export type MoveCause = 'sail' | 'row' | 'push' | 'current' | 'drift';

/** What stopped a ship (rules §3.2.0, §6.1, §6.5). */
export type StopReason = 'cliff' | 'beach' | 'wallReef' | 'ship' | 'anchored' | 'edge' | 'stuck';

export type GameEvent =
  | { readonly type: 'PlayerReady'; readonly rule: '5.1'; readonly player: PlayerId }
  | { readonly type: 'TurnStarted'; readonly rule: '5'; readonly turn: number }
  | {
      readonly type: 'PartStarted';
      readonly rule: '5.2';
      readonly part: Part;
      /** Each ship's cards for this Part, now revealed (D6): slot row → card id. */
      readonly revealed: Readonly<Record<ShipId, Readonly<Record<string, string>>>>;
    }
  | { readonly type: 'CardsDrawn'; readonly rule: '5.1'; readonly ship: ShipId; readonly count: number }
  | { readonly type: 'CardsReturned'; readonly rule: '5.1'; readonly count: number }
  | {
      readonly type: 'DamageRolled';
      readonly rule: '7.2';
      readonly ship: ShipId;
      readonly source: DamageSource;
      readonly dd: number;
      readonly rolls: readonly number[];
      readonly shipDamage: number;
      readonly crewDamage: number;
    }
  | { readonly type: 'SlotBlocked'; readonly rule: '7.3'; readonly ship: ShipId; readonly slot: string }
  | { readonly type: 'CrewWounded'; readonly rule: '7.4'; readonly ship: ShipId; readonly crew: string }
  | { readonly type: 'CrewKilled'; readonly rule: '7.4'; readonly ship: ShipId; readonly crew: string }
  | { readonly type: 'ShipSank'; readonly rule: '7.8'; readonly ship: ShipId; readonly reason: SinkReason }
  | { readonly type: 'WreckPlaced'; readonly rule: '7.9'; readonly at: Hex }
  | { readonly type: 'TreasureSpawned'; readonly rule: '8.2.1'; readonly point: string; readonly at: string }
  | { readonly type: 'TreasurePickedUp'; readonly rule: '8.2.2'; readonly ship: ShipId; readonly at: string }
  | { readonly type: 'TreasureKnockedLoose'; readonly rule: '8.2.3'; readonly ship: ShipId; readonly by: ShipId; readonly to: Hex }
  | { readonly type: 'TreasureDropped'; readonly rule: '7.8'; readonly ship: ShipId; readonly at: Hex }
  | { readonly type: 'TreasureScored'; readonly rule: '8.2.4'; readonly ship: ShipId; readonly team: string; readonly score: number }
  | { readonly type: 'GameWon'; readonly rule: '8.2.5'; readonly team: string }
  | { readonly type: 'WreckSearched'; readonly rule: '7.9'; readonly ship: ShipId; readonly at: string }
  | { readonly type: 'CrewGained'; readonly rule: '7.9'; readonly ship: ShipId; readonly crew: string; readonly replaced?: string }
  | { readonly type: 'ShipRefitted'; readonly rule: '7.7'; readonly ship: ShipId; readonly repair: boolean; readonly heal: boolean; readonly recruit: number }
  | { readonly type: 'WeatherAdvanced'; readonly rule: '3.5'; readonly now: string; readonly next: string; readonly space: number; readonly newFronts: number }
  | { readonly type: 'TideChanged'; readonly rule: '6.4'; readonly tide: 'high' | 'mid' | 'low' }
  | { readonly type: 'ShipStranded'; readonly rule: '6.7'; readonly ship: ShipId }
  | { readonly type: 'ShipFreed'; readonly rule: '6.7'; readonly ship: ShipId }
  | { readonly type: 'ShipReturned'; readonly rule: '7.8'; readonly ship: ShipId; readonly at: Hex; readonly heading: Direction }
  | { readonly type: 'CannonFired'; readonly rule: '7.1'; readonly ship: ShipId; readonly targets: readonly ShipId[]; readonly spared: readonly ShipId[] }
  | { readonly type: 'PortGunsFired'; readonly rule: '8.2.4'; readonly team: string; readonly targets: readonly ShipId[] }
  | { readonly type: 'SlotRepaired'; readonly rule: '7.6'; readonly ship: ShipId; readonly slot: string }
  | { readonly type: 'CrewHealed'; readonly rule: '7.6'; readonly ship: ShipId; readonly crew: string }
  | { readonly type: 'CardLost'; readonly rule: '7.3'; readonly ship: ShipId; readonly slot: string; readonly card: string }
  | { readonly type: 'SailSet'; readonly rule: '6.1'; readonly ship: ShipId; readonly sail: SailLevel; readonly order: string }
  | { readonly type: 'ShipMoved'; readonly rule: '6'; readonly ship: ShipId; readonly from: Hex; readonly to: Hex; readonly cause: MoveCause }
  | { readonly type: 'ShipStopped'; readonly rule: '3.2.0'; readonly ship: ShipId; readonly at: Hex; readonly by: StopReason }
  | { readonly type: 'ShipRammed'; readonly rule: '6.5'; readonly ship: ShipId; readonly by: ShipId }
  | { readonly type: 'ShipTurned'; readonly rule: '5.2'; readonly ship: ShipId; readonly from: Direction; readonly to: Direction; readonly cause: 'steer' | 'cave' | 'current' }
  | { readonly type: 'Teleported'; readonly rule: '3.2.1'; readonly ship: ShipId; readonly from: Hex; readonly to: Hex }
  | { readonly type: 'WentThroughCave'; readonly rule: '3.2.2'; readonly ship: ShipId; readonly letter: string; readonly to: Hex }
  | {
      readonly type: 'DecisionRequested';
      readonly rule: '5';
      readonly player: PlayerId;
      readonly kind: string;
      readonly options: readonly unknown[];
      readonly defaultIndex: number;
    }
  | { readonly type: 'UpkeepStarted'; readonly rule: '5.4'; readonly turn: number }
  | { readonly type: 'SoloFinished'; readonly rule: '8.8'; readonly turns: number; readonly score: number };
