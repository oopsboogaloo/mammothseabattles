/**
 * The Action phase (rules §5.2 step 4, §7.1, §7.6, §8.2.4): in Action-slot initiative order, each ship carries out her Action card
 * (Fire Cannons, Repair or Heal), with damage applied at once; then every home port's guns fire.
 */

import { Rng, createDecision, type ResolutionContext } from '@msb/engine';
import { distance, hexKey, type Hex } from '@msb/hex';
import { cannonTargets, type FireContext } from './cannon';
import type { RulesConfig } from './config';
import type { GameEvent } from './events';
import { initiativeOrder } from './initiative';
import { cardInSlot } from './movement';
import type { Part } from './sailing';
import type { GameState, Ship } from './state';
import { takeDamage } from './take-damage';

export const HOLD_FIRE = 'holdFire';
export const REPAIR_SLOT = 'repairSlot';
export const HEAL_CREW = 'healCrew';

/** Fog hexes, and whirlpool hexes that cannon fire can't pass through (§7.1). */
export function fireContext(state: GameState): FireContext {
  const fog = new Set<string>();
  const portals = new Set<string>();
  for (const [key, hex] of Object.entries(state.setup.map.hexes)) {
    if (hex.fog) fog.add(key);
    if (hex.whirlpool !== undefined) portals.add(key);
  }
  return { fog, portals };
}

function sameTeam(state: GameState, a: Ship, b: Ship): boolean {
  return state.players[a.player]?.team === state.players[b.player]?.team;
}

function afloatShips(state: GameState, order: readonly Ship[]): Ship[] {
  return order.filter((s) => s.status === 'afloat');
}

/** §5.3: ships in Action-slot initiative order (empty or unusable slot = 0; ties rolled off). */
export function actionOrder(state: GameState, ships: readonly Ship[], part: Part, config: RulesConfig): Ship[] {
  const entries = afloatShips(state, ships).map((s) => ({ id: s.id, initiative: cardInSlot(state, s, `action${part}`)?.initiative ?? null }));
  const rng = new Rng(state.rng);
  const ids = initiativeOrder(entries, rng, config);
  state.rng = rng.state;
  return ids.map((id) => state.ships[id] as Ship);
}

/** §7.1: fire both broadsides. Every enemy in the arcs is hit (1 DD each) unless the firer holds fire on her. */
function fire(state: GameState, ship: Ship, part: Part, config: RulesConfig, ctx: ResolutionContext<GameEvent>): void {
  const others = Object.values(state.ships).filter((s) => s.status === 'afloat' && s.id !== ship.id);
  const ids = cannonTargets(
    ship.pos,
    ship.heading,
    others.map((s) => ({ id: s.id, position: s.pos, friendly: sameTeam(state, ship, s) })),
    fireContext(state),
    config,
  );
  const targets: string[] = [];
  const spared: string[] = [];
  for (const id of ids) {
    const choice = ctx.ask(createDecision(HOLD_FIRE, ship.player, [`fire:${id}`, `hold:${id}`]));
    (choice.startsWith('fire') ? targets : spared).push(id);
  }
  ctx.emit({ type: 'CannonFired', rule: '7.1', ship: ship.id, targets, spared });
  // Each target only takes her own damage, so none of them can sink before her turn to be hit.
  for (const id of targets) takeDamage(state, id, config.dd.cannonHit, 'cannon', part, config, ctx);
}

/** §7.6: remove one damage marker, from any slot (the player chooses). */
function repair(ship: Ship, ctx: ResolutionContext<GameEvent>): void {
  if (ship.blocked.length === 0) return;
  const slot = ctx.ask(createDecision(REPAIR_SLOT, ship.player, [...ship.blocked]));
  ship.blocked = ship.blocked.filter((s) => s !== slot);
  ctx.emit({ type: 'SlotRepaired', rule: '7.6', ship: ship.id, slot });
}

/** §7.6: flip one wounded crew member back to healthy (the player chooses; Captain first by default). */
function heal(ship: Ship, ctx: ResolutionContext<GameEvent>): void {
  const wounded = ship.crew.filter((c) => c.state === 'wounded');
  if (wounded.length === 0) return;
  const captainFirst = [...wounded].sort((a, b) => Number(b.captain) - Number(a.captain)).map((c) => c.id);
  const id = ctx.ask(createDecision(HEAL_CREW, ship.player, captainFirst));
  ship.crew = ship.crew.map((c) => (c.id === id ? { ...c, state: 'healthy' } : c));
  ctx.emit({ type: 'CrewHealed', rule: '7.6', ship: ship.id, crew: id });
}

/** §8.2.4: each home port fires 1 DD at every rival ship within range 2, after all ships have fired. Fog hides a ship. */
function portGuns(state: GameState, part: Part, config: RulesConfig, ctx: ResolutionContext<GameEvent>, order: readonly Ship[]): void {
  const { fog } = fireContext(state);
  for (const team of Object.values(state.teams)) {
    const targets = afloatShips(state, order).filter(
      (s) => state.players[s.player]?.team !== team.id && distance(s.pos, team.homePort as Hex) <= config.homePortGunRange && !fog.has(hexKey(s.pos)),
    );
    if (targets.length === 0) continue;
    ctx.emit({ type: 'PortGunsFired', rule: '8.2.4', team: team.id, targets: targets.map((s) => s.id) });
    for (const ship of targets) takeDamage(state, ship.id, config.dd.homePortGuns, 'portGuns', part, config, ctx);
  }
}

/** §5.2 step 4. `ships` are all ships in seat order. */
export function runActions(state: GameState, ships: readonly Ship[], part: Part, config: RulesConfig, ctx: ResolutionContext<GameEvent>): void {
  for (const ship of actionOrder(state, ships, part, config)) {
    if (ship.status !== 'afloat' || ship.refitting) continue; // sunk earlier this phase, or refitting (§7.7): she doesn't act
    const card = cardInSlot(state, ship, `action${part}`);
    if (!card) continue;
    if (card.action === 'fire') fire(state, ship, part, config, ctx);
    else if (card.action === 'repair') repair(ship, ctx);
    else heal(ship, ctx);
  }
  portGuns(state, part, config, ctx, ships);
}
