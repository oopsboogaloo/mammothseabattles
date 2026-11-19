/**
 * Sinking and coming back (rules §7.8, §7.9).
 * A ship sinks at once and leaves a shipwreck where she sank; she comes back at Upkeep at her home port.
 */

import { createDecision, type ResolutionContext } from '@msb/engine';
import { hexEquals, hexKey, neighbor, type Direction, type Hex } from '@msb/hex';
import type { GameEvent, SinkReason } from './events';
import { isLand } from './map';
import { tide } from './weather';
import type { GameState, Ship, ShipCrew } from './state';

export const RETURN_HEX = 'returnHex';
export const RETURN_HEADING = 'returnHeading';

/** §7.8: sink a ship where she is, leaving a wreck there (§7.9). Mutates the resolution's working state. */
export function sinkShip(state: GameState, ship: Ship, reason: SinkReason, ctx: ResolutionContext<GameEvent>): void {
  ship.status = 'sunk';
  ship.anchored = false;
  ctx.emit({ type: 'ShipSank', rule: '7.8', ship: ship.id, reason });
  state.wrecks.push(hexKey(ship.pos));
  ctx.emit({ type: 'WreckPlaced', rule: '7.9', at: ship.pos });
}

function occupied(state: GameState, at: Hex): boolean {
  return Object.values(state.ships).some((s) => s.status === 'afloat' && hexEquals(s.pos, at));
}

/**
 * The prototype's crew deck (rules Q48: the full deck is still to be designed): Pirates, 1 card icon each.
 * A returning ship gets 3 at random; with only Pirates, "at random" makes no difference yet.
 */
export function recruitCrew(ship: Ship, count: number, tag: string): ShipCrew[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${ship.id}-pirate-${tag}-${i + 1}`,
    state: 'healthy' as const,
    cardIcons: 1,
    captain: false,
  }));
}

/**
 * §7.8, at Upkeep: every sunk ship comes back at her home port (or a free hex next to it, the player's choice, if it's occupied),
 * heading of her player's choice, sail down, fully repaired, with 3 random crew and no Captain. Her old hand is discarded;
 * she draws a new hand with everyone else at the end of Upkeep.
 */
export function returnSunkShips(state: GameState, ships: readonly Ship[], ctx: ResolutionContext<GameEvent>): void {
  for (const ship of ships) {
    if (ship.status !== 'sunk') continue;
    const team = state.players[ship.player]?.team as string;
    const port = state.teams[team]?.homePort as Hex;
    let at = port;
    if (occupied(state, port)) {
      const free = ([0, 1, 2, 3, 4, 5] as Direction[])
        .map((d) => neighbor(port, d))
        .filter((h) => {
          const hex = state.setup.map.hexes[hexKey(h)];
          return hex !== undefined && !isLand(hex.terrain, tide(state.weather)) && !occupied(state, h);
        });
      // ❓ If every hex round the port is full too, she waits for the next Upkeep.
      if (free.length === 0) continue;
      at = ctx.ask(createDecision(RETURN_HEX, ship.player, free));
    }
    const seat = state.setup.seats.find((s) => s.player === ship.player) as { heading: Direction };
    const headings: Direction[] = [0, 1, 2, 3, 4, 5];
    const heading = ctx.ask(createDecision(RETURN_HEADING, ship.player, headings, seat.heading));
    state.discards.push(...ship.hand);
    Object.assign(ship, {
      pos: at,
      heading,
      sail: 'none',
      status: 'afloat',
      blocked: [],
      hand: [],
      crew: recruitCrew(ship, 3, `t${state.turn}`),
      galeParts: 0,
    });
    ctx.emit({ type: 'ShipReturned', rule: '7.8', ship: ship.id, at, heading });
  }
}
