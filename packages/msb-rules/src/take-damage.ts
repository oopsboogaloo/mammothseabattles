/**
 * Taking damage during resolution (rules §7.2–7.4, §7.8): roll the damage dice, then the damaged ship's player
 * places each point of Ship damage on a slot and each point of Crew damage on a crew member. Damage is applied
 * point by point; the moment a whole row is blocked or no crew are healthy, the ship sinks and the rest is lost.
 */

import { Rng, createDecision, type ResolutionContext } from '@msb/engine';
import type { RulesConfig } from './config';
import { rollDamage } from './damage';
import type { DamageSource, GameEvent } from './events';
import type { Part } from './sailing';
import {
  allSlots,
  applyCrewDamage,
  crewDamageOptions,
  noHealthyCrew,
  rowBlocked,
  slotKey,
  type CrewDamageChoice,
  type Slot,
} from './shipboard';
import type { GameState, Ship, ShipCrew } from './state';

export const PLACE_SHIP_DAMAGE = 'placeShipDamage';
export const PLACE_CREW_DAMAGE = 'placeCrewDamage';

/**
 * Default for Ship damage when the player doesn't answer (engineering design §5): the least useful slot.
 * Never complete a row if that can be avoided, and prefer Parts already resolved this turn.
 */
export function defaultSlotIndex(options: readonly Slot[], blocked: readonly string[], part: Part): number {
  const score = (slot: Slot): number => {
    const after = new Set([...blocked, slotKey(slot)]);
    return (rowBlocked(after) ? 100 : 0) + (slot.part >= part ? 10 : 0);
  };
  let best = 0;
  options.forEach((slot, i) => {
    if (score(slot) < score(options[best] as Slot)) best = i;
  });
  return best;
}

/** Default for Crew damage: wound before kill, Captain last. */
export function defaultCrewIndex(options: readonly CrewDamageChoice[], crew: readonly ShipCrew[]): number {
  const score = (choice: CrewDamageChoice): number => {
    const id = 'wound' in choice ? choice.wound : choice.kill;
    const captain = crew.find((c) => c.id === id)?.captain === true;
    return ('kill' in choice ? 10 : 0) + (captain ? 5 : 0);
  };
  let best = 0;
  options.forEach((choice, i) => {
    if (score(choice) < score(options[best] as CrewDamageChoice)) best = i;
  });
  return best;
}

function sink(ship: Ship, reason: 'row' | 'crew', ctx: ResolutionContext<GameEvent>): void {
  ship.status = 'sunk';
  ctx.emit({ type: 'ShipSank', rule: '7.8', ship: ship.id, reason });
}

/** Deal `dd` damage dice to a ship. Mutates the resolution's private copy of the state. */
export function takeDamage(
  state: GameState,
  shipId: string,
  dd: number,
  source: DamageSource,
  part: Part,
  config: RulesConfig,
  ctx: ResolutionContext<GameEvent>,
): void {
  const ship = state.ships[shipId] as Ship;
  const rng = new Rng(state.rng);
  const result = rollDamage(rng, dd, config);
  state.rng = rng.state;
  ctx.emit({
    type: 'DamageRolled',
    rule: '7.2',
    ship: ship.id,
    source,
    dd,
    rolls: result.rolls,
    shipDamage: result.ship,
    crewDamage: result.crew,
  });

  for (let i = 0; i < result.ship; i++) {
    const options = allSlots().filter((s) => !ship.blocked.includes(slotKey(s)));
    const slot = ctx.ask(
      createDecision(PLACE_SHIP_DAMAGE, ship.player, options, defaultSlotIndex(options, ship.blocked, part)),
    );
    ship.blocked.push(slotKey(slot));
    ctx.emit({ type: 'SlotBlocked', rule: '7.3', ship: ship.id, slot: slotKey(slot) });
    if (rowBlocked(new Set(ship.blocked))) {
      sink(ship, 'row', ctx);
      return;
    }
  }

  for (let i = 0; i < result.crew; i++) {
    const options = crewDamageOptions(ship.crew);
    const choice = ctx.ask(
      createDecision(PLACE_CREW_DAMAGE, ship.player, options, defaultCrewIndex(options, ship.crew)),
    );
    const flags = new Map(ship.crew.map((c) => [c.id, c.captain]));
    ship.crew = applyCrewDamage(ship.crew, choice).map((c) => ({ ...c, captain: flags.get(c.id) === true }));
    ctx.emit(
      'wound' in choice
        ? { type: 'CrewWounded', rule: '7.4', ship: ship.id, crew: choice.wound }
        : { type: 'CrewKilled', rule: '7.4', ship: ship.id, crew: choice.kill },
    );
    if (noHealthyCrew(ship.crew)) {
      sink(ship, 'crew', ctx);
      return;
    }
  }
}
