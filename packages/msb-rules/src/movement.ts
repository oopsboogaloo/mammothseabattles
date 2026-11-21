/**
 * Movement (rules §3.2, §5.2 steps 1, 2 and 5, §6): one function moves a ship one hex, whatever moved her,
 * because terrain applies "however a ship gets there" (§3.2.0; engineering design §6).
 * Ships act one at a time in initiative order, so "higher first, then the others against the new situation" (§5.3).
 */

import { hex as makeHex, hexEquals, hexKey, neighbor, opposite, rotate, type Direction, type Hex } from '@msb/hex';
import type { ResolutionContext } from '@msb/engine';
import type { CommandCard, SteerOrder } from './cards';
import type { RulesConfig } from './config';
import type { GameEvent, MoveCause, StopReason } from './events';
import { sailDirection, sailMove, type Part, type SailLevel } from './sailing';
import type { GameState, MapCave, Ship } from './state';
import { takeDamage } from './take-damage';
import { isLand } from './map';
import { sinkShip } from './sinking';
import { arrive, offerKnockLoose } from './treasure';
import { currentWeather, tide } from './weather';

export type StepResult = 'moved' | 'stopped' | 'sunk';

/** Ship movement pushes; currents and drift don't (§6.5). */
const PUSHES: ReadonlySet<MoveCause> = new Set<MoveCause>(['sail', 'row', 'push']);

export function shipAt(state: GameState, at: Hex): Ship | undefined {
  return Object.values(state.ships).find((s) => s.status === 'afloat' && hexEquals(s.pos, at));
}

function sameTeam(state: GameState, a: Ship, b: Ship): boolean {
  return state.players[a.player]?.team === state.players[b.player]?.team;
}

function edgeMatches(edge: { hex: string; side: Direction }, from: Hex, dir: Direction): boolean {
  const to = neighbor(from, dir);
  return (edge.hex === hexKey(from) && edge.side === dir) || (edge.hex === hexKey(to) && edge.side === opposite(dir));
}

/** §3.2.0: a wall reef along the edge between `from` and its neighbour in `dir`. */
export function wallReefBetween(state: GameState, from: Hex, dir: Direction): boolean {
  return (state.setup.map.wallReefs ?? []).some((e) => edgeMatches(e, from, dir));
}

/** §3.2.2: the cave whose mouth a ship crosses when she moves from `from` in `dir` into the island. */
export function caveEntered(state: GameState, from: Hex, dir: Direction): MapCave | undefined {
  const to = hexKey(neighbor(from, dir));
  return (state.setup.map.caves ?? []).find((c) => c.hex === to && c.side === opposite(dir));
}

function partnerCave(state: GameState, cave: MapCave): MapCave {
  return (state.setup.map.caves as readonly MapCave[]).find((c) => c.letter === cave.letter && c !== cave) as MapCave;
}

function partnerWhirlpool(state: GameState, at: Hex): Hex | undefined {
  const number = state.setup.map.hexes[hexKey(at)]?.whirlpool;
  if (number === undefined) return undefined;
  // Whirlpools are validated in pairs at setup (map.ts), so the partner always exists.
  const key = Object.keys(state.setup.map.hexes).find((k) => k !== hexKey(at) && state.setup.map.hexes[k]?.whirlpool === number);
  return parseHexKey(key as string);
}

export function parseHexKey(key: string): Hex {
  const [q, r] = key.split(',').map(Number) as [number, number];
  return makeHex(q, r);
}

export interface MoveContext {
  readonly state: GameState;
  readonly config: RulesConfig;
  readonly part: Part;
  readonly ctx: ResolutionContext<GameEvent>;
}

function stop(m: MoveContext, ship: Ship, by: StopReason): StepResult {
  m.ctx.emit({ type: 'ShipStopped', rule: '3.2.0', ship: ship.id, at: ship.pos, by });
  return 'stopped';
}

function sink(m: MoveContext, ship: Ship, reason: 'edge' | 'deathReef', off?: Hex): StepResult {
  sinkShip(m.state, ship, reason, m.ctx, off);
  return 'sunk';
}

function damage(m: MoveContext, ship: Ship, dd: number, source: 'cliff' | 'wallReef' | 'ram'): void {
  takeDamage(m.state, ship.id, dd, source, m.part, m.config, m.ctx);
}

/**
 * Move a ship one hex in `dir` (engineering design §6, `stepShip`). Mutates the resolution's working state.
 * `rammer` is set when this step is the first ship hit by a sailing or rowing ship (§6.5: only she takes the 1 DD).
 */
export function stepShip(m: MoveContext, ship: Ship, dir: Direction, cause: MoveCause): StepResult {
  const { state, config } = m;
  if (ship.anchored) return stop(m, ship, 'anchored');
  if (ship.stuck) return stop(m, ship, 'stuck');
  const from = ship.pos;

  // 1. Edges: wall reef, then cave mouth.
  if (wallReefBetween(state, from, dir)) {
    damage(m, ship, config.dd.wallReef, 'wallReef');
    return ship.status === 'afloat' ? stop(m, ship, 'wallReef') : 'sunk';
  }
  const cave = caveEntered(state, from, dir);
  if (cave) return throughCave(m, ship, cave, cause);

  return enterHex(m, ship, neighbor(from, dir), dir, cause);
}

/**
 * Steps 2–5 of moving into hex `to`: the map edge, terrain, ships in the way, then hex effects.
 * `dir` is the direction of travel; it is undefined for a current that jumps to a non-adjacent hex (§6.6 example 8),
 * which never pushes anyway.
 */
export function enterHex(m: MoveContext, ship: Ship, to: Hex, dir: Direction | undefined, cause: MoveCause, cave?: string): StepResult {
  const { state, config } = m;
  const from = ship.pos;
  // 2. Off the map: she sinks in the hex she was leaving, or stops with the Safe edge rule (§3.1).
  const hex = state.setup.map.hexes[hexKey(to)];
  if (!hex) return config.safeEdge ? stop(m, ship, 'edge') : sink(m, ship, 'edge', to);

  // 3. Terrain at the current tide.
  if (hex.terrain === 'cliff') {
    damage(m, ship, config.dd.cliff, 'cliff');
    return ship.status === 'afloat' ? stop(m, ship, 'cliff') : 'sunk';
  }
  if (isLand(hex.terrain, tide(state.weather))) return stop(m, ship, 'beach');

  // 4. Another ship: ship movement pushes her (chains); currents and drift stay put (§6.5).
  const other = shipAt(state, to);
  // A stranded ship's hex is dry land (§6.7): it stops ships like a beach, and she can't be pushed or rammed.
  if (other?.stuck) return stop(m, ship, 'beach');
  if (other) {
    if (!PUSHES.has(cause)) return stop(m, ship, 'ship');
    const firstHit = cause !== 'push';
    const anchored = other.anchored;
    const pushed = other.anchored ? 'stopped' : stepShip(m, other, dir as Direction, 'push');
    if (firstHit && other.status === 'afloat' && !sameTeam(state, ship, other)) {
      m.ctx.emit({ type: 'ShipRammed', rule: '6.5', ship: other.id, by: ship.id });
      // §8.2.3: instead of the DD, she may knock a carrier's treasure loose.
      if (!offerKnockLoose(state, ship, other, m.ctx)) damage(m, other, config.dd.ram, 'ram');
    }
    // An anchored ship stops the mover even if the ram sinks her (§6.1).
    if (anchored) return stop(m, ship, 'anchored');
    if (pushed === 'stopped' && shipAt(state, to)) return stop(m, ship, 'ship');
  }

  // 5. Move in, then hex effects.
  ship.pos = to;
  m.ctx.emit({ type: 'ShipMoved', rule: '6', ship: ship.id, from, to, cause, ...(cave ? { cave } : {}) });
  if (hex.terrain === 'deathReef') return sink(m, ship, 'deathReef');
  arrive(state, ship, config, m.ctx);
  const partner = partnerWhirlpool(state, to);
  if (partner && !shipAt(state, partner)) {
    ship.pos = partner;
    m.ctx.emit({ type: 'Teleported', rule: '3.2.1', ship: ship.id, from: to, to: partner });
    arrive(state, ship, config, m.ctx);
  }
  return 'moved';
}

/**
 * §3.2.2 (Q69, v0.140): a cave joins the sea hex at its mouth to the sea hex in front of the partner cave. Moving through it is
 * ordinary movement into that hex, by whatever moved her: sailing and rowing push and ram, currents and drift are blocked by a ship
 * there, and a blocked ship stays where she was. She comes out facing out of the partner cave's mouth.
 */
function throughCave(m: MoveContext, ship: Ship, cave: MapCave, cause: MoveCause): StepResult {
  const exit = partnerCave(m.state, cave);
  const before = { pos: ship.pos, heading: ship.heading };
  const mouth = parseHexKey(exit.hex);
  // She stays in her own hex until she moves: a ship in the way, the map edge or land at the exit leaves her (or sinks her) there.
  ship.heading = exit.side;
  const result = enterHex(m, ship, neighbor(mouth, exit.side), exit.side, cause, cave.letter);
  if (result !== 'moved' || hexEquals(ship.pos, before.pos)) {
    if (ship.status === 'afloat') Object.assign(ship, before);
    return result === 'sunk' ? 'sunk' : 'stopped';
  }
  m.ctx.emit({ type: 'WentThroughCave', rule: '3.2.2', ship: ship.id, letter: cave.letter, to: ship.pos });
  if (before.heading !== ship.heading) {
    m.ctx.emit({ type: 'ShipTurned', rule: '5.2', ship: ship.id, from: before.heading, to: ship.heading, cause: 'cave' });
  }
  return 'moved';
}

/** The card in a slot, unless the slot has a damage marker (§7.3: it can't be used). */
export function cardInSlot(state: GameState, ship: Ship, slot: string): CommandCard | undefined {
  if (ship.blocked.includes(slot)) return undefined;
  const id = ship.program[slot];
  return state.setup.commandCards.find((c) => c.id === id);
}

/** §8.2.4: is she in her own team's home port hex? There, no weather of any kind affects her. */
export function inOwnPort(state: GameState, ship: Ship): boolean {
  const team = state.players[ship.player]?.team as string;
  return hexEquals(ship.pos, state.teams[team]?.homePort as Hex);
}

/**
 * §5.2 step 1: set sail (or row, or anchor) from the Sail card, then move.
 * Leaving port (§8.2.4 ❓): under sail she always gets 1 hex out, whatever the weather; the rest of her sail move is then worked
 * out normally, less the hex already used.
 */
export function moveShip(m: MoveContext, ship: Ship): void {
  const { state, config, part } = m;
  if (ship.stuck || ship.refitting) return;
  const card = cardInSlot(state, ship, `sail${part}`);
  const order = card?.sail;
  const sail: SailLevel = order === 'half' || order === 'full' ? order : 'none';
  ship.sail = sail;
  ship.anchored = order === 'anchor';
  m.ctx.emit({ type: 'SailSet', rule: '6.1', ship: ship.id, sail, order: order ?? 'none' });
  if (order === 'rowAhead' || order === 'rowBack') {
    stepShip(m, ship, order === 'rowAhead' ? ship.heading : opposite(ship.heading), 'row');
    return;
  }
  if (sail === 'none') return;
  let used = 0;
  if (inOwnPort(state, ship)) {
    if (stepShip(m, ship, ship.heading, 'sail') !== 'moved') return;
    used = 1;
  }
  const weather = currentWeatherOf(state);
  const n = sailMove(sail, ship.heading, weather, config);
  if (sail === 'full' && weather.strength === 'gale') ship.galeParts += 1;
  for (let i = used; i < Math.abs(n); i++) {
    if (stepShip(m, ship, sailDirection(ship.heading, n), 'sail') !== 'moved') return;
  }
}

/** Steer orders as turns in hex sides (+ = starboard = clockwise). */
export const STEER_TURNS: Readonly<Record<SteerOrder, number>> = {
  easePort: -1,
  easeStbd: 1,
  hardPort: -2,
  hardStbd: 2,
  hardAbout: 3,
};

/** §5.2 step 2: turn by the Steer card. Anchored ships still turn (§6.1). */
export function steerShip(m: MoveContext, ship: Ship): void {
  if (ship.stuck || ship.refitting) return;
  const card = cardInSlot(m.state, ship, `steer${m.part}`);
  if (!card) return;
  const from = ship.heading;
  ship.heading = rotate(from, STEER_TURNS[card.steer]);
  m.ctx.emit({ type: 'ShipTurned', rule: '5.2', ship: ship.id, from, to: ship.heading, cause: 'steer' });
}

/** §5.2 step 5: drift 1 hex downwind, heading unchanged; no pushing. Anchored ships don't drift (§6.1). */
export function driftShip(m: MoveContext, ship: Ship): void {
  if (ship.anchored || ship.stuck || inOwnPort(m.state, ship)) return; // §8.2.4: no weather in her own port
  stepShip(m, ship, currentWeatherOf(m.state).direction, 'drift');
}

export function currentWeatherOf(state: GameState) {
  return currentWeather(state.weather, state.setup.weatherCards);
}
