/**
 * Resolving a turn (rules §5.2): Parts I–III, then Upkeep (§5.4).
 *
 * Built up one rules step at a time (implementation plan). Implemented so far:
 * - §5.1 reveal each Part's cards as it starts (D6); used cards to the bottom of the deck; draw at Upkeep.
 * - §5.2 step 1 Move (sail, row, anchor; pushing and ramming; terrain at the tide; whirlpools; caves; map edge),
 *   step 2 Steer, step 5 wind drift, step 6 end of Part: rough water 2 DD, storm 3 DD (§3.2.0).
 * - Damage placement (§7.2–7.4); Gale damage at Upkeep (§3.5).
 * - §5.2 step 3 currents (§6.6). Actions come in P5, the rest of Upkeep in P6.
 */

import { hexKey } from '@msb/hex';
import { Rng, type ResolutionContext } from '@msb/engine';
import type { RulesConfig } from './config';
import type { DamageSource, GameEvent } from './events';
import { runCurrents } from './currents';
import { initiativeOrder } from './initiative';
import { cardInSlot, currentWeatherOf, driftShip, moveShip, steerShip, type MoveContext } from './movement';
import { driftsInPart, type Part } from './sailing';
import { drawCards, returnUsedCards } from './programming';
import { PARTS, SLOT_ROWS } from './shipboard';
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

/** §5.3: ships in Sail-slot initiative order (empty or unusable slot = 0; ties rolled off). Afloat ships only. */
export function sailOrder(state: GameState, part: Part, config: RulesConfig): Ship[] {
  const entries = shipsInSeatOrder(state)
    .filter((s) => s.status === 'afloat')
    .map((s) => ({ id: s.id, initiative: cardInSlot(state, s, `sail${part}`)?.initiative ?? null }));
  const rng = new Rng(state.rng);
  const ids = initiativeOrder(entries, rng, config);
  state.rng = rng.state;
  return ids.map((id) => state.ships[id] as Ship);
}

function afloat(ships: readonly Ship[]): Ship[] {
  return ships.filter((s) => s.status === 'afloat');
}

/** §5.2 steps 1, 2, 3 and 5. Actions (step 4) come in P5. */
function moveSteerDrift(state: GameState, part: Part, config: RulesConfig, ctx: ResolutionContext<GameEvent>): void {
  const m: MoveContext = { state, config, part, ctx };
  // Anchor holds for the whole Part (§6.1), so it is set before any ship moves, not at the anchored ship's own initiative.
  for (const ship of Object.values(state.ships)) {
    ship.anchored = ship.status === 'afloat' && cardInSlot(state, ship, `sail${part}`)?.sail === 'anchor';
  }
  const order = sailOrder(state, part, config);
  for (const ship of afloat(order)) if (ship.status === 'afloat') moveShip(m, ship);
  for (const ship of afloat(order)) steerShip(m, ship);
  runCurrents(m, order);
  if (driftsInPart(currentWeatherOf(state).strength, part)) {
    for (const ship of order) if (ship.status === 'afloat') driftShip(m, ship);
  }
}

function endOfPart(state: GameState, part: Part, config: RulesConfig, ctx: ResolutionContext<GameEvent>): void {
  for (const ship of shipsInSeatOrder(state)) {
    if (ship.status !== 'afloat') continue;
    const hazard = endOfPartHazard(state, ship, config);
    if (hazard) takeDamage(state, ship.id, hazard.dd, hazard.source, part, config, ctx);
  }
}

/** §5.1 step 3 / D6: each ship's cards in this Part, row → card id. */
export function revealPart(state: GameState, part: Part): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  for (const ship of shipsInSeatOrder(state)) {
    const cards: Record<string, string> = {};
    for (const row of SLOT_ROWS) {
      const card = ship.program[`${row}${part}`];
      if (card !== undefined) cards[row] = card;
    }
    out[ship.id] = cards;
  }
  return out;
}

/** §5.4 Upkeep (so far): used cards to the deck bottom, then each afloat ship draws. */
function upkeep(state: GameState, config: RulesConfig, ctx: ResolutionContext<GameEvent>): void {
  // §3.5: Gale damage, 1 DD for each Part sailed at Full Sail. (Its place in the full Upkeep order comes with P6.)
  for (const ship of shipsInSeatOrder(state)) {
    const dd = ship.galeParts * config.dd.galePerFullSail;
    ship.galeParts = 0;
    ship.anchored = false;
    if (dd > 0 && ship.status === 'afloat') takeDamage(state, ship.id, dd, 'gale', 3, config, ctx);
  }
  const before = state.deck.length;
  returnUsedCards(state);
  ctx.emit({ type: 'CardsReturned', rule: '5.1', count: state.deck.length - before });
  for (const ship of shipsInSeatOrder(state)) {
    if (ship.status !== 'afloat') continue;
    ctx.emit({ type: 'CardsDrawn', rule: '5.1', ship: ship.id, count: drawCards(state, ship) });
  }
}

/** The resolution script for one turn. Runs on a private copy of the state (engineering design §5). */
export function resolveTurn(config: RulesConfig) {
  return (state: GameState, ctx: ResolutionContext<GameEvent>): GameState => {
    for (const part of PARTS) {
      state.part = part;
      ctx.emit({ type: 'PartStarted', rule: '5.2', part, revealed: revealPart(state, part) });
      moveSteerDrift(state, part, config, ctx);
      endOfPart(state, part, config, ctx);
    }
    ctx.emit({ type: 'UpkeepStarted', rule: '5.4', turn: state.turn });
    upkeep(state, config, ctx);
    state.turn += 1;
    state.part = 0;
    state.phase = 'programming';
    state.ready = [];
    ctx.emit({ type: 'TurnStarted', rule: '5', turn: state.turn });
    return state;
  };
}
