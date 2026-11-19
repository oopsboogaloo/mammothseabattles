/**
 * Events (engineering design §8): the only thing the client animates and captions.
 * Each carries the rules section it comes from and enough data to show it without reading the state.
 */

import type { Part } from './sailing';
import type { PlayerId, ShipId } from './state';

export type DamageSource = 'roughWater' | 'storm';

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
  | { readonly type: 'ShipSank'; readonly rule: '7.8'; readonly ship: ShipId; readonly reason: 'row' | 'crew' }
  | {
      readonly type: 'DecisionRequested';
      readonly rule: '5';
      readonly player: PlayerId;
      readonly kind: string;
      readonly options: readonly unknown[];
      readonly defaultIndex: number;
    }
  | { readonly type: 'UpkeepStarted'; readonly rule: '5.4'; readonly turn: number };
