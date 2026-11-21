/**
 * The game log for investigating odd moments (engineering design §11): a full text trace of a game, rebuilt from its setup and
 * action log, with every action, the cards behind it, every event, the ship and board state after each turn step, and checks
 * that flag anything inconsistent:
 * - **Event tracking**: the ships' positions, headings and afloat/sunk status are followed event by event; the result must match
 *   the state the engine reached (a move from the wrong hex, a jump of more than one hex, a ship somewhere no event put her).
 * - **Invariants** after every action: every afloat ship on a map hex and no two in one hex; every command card in exactly one
 *   place (deck, hands, programs, discards); loose treasure on the map, once each; a carrier has her piece; score = pieces home.
 * Pure: the client adds what only it can see (where the board drew the ships) as notes.
 */

import { distance, hexEquals, hexKey, type Direction, type Hex } from '@msb/hex';
import type { LogEntry } from '@msb/engine';
import type { RulesConfig } from './config';
import type { GameEvent } from './events';
import { createGame, type Action } from './game';
import type { GameSetup, GameState, Ship } from './state';

/** Where a ship is, as the events have told it. */
export interface Tracked {
  pos: Hex;
  heading: Direction;
  afloat: boolean;
}

const at = (h: Hex) => `${h.q},${h.r}`;

/** Each ship's position, heading and afloat status in a state. */
export function trackedFrom(state: GameState): Record<string, Tracked> {
  return Object.fromEntries(Object.values(state.ships).map((s) => [s.id, { pos: s.pos, heading: s.heading, afloat: s.status === 'afloat' }]));
}

/**
 * Follow the ships through a batch of events, updating `t` (where the events have put each ship). Returns the problems found
 * (none when all is well). While a turn waits on a decision the state still shows the ships where the turn started (the engine
 * re-runs the turn from its start after each answer, engineering design D1), so `t` carries on across the whole turn.
 */
export function followEvents(t: Record<string, Tracked>, events: readonly GameEvent[]): string[] {
  const problems: string[] = [];
  const ship = (id: string) => t[id] as Tracked;
  for (const e of events) {
    switch (e.type) {
      case 'ShipMoved':
        if (!hexEquals(e.from, ship(e.ship).pos)) problems.push(`${e.ship} moved from ${at(e.from)}, but the events had her at ${at(ship(e.ship).pos)}`);
        // A current can jump (rules §6.6 example 8), and a cave joins hexes that aren't next to each other (§3.2.2); anything else
        // moves one hex.
        if (e.cause !== 'current' && !e.cave && distance(e.from, e.to) !== 1) problems.push(`${e.ship} moved ${distance(e.from, e.to)} hexes in one step (${e.cause})`);
        ship(e.ship).pos = e.to;
        break;
      case 'ShipTurned':
        if (e.from !== ship(e.ship).heading) problems.push(`${e.ship} turned from heading ${e.from}, but the events had her facing ${ship(e.ship).heading}`);
        ship(e.ship).heading = e.to;
        break;
      case 'Teleported':
        if (!hexEquals(e.from, ship(e.ship).pos)) problems.push(`${e.ship} went into a whirlpool at ${at(e.from)}, but the events had her at ${at(ship(e.ship).pos)}`);
        ship(e.ship).pos = e.to;
        break;
      case 'WentThroughCave':
        ship(e.ship).pos = e.to;
        break;
      case 'ShipSank':
        ship(e.ship).afloat = false;
        break;
      case 'ShipReturned':
        Object.assign(ship(e.ship), { pos: e.at, heading: e.heading, afloat: true });
        break;
      default:
        break;
    }
  }
  return problems;
}

/** Compare where the events have put each ship with the state (once a turn is over: mid-turn the state is the turn's start). */
export function compareTracked(t: Readonly<Record<string, Tracked>>, after: GameState): string[] {
  const problems: string[] = [];
  const ship = (id: string) => t[id] as Tracked;
  for (const s of Object.values(after.ships)) {
    const x = ship(s.id);
    const afloat = s.status === 'afloat';
    if (x.afloat !== afloat) problems.push(`${s.id} is ${s.status} in the state, but the events left her ${x.afloat ? 'afloat' : 'sunk'}`);
    else if (afloat && !hexEquals(x.pos, s.pos)) problems.push(`${s.id} is at ${at(s.pos)} in the state, but the events put her at ${at(x.pos)}`);
    else if (afloat && x.heading !== s.heading) problems.push(`${s.id} faces ${s.heading} in the state, but the events left her facing ${x.heading}`);
  }
  return problems;
}

/** Rules that must always hold. Returns the ones broken (none when all is well). */
export function checkInvariants(state: GameState): string[] {
  const problems: string[] = [];
  const hexes = state.setup.map.hexes;
  const seen = new Map<string, string>();
  for (const s of Object.values(state.ships)) {
    if (s.status !== 'afloat') continue;
    const key = hexKey(s.pos);
    if (!hexes[key]) problems.push(`${s.id} is afloat off the map, at ${key}`);
    const other = seen.get(key);
    if (other) problems.push(`${s.id} and ${other} are both in hex ${key}`);
    seen.set(key, s.id);
  }
  // Every command card in exactly one place.
  const count = new Map<string, number>();
  const where = [...state.deck, ...state.discards, ...Object.values(state.ships).flatMap((s) => [...s.hand, ...Object.values(s.program)])];
  for (const c of where) count.set(c, (count.get(c) ?? 0) + 1);
  for (const card of state.setup.commandCards) {
    const n = count.get(card.id) ?? 0;
    if (n !== 1) problems.push(`card ${card.id} is in ${n} places`);
    count.delete(card.id);
  }
  for (const c of count.keys()) problems.push(`unknown card ${c} in play`);
  // Treasure.
  const loose = new Set<string>();
  for (const k of state.treasures) {
    if (!hexes[k]) problems.push(`treasure off the map, at ${k}`);
    if (loose.has(k)) problems.push(`two treasures in hex ${k}`);
    loose.add(k);
  }
  for (const s of Object.values(state.ships)) if (s.carrying && !s.cargo) problems.push(`${s.id} is carrying treasure with no piece`);
  for (const team of Object.values(state.teams)) if (team.score !== team.hold.length) problems.push(`${team.id} scored ${team.score} but has ${team.hold.length} pieces home`);
  return problems;
}

/** A card as its three orders, e.g. "700 (full / easePort / fire)". */
export function describeCard(state: GameState, id: string): string {
  const c = state.setup.commandCards.find((x) => x.id === id);
  return c ? `${id} (${c.sail} / ${c.steer} / ${c.action})` : id;
}

/** One line for an action. */
export function describeAction(state: GameState, player: string, action: Action): string {
  switch (action.type) {
    case 'place':
      return `${player} place ${action.slot} = ${describeCard(state, action.card)}`;
    case 'remove':
      return `${player} take back ${action.slot}`;
    case 'discard':
      return `${player} discard ${describeCard(state, action.card)}`;
    case 'answer':
      return `${player} answer ${JSON.stringify(state.pending?.options[action.choice] ?? action.choice)} (option ${action.choice} of "${state.pending?.kind}")`;
    default:
      return `${player} ${action.type}`;
  }
}

/** One line for an event: its fields as compact JSON, hexes as "q,r". */
export function describeEvent(e: GameEvent): string {
  const { type, rule, ...rest } = e as GameEvent & Record<string, unknown>;
  const body = JSON.stringify(rest, (_k, v: unknown) =>
    v !== null && typeof v === 'object' && 'q' in v && 'r' in v && 's' in v ? at(v as Hex) : v,
  );
  return `${type} §${rule} ${body}`;
}

function describeShip(state: GameState, s: Ship): string {
  const crew = s.crew.map((c) => `${c.id.split('-').slice(-2).join('-')}:${c.state}`).join(' ');
  const flags = [s.anchored && 'anchored', s.stuck && 'stranded', s.refitting && 'refitting', s.carrying && `carrying ${s.cargo}`].filter(Boolean).join(', ');
  const program = Object.entries(s.program).map(([slot, c]) => `${slot}=${c}`).join(' ');
  return [
    `  ${s.id} (${s.player}): ${s.status} at ${at(s.pos)} facing ${s.heading}, sail ${s.sail}${flags ? `, ${flags}` : ''}`,
    `    damaged slots: ${s.blocked.join(' ') || 'none'} · crew: ${crew}`,
    `    hand (${s.hand.length}): ${s.hand.map((c) => describeCard(state, c)).join(', ') || 'empty'}`,
    ...(program ? [`    program: ${program}`] : []),
  ].join('\n');
}

/** The ship and board state, several lines. */
export function describeState(state: GameState): string {
  const w = state.weather;
  return [
    `  turn ${state.turn}, phase ${state.phase}${state.part ? `, Part ${state.part}` : ''}; ready: ${state.ready.join(' ') || 'nobody'}`,
    `  weather now ${w.spaces[w.now]} (space ${w.now}), next ${w.spaces[(w.now + 1) % 6]}; board ${w.spaces.join(' ')}`,
    `  treasure loose: ${state.treasures.map((k) => `${k} (${state.treasureKinds[k]})`).join(', ') || 'none'} · wrecks: ${state.wrecks.join(' ') || 'none'}`,
    `  scores: ${Object.values(state.teams).map((t) => `${t.id} ${t.score}`).join(', ')} · deck ${state.deck.length}, discards ${state.discards.length}`,
    ...Object.values(state.ships).map((s) => describeShip(state, s)),
  ].join('\n');
}

/** The trace of a whole game, and every problem found, from its setup and action log. */
export function auditGame(setup: GameSetup, log: readonly LogEntry<Action>[], config: RulesConfig): { trace: string; problems: string[] } {
  const game = createGame(config);
  let state = game.init(setup);
  const tracked = trackedFrom(state);
  const lines: string[] = ['== start', describeState(state)];
  const problems: string[] = [];
  const flag = (i: number, list: readonly string[]) => {
    for (const p of list) {
      problems.push(`#${i} (turn ${state.turn}): ${p}`);
      lines.push(`  ⚠ PROBLEM: ${p}`);
    }
  };
  log.forEach((entry, i) => {
    const before = state;
    const turn = before.turn;
    lines.push(`#${i} ${describeAction(before, entry.player, entry.action)}`);
    let out;
    try {
      out = game.apply(before, entry.player, entry.action);
    } catch (err) {
      flag(i, [`the engine refused this action: ${(err as Error).message}`]);
      return;
    }
    state = out.state;
    for (const e of out.events) lines.push(`    ${describeEvent(e)}`);
    const settled = state.phase !== 'resolving';
    flag(i, [...followEvents(tracked, out.events), ...(settled ? [...compareTracked(tracked, state), ...checkInvariants(state)] : [])]);
    if (!settled) lines.push(`  … waiting for ${state.pending?.player}: ${state.pending?.kind}`);
    // The full state whenever a turn has been played out (or a new one began).
    else if (out.events.some((e) => e.type !== 'PlayerReady') || state.turn !== turn) lines.push(`== after #${i}`, describeState(state));
  });
  return { trace: lines.join('\n'), problems };
}
