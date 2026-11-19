/**
 * Upkeep steps 3 and 4 (rules §5.4): refit in port (§7.7) and searching shipwrecks (§7.9).
 */

import { createDecision, type ResolutionContext } from '@msb/engine';
import { hexKey, neighbor, type Direction } from '@msb/hex';
import type { RulesConfig } from './config';
import type { GameEvent } from './events';
import { isLand } from './map';
import { inOwnPort } from './movement';
import { recruitCrew } from './sinking';
import type { GameState, Ship, Terrain } from './state';
import { tide } from './weather';

export const REFIT = 'refit';
export const CREW_SWAP = 'crewSwap';

export interface RefitChoice {
  readonly repair: boolean;
  readonly heal: boolean;
  /** Crew recruited, 0–3, never above the crew cap (§3.6). */
  readonly recruit: number;
}

/** Every legal refit for this ship (§7.7: any part of a refit, or none). The full refit is first; no refit is last. */
export function refitOptions(ship: Ship, config: RulesConfig): RefitChoice[] {
  const repairs = ship.blocked.length > 0 ? [true, false] : [false];
  const heals = ship.crew.some((c) => c.state === 'wounded') ? [true, false] : [false];
  const most = Math.max(0, Math.min(config.refitCrew, config.crewCap - ship.crew.length));
  const recruits = Array.from({ length: most + 1 }, (_, i) => most - i);
  return repairs.flatMap((repair) => heals.flatMap((heal) => recruits.map((recruit) => ({ repair, heal, recruit }))));
}

/**
 * §7.7: a ship that ended the turn in her home port may refit: fully repair, fully heal, recruit up to 3. She may do only part of
 * it, but any refit costs the next turn (she can't do anything; she still draws cards). Default (D5): the full refit if she is
 * damaged or has wounded crew, otherwise no refit. A ship that spent this turn refitting is free again first. A ship that came back
 * from sinking this Upkeep didn't end the turn in port, so she can't refit yet.
 */
export function refit(
  state: GameState,
  ships: readonly Ship[],
  config: RulesConfig,
  ctx: ResolutionContext<GameEvent>,
  returned: ReadonlySet<string> = new Set(),
): void {
  for (const ship of ships) ship.refitting = false;
  for (const ship of ships) {
    if (ship.status !== 'afloat' || ship.stuck || returned.has(ship.id) || !inOwnPort(state, ship)) continue;
    const options = refitOptions(ship, config);
    const damaged = ship.blocked.length > 0 || ship.crew.some((c) => c.state === 'wounded');
    const choice = ctx.ask(createDecision(REFIT, ship.player, options, damaged ? 0 : options.length - 1));
    if (!choice.repair && !choice.heal && choice.recruit === 0) continue;
    if (choice.repair) ship.blocked = [];
    if (choice.heal) ship.crew = ship.crew.map((c) => ({ ...c, state: 'healthy' }));
    ship.crew = [...ship.crew, ...recruitCrew(ship, choice.recruit, `refit${state.turn}`)];
    ship.refitting = true;
    ctx.emit({ type: 'ShipRefitted', rule: '7.7', ship: ship.id, ...choice });
  }
}

/** The wrecks a ship searches: one in her hex, or one next to her on a hex that is land at this tide (§7.9). */
export function wrecksFor(state: GameState, ship: Ship): string[] {
  const now = tide(state.weather);
  return state.wrecks.filter((key) => {
    if (key === hexKey(ship.pos)) return true;
    const terrain = state.setup.map.hexes[key]?.terrain as Terrain | undefined;
    const adjacent = ([0, 1, 2, 3, 4, 5] as Direction[]).some((d) => hexKey(neighbor(ship.pos, d)) === key);
    return adjacent && terrain !== undefined && isLand(terrain, now);
  });
}

/**
 * §7.9: each ship that ends the turn on a wreck (or next to one on land) searches it: the wreck is removed and she gains a crew card
 * (core game). With a full crew (cap 6) her player may swap the newcomer for one of her crew, or turn the newcomer away.
 */
export function searchWrecks(state: GameState, ships: readonly Ship[], config: RulesConfig, ctx: ResolutionContext<GameEvent>): void {
  for (const ship of ships) {
    if (ship.status !== 'afloat') continue;
    for (const key of wrecksFor(state, ship)) {
      state.wrecks = state.wrecks.filter((w) => w !== key);
      const [recruit] = recruitCrew(ship, 1, `wreck${state.turn}-${key}`) as [Ship['crew'][number]];
      ctx.emit({ type: 'WreckSearched', rule: '7.9', ship: ship.id, at: key });
      if (ship.crew.length < config.crewCap) {
        ship.crew = [...ship.crew, recruit];
        ctx.emit({ type: 'CrewGained', rule: '7.9', ship: ship.id, crew: recruit.id });
        continue;
      }
      const swap = ctx.ask(createDecision(CREW_SWAP, ship.player, ['keep', ...ship.crew.map((c) => c.id)]));
      if (swap === 'keep') continue;
      ship.crew = ship.crew.map((c) => (c.id === swap ? recruit : c));
      ctx.emit({ type: 'CrewGained', rule: '7.9', ship: ship.id, crew: recruit.id, replaced: swap });
    }
  }
}
