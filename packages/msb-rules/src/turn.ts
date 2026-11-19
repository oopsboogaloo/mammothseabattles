/**
 * Resolving a turn (rules §5.2): Parts I–III, then Upkeep (§5.4).
 *
 * Built up one rules step at a time (implementation plan). Implemented so far:
 * - §5.2 step 6, end of Part: rough water 2 DD, storm 3 DD (§3.2.0), with damage placement (§7.2–7.4).
 * Movement, currents, actions and drift come in steps P3–P5; Upkeep in P6.
 */

import { hexKey } from '@msb/hex';
import type { ResolutionContext } from '@msb/engine';
import type { RulesConfig } from './config';
import type { DamageSource, GameEvent } from './events';
import type { Part } from './sailing';
import { PARTS } from './shipboard';
import type { GameState, Player, Ship } from './state';
import { takeDamage } from './take-damage';

/** Ships in seat order (setup order). Used where the rules give no initiative order. */
export function shipsInSeatOrder(state: GameState): Ship[] {
  return state.setup.seats.flatMap((seat) => (state.players[seat.player] as Player).ships.map((id) => state.ships[id] as Ship));
}

/** §5.2 step 6: damage from the hex a ship ends the Part in. */
export function endOfPartHazard(state: GameState, ship: Ship, config: RulesConfig): { dd: number; source: DamageSource } | undefined {
  const terrain = state.setup.map.hexes[hexKey(ship.pos)]?.terrain;
  if (terrain === 'roughWater') return { dd: config.dd.roughWater, source: 'roughWater' };
  if (terrain === 'storm') return { dd: config.dd.storm, source: 'storm' };
  return undefined;
}

function endOfPart(state: GameState, part: Part, config: RulesConfig, ctx: ResolutionContext<GameEvent>): void {
  for (const ship of shipsInSeatOrder(state)) {
    if (ship.status !== 'afloat') continue;
    const hazard = endOfPartHazard(state, ship, config);
    if (hazard) takeDamage(state, ship.id, hazard.dd, hazard.source, part, config, ctx);
  }
}

/** The resolution script for one turn. Runs on a private copy of the state (engineering design §5). */
export function resolveTurn(config: RulesConfig) {
  return (state: GameState, ctx: ResolutionContext<GameEvent>): GameState => {
    for (const part of PARTS) {
      ctx.emit({ type: 'PartStarted', rule: '5.2', part });
      endOfPart(state, part, config, ctx);
    }
    ctx.emit({ type: 'UpkeepStarted', rule: '5.4', turn: state.turn });
    state.turn += 1;
    state.phase = 'programming';
    state.ready = [];
    ctx.emit({ type: 'TurnStarted', rule: '5', turn: state.turn });
    return state;
  };
}
