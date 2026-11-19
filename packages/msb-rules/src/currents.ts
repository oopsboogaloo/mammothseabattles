/**
 * Currents (rules §5.2 step 3, §6.6). Three 1-hex sub-steps: triple currents act in all three, double in the last two,
 * single in the last one, so a ship can be carried from one current onto another between sub-steps.
 * In each sub-step ships act in Sail initiative order; each ship is moved at most once per sub-step.
 *
 * - A ship is affected when an arrow starts in her hex.
 * - Currents don't push: if the hex she'd be carried to is occupied, she stays put, and isn't turned ❓.
 * - Anchored ships aren't moved or turned by any current (§6.1).
 * - A rotor moves all its ships together, so ships on it can swap places (engineering design §6).
 */

import { hexEquals, hexKey, neighbor, rotate, type Direction, type Hex } from '@msb/hex';
import { enterHex, parseHexKey, shipAt, type MoveContext } from './movement';
import type { CurrentStrength, Rotor, Ship } from './state';

/** Sub-step 1: triple only; 2: double and triple; 3: all. */
export function activeIn(strength: CurrentStrength, subStep: 1 | 2 | 3): boolean {
  return strength >= 4 - subStep;
}

function turnShip(m: MoveContext, ship: Ship, turn: number): void {
  if (turn === 0) return;
  const from = ship.heading;
  ship.heading = rotate(from, turn);
  m.ctx.emit({ type: 'ShipTurned', rule: '5.2', ship: ship.id, from, to: ship.heading, cause: 'current' });
}

/** The direction from `from` to an adjacent `to`, or undefined if they aren't neighbours (a jump). */
export function directionTo(from: Hex, to: Hex): Direction | undefined {
  return ([0, 1, 2, 3, 4, 5] as Direction[]).find((d) => hexEquals(neighbor(from, d), to));
}

function rotorOf(m: MoveContext, at: Hex): Rotor | undefined {
  return (m.state.setup.map.rotors ?? []).find((r) => r.moves[hexKey(at)] !== undefined);
}

/**
 * Move every ship on a rotor at once. A ship whose destination holds a ship that isn't moving with her (anchored, or itself
 * blocked) stays put; the others move and turn.
 */
function turnRotor(m: MoveContext, rotor: Rotor, ships: readonly Ship[], moved: Set<string>): void {
  let movers = ships.filter((s) => !s.anchored && !s.stuck);
  for (let changed = true; changed; ) {
    changed = false;
    for (const ship of movers) {
      const dest = parseHexKey(rotor.moves[hexKey(ship.pos)] as string);
      const there = shipAt(m.state, dest);
      if (there && !movers.includes(there)) {
        m.ctx.emit({ type: 'ShipStopped', rule: '3.2.0', ship: ship.id, at: ship.pos, by: 'ship' });
        movers = movers.filter((s) => s !== ship);
        changed = true;
        break;
      }
    }
  }
  const targets = movers.map((s) => parseHexKey(rotor.moves[hexKey(s.pos)] as string));
  movers.forEach((ship, i) => {
    const from = ship.pos;
    ship.pos = targets[i] as Hex;
    moved.add(ship.id);
    m.ctx.emit({ type: 'ShipMoved', rule: '6', ship: ship.id, from, to: ship.pos, cause: 'current' });
    turnShip(m, ship, rotor.turn);
  });
}

/** §5.2 step 3 for one Part. `order` is the Sail initiative order. */
export function runCurrents(m: MoveContext, order: readonly Ship[]): void {
  for (const subStep of [1, 2, 3] as const) {
    const moved = new Set<string>();
    const rotorsDone = new Set<Rotor>();
    for (const ship of order) {
      if (ship.status !== 'afloat' || ship.anchored || ship.stuck || moved.has(ship.id)) continue;
      const rotor = rotorOf(m, ship.pos);
      if (rotor) {
        if (!activeIn(rotor.strength, subStep) || rotorsDone.has(rotor)) continue;
        rotorsDone.add(rotor);
        const on = order.filter((s) => s.status === 'afloat' && !moved.has(s.id) && rotor.moves[hexKey(s.pos)] !== undefined);
        turnRotor(m, rotor, on, moved);
        continue;
      }
      const current = m.state.setup.map.hexes[hexKey(ship.pos)]?.current;
      if (!current || !activeIn(current.strength, subStep)) continue;
      moved.add(ship.id);
      if (current.kind === 'eddy') {
        turnShip(m, ship, current.turn);
        continue;
      }
      const to = parseHexKey(current.to);
      if (enterHex(m, ship, to, directionTo(ship.pos, to), 'current') === 'moved') turnShip(m, ship, current.turn);
    }
  }
}
