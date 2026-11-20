/**
 * The Basic AI (engineering design §10): plan one turn by trying candidate programs in the real rules engine and scoring where
 * the ship ends up. It plays fair: before simulating it forgets what it couldn't know (rivals' cards, the dice to come).
 */

import type { PendingDecision, ResolutionContext } from '@msb/engine';
import { hexKey, neighbor, type Direction, type Hex } from '@msb/hex';
import {
  freeSlots,
  resolveTurn,
  type Action,
  type CommandCard,
  type GameEvent,
  type GameState,
  type Player,
  type PlayerId,
  type RulesConfig,
  type Ship,
  type Team,
  type Weather,
  type WeatherCard,
  type WindStrength,
} from '@msb/msb-rules';
import { distanceMap, distanceOf, type DistanceMap } from './distance';
import { chooseProgram, type AiLevel } from './levels';
import { BALANCED, WEIGHTS, type Style, type Weights } from './weights';
import { STYLES, type Personality } from './personality';

export { WEIGHTS } from './weights';

/** How many partial programs to keep after each Part (beam width). */
export const BEAM = 4;

/** A program: slot key → card id. */
export type Program = Readonly<Record<string, string>>;

/** The weather the ship will sail in next turn: the next card if it's a wind, else the current one. */
export function planningWeather(state: GameState): Weather {
  const { spaces, now } = state.weather;
  const card = (id: string | undefined) => state.setup.weatherCards.find((c: WeatherCard) => c.id === id);
  const next = card(spaces[(now + 1) % 6]);
  const current = card(spaces[now]);
  const usable = (c: WeatherCard | undefined): c is WeatherCard & { strength: WindStrength } => c !== undefined && c.strength !== 'newFront';
  const pick = usable(next) ? next : (current as WeatherCard & { strength: WindStrength });
  return { strength: pick.strength, direction: pick.direction ?? 0 };
}

/**
 * Where the ship is heading for: her home port when carrying treasure, else the loose treasure. A raider goes for rivals instead:
 * any rival carrying treasure, or else rival ships and treasure alike.
 */
export function goals(state: GameState, ship: Ship, raider = false): string[] {
  const team = (state.players[ship.player] as Player).team;
  if (ship.carrying) return [hexKey((state.teams[team] as Team).homePort)];
  if (!raider) return [...state.treasures];
  const rivals = Object.values(state.ships).filter((s) => s.status === 'afloat' && (state.players[s.player] as Player).team !== team);
  const carriers = rivals.filter((s) => s.carrying);
  return carriers.length > 0 ? carriers.map((s) => hexKey(s.pos)) : [...state.treasures, ...rivals.map((s) => hexKey(s.pos))];
}

/** Forget what this player couldn't know: rivals' programs and hands, and the dice (the RNG) to come. */
export function determinize(state: GameState, player: PlayerId): GameState {
  const copy = JSON.parse(JSON.stringify(state)) as GameState;
  const team = (copy.players[player] as Player).team;
  for (const ship of Object.values(copy.ships)) {
    if ((copy.players[ship.player] as Player).team === team) continue;
    ship.program = {};
  }
  // A different but fixed stream: the AI can't foresee the real rolls, and the same position always gets the same plan.
  copy.rng = (Math.imul(copy.rng ^ 0x9e3779b9, 2654435761) | 1) >>> 0;
  return copy;
}

/** The end of a simulated turn: the state, and the ships that sank during it (a sunk ship is back afloat after Upkeep). */
export interface Simulation {
  readonly state: GameState;
  readonly sank: ReadonlySet<string>;
}

/** Run the whole turn on a copy, with every question answered by its default. */
export function simulate(base: GameState, shipId: string, program: Program, config: RulesConfig): Simulation {
  const state = JSON.parse(JSON.stringify(base)) as GameState;
  const ship = state.ships[shipId] as Ship;
  // Played cards leave the hand, as when placed for real (so a look at next turn can't use them again).
  const used = Object.values(program);
  ship.hand = ship.hand.filter((c) => !used.includes(c));
  ship.program = { ...program };
  state.phase = 'resolving';
  const sank = new Set<string>();
  const ctx: ResolutionContext<GameEvent> = {
    ask: <T>(d: PendingDecision<T>) => d.options[d.defaultIndex] as T,
    emit: (e) => {
      if (e.type === 'ShipSank') sank.add(e.ship);
    },
  };
  return { state: resolveTurn(config)(state, ctx), sank };
}

const healthy = (s: Ship) => s.crew.filter((c) => c.state === 'healthy').length;

/** How good the position after a turn is, for this ship. */
export function evaluate(
  before: GameState,
  sim: Simulation,
  shipId: string,
  dist: DistanceMap,
  program: Program,
  weather?: Weather,
  w: Weights = WEIGHTS,
): number {
  const after = sim.state;
  const was = before.ships[shipId] as Ship;
  const me = after.ships[shipId] as Ship;
  const team = (before.players[was.player] as Player).team;
  const scoreOf = (s: GameState) => (s.teams[team] as Team).score;
  let score = Object.keys(program).length * w.cardUsed;
  const scored = scoreOf(after) - scoreOf(before);
  score += scored * w.scored;
  if (sim.sank.has(shipId)) return score + w.sunk;
  if (me.carrying && !was.carrying) score += w.pickUp;
  if (!me.carrying && was.carrying && scored === 0) score += w.loseTreasure;
  score += distanceOf(dist, me.pos) * w.perDistance;
  // Facing a nearer hex is worth a little: next turn starts in the right direction.
  const ahead = neighbor(me.pos, me.heading);
  if (distanceOf(dist, ahead) < distanceOf(dist, me.pos)) score += w.facingGoal;
  score += (me.blocked.length - was.blocked.length) * w.slotDamaged;
  score += (healthy(was) - healthy(me)) * w.crewHurt;
  const terrain = after.setup.map.hexes[hexKey(me.pos)]?.terrain;
  if (terrain === 'roughWater' || terrain === 'storm') score += w.inHazard;
  if (me.stuck) score += w.stranded;
  const onMap = (h: Hex) => after.setup.map.hexes[hexKey(h)] !== undefined;
  // No drift in her own port (§8.2.4), and the port is on the rim, so the edge is no danger there.
  const inPort = hexKey(me.pos) === hexKey((after.teams[team] as Team).homePort);
  if (!inPort && ([0, 1, 2, 3, 4, 5] as Direction[]).some((d) => !onMap(neighbor(me.pos, d)))) score += w.onEdge;
  if (!inPort && weather && weather.strength !== 'deadCalm' && weather.strength !== 'light' && !onMap(neighbor(me.pos, weather.direction))) score += w.driftOffMap;
  for (const [id, other] of Object.entries(after.ships)) {
    const old = before.ships[id] as Ship;
    if ((before.players[old.player] as Player).team === team) continue;
    if (sim.sank.has(id)) score += w.enemySunk;
    else score += (other.blocked.length - old.blocked.length + healthy(old) - healthy(other)) * w.enemyHurt;
  }
  return score;
}

type Row = 'sail' | 'steer' | 'action';
const ROWS: readonly Row[] = ['sail', 'steer', 'action'];

/** The cards in the hand grouped by the order they carry in this row. */
function byOrder(row: Row, hand: readonly string[], cards: ReadonlyMap<string, CommandCard>): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const id of hand) {
    const order = (cards.get(id) as CommandCard)[row];
    groups.set(order, [...(groups.get(order) ?? []), id]);
  }
  return groups;
}

/**
 * Distinct cards for a choice of orders (one per row, or none): a small backtracking search, so a combination is only skipped when
 * the hand really can't supply it with different cards.
 */
export function assignCards(wanted: readonly (readonly string[] | undefined)[]): (string | undefined)[] | undefined {
  const pick = (i: number, used: ReadonlySet<string>): (string | undefined)[] | undefined => {
    if (i === wanted.length) return [];
    const options = wanted[i];
    if (options === undefined) {
      const rest = pick(i + 1, used);
      return rest && [undefined, ...rest];
    }
    for (const card of options) {
      if (used.has(card)) continue;
      const rest = pick(i + 1, new Set([...used, card]));
      if (rest) return [card, ...rest];
    }
    return undefined;
  };
  return pick(0, new Set());
}

/**
 * Choose a program for a ship: Part by Part, try every distinct (sail, steer, action) combination from the cards left,
 * simulate the turn, and keep the best few to build on.
 */
export function planProgram(state: GameState, shipId: string, config: RulesConfig, beam = BEAM): Program {
  return (rankPrograms(state, shipId, config, beam)[0] as Ranked).program;
}

/** A candidate program and its score. */
export interface Ranked {
  readonly program: Program;
  readonly score: number;
}

/** The best programs found (up to `beam` of them), best first. */
export function rankPrograms(state: GameState, shipId: string, config: RulesConfig, beam = BEAM, style: Style = BALANCED): Ranked[] {
  const ship = state.ships[shipId] as Ship;
  const world = determinize(state, ship.player);
  const weather = planningWeather(state);
  const dist = distanceMap(state, goals(state, ship, style.raider), weather, config);
  const cards = new Map(state.setup.commandCards.map((c) => [c.id, c]));
  const free = new Set(freeSlots(ship));
  let beams: { program: Program; score: number }[] = [{ program: {}, score: -Infinity }];
  for (const part of [1, 2, 3]) {
    const next: { program: Program; score: number }[] = [];
    for (const beam of beams) {
      const used = new Set(Object.values(beam.program));
      const hand = ship.hand.filter((c) => !used.has(c));
      // For each row: leave it empty, or one of the distinct orders the hand carries for it.
      const rows = ROWS.map((row) => ({
        slot: `${row}${part}`,
        options: [undefined, ...(free.has(`${row}${part}`) ? byOrder(row, hand, cards).values() : [])],
      }));
      for (const sail of rows[0]!.options)
        for (const steer of rows[1]!.options)
          for (const action of rows[2]!.options) {
            const chosen = assignCards([sail, steer, action]);
            if (!chosen) continue; // the hand can't supply these orders with different cards
            const program: Record<string, string> = { ...beam.program };
            chosen.forEach((card, i) => {
              if (card) program[(rows[i] as { slot: string }).slot] = card;
            });
            // Every beam and every combination differ, so each program is new.
            const after = simulate(world, shipId, program, config);
            next.push({ program, score: evaluate(world, after, shipId, dist, program, weather, style.weights) });
          }
    }
    beams = next.sort((a, b) => b.score - a.score).slice(0, beam);
  }
  return beams;
}

/**
 * Every action a player's AI takes in the programming phase, in order: place the planned cards, discard down to the hand limit
 * (keeping the cards with the most useful orders is a later refinement: it drops the first ones), then ready.
 */
/** `beam` trades strength for speed: the simulator uses a narrower one to play many games. */
/** How a computer player plays: search width (when no level is given), difficulty level and personality. */
export interface AiOptions {
  readonly beam?: number | undefined;
  readonly level?: AiLevel | undefined;
  readonly personality?: Personality | undefined;
}

export function programmingTurn(state: GameState, player: PlayerId, config: RulesConfig, options: AiOptions = {}): Action[] {
  const style = STYLES[options.personality ?? 'balanced'];
  const actions: Action[] = [];
  for (const id of (state.players[player] as Player).ships) {
    const ship = state.ships[id] as Ship;
    if (ship.status !== 'afloat' || ship.refitting) continue;
    const program = options.level
      ? chooseProgram(state, id, config, options.level, style)
      : (rankPrograms(state, id, config, options.beam, style)[0] as Ranked).program;
    for (const [slot, card] of Object.entries(program)) actions.push({ type: 'place', ship: id, slot, card });
    const left = ship.hand.filter((c) => !Object.values(program).includes(c));
    for (const card of left.slice(0, Math.max(0, left.length - config.handLimit))) actions.push({ type: 'discard', ship: id, card });
  }
  actions.push({ type: 'ready' });
  return actions;
}
