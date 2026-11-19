/**
 * Programming (rules §5.1): draw cards, place them in the ship board's slots in secret, mark ready,
 * discard down to the hand limit; after the turn, used cards go to the bottom of the deck.
 */

import { Rng } from '@msb/engine';
import type { RulesConfig } from './config';
import { allSlots, cardsToDraw, slotKey } from './shipboard';
import type { GameState, PlayerId, Ship } from './state';

/** Slot keys in board order: sail1 … sail3, steer1 …, action1 … */
export const SLOT_KEYS: readonly string[] = allSlots().map(slotKey);

export type ProgramAction =
  | { readonly type: 'place'; readonly ship: string; readonly slot: string; readonly card: string }
  | { readonly type: 'remove'; readonly ship: string; readonly slot: string }
  | { readonly type: 'discard'; readonly ship: string; readonly card: string }
  | { readonly type: 'ready' };

/** Ships a player programs: her own, afloat (sunk ships wait for Upkeep, §7.8). */
export function programmableShips(state: GameState, player: PlayerId): Ship[] {
  return (state.players[player] as { ships: string[] }).ships.map((id) => state.ships[id] as Ship).filter((s) => s.status === 'afloat' && !s.refitting); // refitting ships can't do anything (§7.7)
}

/** Slots that can take a card: empty and without a damage marker (§7.3). */
export function freeSlots(ship: Ship): string[] {
  return SLOT_KEYS.filter((k) => ship.program[k] === undefined && !ship.blocked.includes(k));
}

/** §5.1: after programming, a hand above the limit must be discarded down to it before the player is ready. */
export function mustDiscard(ship: Ship, config: RulesConfig): boolean {
  return ship.hand.length > config.handLimit;
}

export function programmingActions(state: GameState, player: PlayerId, config: RulesConfig): ProgramAction[] {
  if (state.phase !== 'programming' || !state.players[player] || state.ready.includes(player)) return [];
  const actions: ProgramAction[] = [];
  let canReady = true;
  for (const ship of programmableShips(state, player)) {
    for (const slot of freeSlots(ship)) {
      for (const card of ship.hand) actions.push({ type: 'place', ship: ship.id, slot, card });
    }
    for (const slot of SLOT_KEYS) {
      if (ship.program[slot] !== undefined) actions.push({ type: 'remove', ship: ship.id, slot });
    }
    if (mustDiscard(ship, config)) {
      canReady = false;
      for (const card of ship.hand) actions.push({ type: 'discard', ship: ship.id, card });
    }
  }
  if (canReady) actions.push({ type: 'ready' });
  return actions;
}

/** Apply a legal place / remove / discard to a copy of the state. */
export function applyProgramming(state: GameState, action: Exclude<ProgramAction, { type: 'ready' }>): GameState {
  const ship = { ...(state.ships[action.ship] as Ship) };
  if (action.type === 'place') {
    ship.hand = ship.hand.filter((c) => c !== action.card);
    ship.program = { ...ship.program, [action.slot]: action.card };
  } else if (action.type === 'remove') {
    const { [action.slot]: card, ...rest } = ship.program;
    ship.program = rest;
    ship.hand = [...ship.hand, card as string];
  } else {
    ship.hand = ship.hand.filter((c) => c !== action.card);
    return { ...state, ships: { ...state.ships, [ship.id]: ship }, discards: [...state.discards, action.card] };
  }
  return { ...state, ships: { ...state.ships, [ship.id]: ship } };
}

/** §5.1: each afloat ship draws one card per command-card icon on her healthy crew, from the top of the deck. Mutates. */
export function drawCards(state: GameState, ship: Ship): number {
  const count = Math.min(cardsToDraw(ship.crew), state.deck.length);
  ship.hand.push(...state.deck.splice(0, count));
  return count;
}

/**
 * §5.1 step 4: used cards (programs, plus cards discarded down to the hand limit) are shuffled and put on the bottom of the deck.
 * Mutates.
 */
export function returnUsedCards(state: GameState): void {
  const used = [...state.discards];
  for (const ship of Object.values(state.ships)) {
    for (const slot of SLOT_KEYS) {
      const card = ship.program[slot];
      if (card !== undefined) used.push(card);
    }
    ship.program = {};
  }
  const rng = new Rng(state.rng);
  state.deck.push(...rng.shuffle(used));
  state.rng = rng.state;
  state.discards = [];
}
