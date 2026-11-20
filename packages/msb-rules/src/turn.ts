/**
 * Resolving a turn (rules §5.2): Parts I–III, then Upkeep (§5.4).
 *
 * Built up one rules step at a time (implementation plan). Implemented so far:
 * - §5.1 reveal each Part's cards as it starts (D6); used cards to the bottom of the deck; draw at Upkeep.
 * - §5.2 step 1 Move (sail, row, anchor; pushing and ramming; terrain at the tide; whirlpools; caves; map edge),
 *   step 2 Steer, step 5 wind drift, step 6 end of Part: rough water 2 DD, storm 3 DD (§3.2.0).
 * - Damage placement (§7.2–7.4); Gale damage at Upkeep (§3.5).
 * - §5.2 step 3 currents (§6.6); step 4 actions: cannons, repair, heal, then port guns (§7, §8.2.4).
 * - Sinking leaves a wreck; sunk ships come back at Upkeep (§7.8). The rest of Upkeep comes in P6.
 */

import { hexKey } from '@msb/hex';
import { Rng, type ResolutionContext } from '@msb/engine';
import type { RulesConfig } from './config';
import type { DamageSource, GameEvent } from './events';
import { runActions } from './actions';
import { runCurrents } from './currents';
import { returnSunkShips } from './sinking';
import { digUpTreasure, isSolo, soloScore, spawnTreasure } from './treasure';
import { refit, searchWrecks } from './upkeep';
import { initiativeOrder } from './initiative';
import { cardInSlot, currentWeatherOf, driftShip, inOwnPort, moveShip, steerShip, type MoveContext } from './movement';
import { isLand } from './map';
import { advanceWeather, tide } from './weather';
import { driftsInPart, type Part } from './sailing';
import { drawCards, returnUsedCards } from './programming';
import { PARTS, SLOT_ROWS } from './shipboard';
import type { GameState, Player, Ship, Terrain } from './state';
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

/** §5.2 steps 1–5: Move, Steer, Currents, Action, Wind drift. */
function moveSteerDrift(state: GameState, part: Part, config: RulesConfig, ctx: ResolutionContext<GameEvent>): void {
  const m: MoveContext = { state, config, part, ctx };
  // Anchor holds for the whole Part (§6.1), so it is set before any ship moves, not at the anchored ship's own initiative.
  for (const ship of Object.values(state.ships)) {
    ship.anchored = ship.status === 'afloat' && cardInSlot(state, ship, `sail${part}`)?.sail === 'anchor';
  }
  const order = sailOrder(state, part, config);
  // The game ends the moment a team scores its target (§8.2.5), so each step stops if there's a winner.
  for (const ship of afloat(order)) if (ship.status === 'afloat' && state.winner === undefined) moveShip(m, ship);
  for (const ship of afloat(order)) steerShip(m, ship);
  if (state.winner === undefined) runCurrents(m, order);
  if (state.winner === undefined) runActions(state, shipsInSeatOrder(state), part, config, ctx);
  if (state.winner === undefined && driftsInPart(currentWeatherOf(state).strength, part)) {
    for (const ship of order) if (ship.status === 'afloat' && state.winner === undefined) driftShip(m, ship);
  }
}

function endOfPart(state: GameState, part: Part, config: RulesConfig, ctx: ResolutionContext<GameEvent>): void {
  for (const ship of shipsInSeatOrder(state)) {
    if (ship.status !== 'afloat' || inOwnPort(state, ship)) continue; // §8.2.4: sheltered in her own port
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

/** §5.4 step 7 and §6.7: the board moves on one space; ships on hexes that are now land are stuck, and stuck ships on water are freed. */
export function advanceWeatherAndTide(state: GameState, ctx: ResolutionContext<GameEvent>): void {
  const before = tide(state.weather);
  const rng = new Rng(state.rng);
  const { fronts } = advanceWeather(state.weather, state.setup.weatherCards, rng);
  state.rng = rng.state;
  const { spaces, now } = state.weather;
  ctx.emit({ type: 'WeatherAdvanced', rule: '3.5', now: spaces[now] as string, next: spaces[(now + 1) % 6] as string, space: now, newFronts: fronts });
  const after = tide(state.weather);
  if (after !== before) ctx.emit({ type: 'TideChanged', rule: '6.4', tide: after });
  for (const ship of shipsInSeatOrder(state)) {
    if (ship.status !== 'afloat') continue;
    // An afloat ship is always on a map hex (leaving the map sinks her).
    const land = isLand((state.setup.map.hexes[hexKey(ship.pos)] as { terrain: Terrain }).terrain, after);
    if (land && !ship.stuck) ctx.emit({ type: 'ShipStranded', rule: '6.7', ship: ship.id });
    if (!land && ship.stuck) ctx.emit({ type: 'ShipFreed', rule: '6.7', ship: ship.id });
    ship.stuck = land;
  }
}

/** §5.4 Upkeep (so far): used cards to the deck bottom, then each afloat ship draws. */
function upkeep(state: GameState, config: RulesConfig, ctx: ResolutionContext<GameEvent>): void {
  // End of Part III: ships next to treasure on land dig it up (§8.2.2).
  digUpTreasure(state, shipsInSeatOrder(state), ctx);
  // §5.4 step 2: sunk ships come back.
  const returned = returnSunkShips(state, shipsInSeatOrder(state), ctx);
  // Steps 3 and 4: refit in port (§7.7), then search wrecks (§7.9).
  refit(state, shipsInSeatOrder(state), config, ctx, returned);
  searchWrecks(state, shipsInSeatOrder(state), config, ctx);
  // Step 5: a new treasure for each one scored this turn (§8.2.1).
  for (; state.pendingSpawns > 0; state.pendingSpawns--) spawnTreasure(state, ctx.emit);
  // Step 6: Gale damage, 1 DD for each Part sailed at Full Sail (§3.5).
  for (const ship of shipsInSeatOrder(state)) {
    const dd = ship.galeParts * config.dd.galePerFullSail;
    ship.galeParts = 0;
    ship.anchored = false;
    if (dd > 0 && ship.status === 'afloat') takeDamage(state, ship.id, dd, 'gale', 3, config, ctx);
  }
  // §5.4 step 7: advance the weather board (new wind, new tide), then check stranding (§6.7).
  advanceWeatherAndTide(state, ctx);
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
      if (state.winner !== undefined) {
        state.phase = 'over';
        return state;
      }
      endOfPart(state, part, config, ctx);
    }
    // §8.8: the Solo Challenge ends after its last turn's Part III; the score is the treasure brought home.
    if (isSolo(state) && state.turn >= config.soloTurns) {
      state.phase = 'over';
      ctx.emit({ type: 'SoloFinished', rule: '8.8', turns: state.turn, score: soloScore(state) });
      return state;
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
