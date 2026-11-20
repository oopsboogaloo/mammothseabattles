/**
 * Treasure Hunt (rules §8.2): spawning with the treasure map deck, picking up, knocking loose, dropping on sinking, scoring, winning.
 */

import { Rng, createDecision, type ResolutionContext } from '@msb/engine';
import { hexEquals, hexKey, neighbor, type Direction, type Hex } from '@msb/hex';
import type { RulesConfig } from './config';
import type { GameEvent } from './events';
import { isLand } from './map';
import { TREASURE_KINDS, type GameState, type Ship, type TreasureKind } from './state';
import { tide } from './weather';

export const KNOCK_LOOSE = 'knockLoose';

/** §8.2.1: treasures in play at once = half the number of ships, rounded down (= (ships − 1) ÷ 2 rounded up). */
export function treasuresInPlay(ships: number): number {
  // §8.8: the Solo Challenge has 1.
  return Math.max(1, Math.floor(ships / 2));
}

/** §8.8 Solo Challenge: one player against the board. */
export function isSolo(state: GameState): boolean {
  return state.setup.seats.length === 1;
}

/** §8.8: the Solo Challenge score, the treasure brought home (the one team's score). */
export function soloScore(state: GameState): number {
  return Object.values(state.teams).reduce((n, t) => n + t.score, 0);
}

/** §8.2.5: the target is 3, or 2 with 7–8 ships. */
export function treasureTarget(ships: number, config: RulesConfig): number {
  return ships >= 7 ? config.treasureTargetLarge : config.treasureTarget;
}

function shipAtHex(state: GameState, key: string): Ship | undefined {
  return Object.values(state.ships).find((s) => s.status === 'afloat' && hexKey(s.pos) === key);
}

function landNow(state: GameState, key: string): boolean {
  const hex = state.setup.map.hexes[key];
  return hex !== undefined && isLand(hex.terrain, tide(state.weather));
}

type Emit = (event: GameEvent) => void;

/** The piece on a treasure hex (rules §3.7). Every loose treasure has one; gold stands in for any missing from an older save. */
function kindAt(state: GameState, key: string): TreasureKind {
  return (state.treasureKinds as Partial<Record<string, TreasureKind>>)[key] ?? 'gold';
}

/** Put a piece on the map. */
function layTreasure(state: GameState, key: string, kind: TreasureKind): void {
  state.treasures.push(key);
  state.treasureKinds = { ...state.treasureKinds, [key]: kind };
}

/** Take the piece off the map and give it to the ship. */
function takeTreasure(state: GameState, ship: Ship, key: string, emit: Emit): void {
  const kind = kindAt(state, key);
  state.treasures.splice(state.treasures.indexOf(key), 1);
  const { [key]: _, ...rest } = state.treasureKinds;
  state.treasureKinds = rest;
  ship.carrying = true;
  ship.cargo = kind;
  emit({ type: 'TreasurePickedUp', rule: '8.2.2', ship: ship.id, at: key, kind });
}

/** Take the piece out of the ship's hold. */
function unload(ship: Ship): TreasureKind {
  const kind = ship.cargo ?? 'gold';
  ship.carrying = false;
  delete ship.cargo;
  return kind;
}

/**
 * §8.2.1: turn over treasure map cards until one names a spawn point without treasure; reshuffle the deck when it runs out.
 * If every spawn point already has treasure, the spawn is skipped. A ship on a sea spawn point claims it at once.
 */
export function spawnTreasure(state: GameState, emit: Emit): void {
  const points = state.setup.map.spawnPoints ?? {};
  const numbers = Object.keys(points);
  if (numbers.every((n) => state.treasures.includes(points[n] as string))) return;
  const rng = new Rng(state.rng);
  for (;;) {
    if (state.treasureDeck.length === 0) state.treasureDeck = rng.shuffle(numbers);
    const n = state.treasureDeck.shift() as string;
    const key = points[n] as string;
    if (state.treasures.includes(key)) continue;
    // §3.7: the pieces come out in turn (gold, diamond, rum, ruby, pearl, …); all are worth the same.
    const kind = TREASURE_KINDS[state.treasureSpawns % TREASURE_KINDS.length] as TreasureKind;
    state.treasureSpawns += 1;
    layTreasure(state, key, kind);
    emit({ type: 'TreasureSpawned', rule: '8.2.1', point: n, at: key, kind });
    const ship = shipAtHex(state, key);
    if (ship && !ship.carrying && !landNow(state, key)) takeTreasure(state, ship, key, emit);
    break;
  }
  state.rng = rng.state;
}

/** The team's score, and the win (§8.2.5). */
function score(state: GameState, ship: Ship, config: RulesConfig, ctx: ResolutionContext<GameEvent>): void {
  const team = state.teams[state.players[ship.player]?.team as string] as GameState['teams'][string];
  const kind = unload(ship);
  team.score += 1;
  team.hold = [...team.hold, kind];
  state.pendingSpawns += 1;
  ctx.emit({ type: 'TreasureScored', rule: '8.2.4', ship: ship.id, team: team.id, score: team.score, kind });
  // §8.8: the Solo Challenge has no target; the score counts at the end.
  if (!isSolo(state) && state.winner === undefined && team.score >= treasureTarget(Object.keys(state.ships).length, config)) {
    state.winner = team.id;
    ctx.emit({ type: 'GameWon', rule: '8.2.5', team: team.id });
  }
}

/**
 * After a ship moves into a hex (however she got there): a carrier entering her own home port scores (§8.2.4); otherwise she picks up
 * treasure lying in a sea hex she passes through, if she isn't carrying one already (§8.2.2: a ship carries only 1).
 */
export function arrive(state: GameState, ship: Ship, config: RulesConfig, ctx: ResolutionContext<GameEvent>): void {
  const team = state.players[ship.player]?.team as string;
  if (ship.carrying && hexEquals(ship.pos, state.teams[team]?.homePort as Hex)) {
    score(state, ship, config, ctx);
    return;
  }
  const key = hexKey(ship.pos);
  if (!ship.carrying && state.treasures.includes(key) && !landNow(state, key)) takeTreasure(state, ship, key, ctx.emit);
}

/** §8.2.2: at the end of the turn, a ship next to treasure on land goes ashore and digs it up. */
export function digUpTreasure(state: GameState, ships: readonly Ship[], ctx: ResolutionContext<GameEvent>): void {
  for (const ship of ships) {
    if (ship.status !== 'afloat' || ship.carrying) continue;
    for (const d of [0, 1, 2, 3, 4, 5] as Direction[]) {
      const key = hexKey(neighbor(ship.pos, d));
      if (state.treasures.includes(key) && landNow(state, key)) {
        takeTreasure(state, ship, key, ctx.emit);
        break;
      }
    }
  }
}

/**
 * §8.2.3: when a ship carrying treasure is rammed or hit by cannon, the attacker may give up that DD and knock the treasure loose
 * instead, into a hex next to the victim (sea or land, may hold a ship) that has no treasure. Returns true if she knocked it loose.
 */
export function offerKnockLoose(state: GameState, attacker: Ship, victim: Ship, ctx: ResolutionContext<GameEvent>): boolean {
  if (!victim.carrying) return false;
  const hexes = ([0, 1, 2, 3, 4, 5] as Direction[])
    .map((d) => neighbor(victim.pos, d))
    .filter((h) => state.setup.map.hexes[hexKey(h)] !== undefined && !state.treasures.includes(hexKey(h)));
  if (hexes.length === 0) return false;
  const choice = ctx.ask(createDecision<Hex | 'damage'>(KNOCK_LOOSE, attacker.player, ['damage', ...hexes]));
  if (choice === 'damage') return false;
  const kind = unload(victim);
  layTreasure(state, hexKey(choice), kind);
  ctx.emit({ type: 'TreasureKnockedLoose', rule: '8.2.3', ship: victim.id, by: attacker.id, to: choice, kind });
  return true;
}

/** §7.8: a sinking carrier drops her treasure in the hex where she sank. */
export function dropTreasure(state: GameState, ship: Ship, ctx: ResolutionContext<GameEvent>): void {
  if (!ship.carrying) return;
  const kind = unload(ship);
  layTreasure(state, hexKey(ship.pos), kind);
  ctx.emit({ type: 'TreasureDropped', rule: '7.8', ship: ship.id, at: ship.pos, kind });
}
