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

/** How many partial programs to keep after each Part (beam width). */
const BEAM = 4;

/** Score weights: what the AI cares about. Bigger = more important. */
export const WEIGHTS = {
  sunk: -5000,
  scored: 2000,
  pickUp: 600,
  loseTreasure: -600,
  perDistance: -40,
  facingGoal: 25,
  slotDamaged: -60,
  crewHurt: -70,
  enemyHurt: 30,
  enemySunk: 300,
  inHazard: -120,
  stranded: -200,
  /** Ending the turn where next turn's wind drift (or a stray move) would carry her off the map. */
  driftOffMap: -800,
  onEdge: -15,
  cardUsed: -1,
} as const;

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

/** Where the ship is heading for: her home port when carrying treasure, else the loose treasure. */
export function goals(state: GameState, ship: Ship): string[] {
  const team = state.teams[(state.players[ship.player] as Player).team] as Team;
  if (ship.carrying) return [hexKey(team.homePort)];
  return [...state.treasures];
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
  (state.ships[shipId] as Ship).program = { ...program };
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
export function evaluate(before: GameState, sim: Simulation, shipId: string, dist: DistanceMap, program: Program, weather?: Weather): number {
  const after = sim.state;
  const was = before.ships[shipId] as Ship;
  const me = after.ships[shipId] as Ship;
  const team = (before.players[was.player] as Player).team;
  const scoreOf = (s: GameState) => (s.teams[team] as Team).score;
  let score = Object.keys(program).length * WEIGHTS.cardUsed;
  const scored = scoreOf(after) - scoreOf(before);
  score += scored * WEIGHTS.scored;
  if (sim.sank.has(shipId)) return score + WEIGHTS.sunk;
  if (me.carrying && !was.carrying) score += WEIGHTS.pickUp;
  if (!me.carrying && was.carrying && scored === 0) score += WEIGHTS.loseTreasure;
  score += distanceOf(dist, me.pos) * WEIGHTS.perDistance;
  // Facing a nearer hex is worth a little: next turn starts in the right direction.
  const ahead = neighbor(me.pos, me.heading);
  if (distanceOf(dist, ahead) < distanceOf(dist, me.pos)) score += WEIGHTS.facingGoal;
  score += (me.blocked.length - was.blocked.length) * WEIGHTS.slotDamaged;
  score += (healthy(was) - healthy(me)) * WEIGHTS.crewHurt;
  const terrain = after.setup.map.hexes[hexKey(me.pos)]?.terrain;
  if (terrain === 'roughWater' || terrain === 'storm') score += WEIGHTS.inHazard;
  if (me.stuck) score += WEIGHTS.stranded;
  const onMap = (h: Hex) => after.setup.map.hexes[hexKey(h)] !== undefined;
  // No drift in her own port (§8.2.4), and the port is on the rim, so the edge is no danger there.
  const inPort = hexKey(me.pos) === hexKey((after.teams[team] as Team).homePort);
  if (!inPort && ([0, 1, 2, 3, 4, 5] as Direction[]).some((d) => !onMap(neighbor(me.pos, d)))) score += WEIGHTS.onEdge;
  if (!inPort && weather && weather.strength !== 'deadCalm' && weather.strength !== 'light' && !onMap(neighbor(me.pos, weather.direction))) score += WEIGHTS.driftOffMap;
  for (const [id, other] of Object.entries(after.ships)) {
    const old = before.ships[id] as Ship;
    if ((before.players[old.player] as Player).team === team) continue;
    if (sim.sank.has(id)) score += WEIGHTS.enemySunk;
    else score += (other.blocked.length - old.blocked.length + healthy(old) - healthy(other)) * WEIGHTS.enemyHurt;
  }
  return score;
}

/** One option per distinct order for a row: the first card in the hand that carries it. */
function choicesFor(row: 'sail' | 'steer' | 'action', hand: readonly string[], cards: ReadonlyMap<string, CommandCard>): string[] {
  const seen = new Map<string, string>();
  for (const id of hand) {
    const card = cards.get(id) as CommandCard;
    const order = card[row];
    if (!seen.has(order)) seen.set(order, id);
  }
  return [...seen.values()];
}

/**
 * Choose a program for a ship: Part by Part, try every distinct (sail, steer, action) combination from the cards left,
 * simulate the turn, and keep the best few to build on.
 */
export function planProgram(state: GameState, shipId: string, config: RulesConfig): Program {
  const ship = state.ships[shipId] as Ship;
  const world = determinize(state, ship.player);
  const weather = planningWeather(state);
  const dist = distanceMap(state, goals(state, ship), weather, config);
  const cards = new Map(state.setup.commandCards.map((c) => [c.id, c]));
  const free = new Set(freeSlots(ship));
  let beams: { program: Program; score: number }[] = [{ program: {}, score: -Infinity }];
  for (const part of [1, 2, 3]) {
    const next: { program: Program; score: number }[] = [];
    for (const beam of beams) {
      const used = new Set(Object.values(beam.program));
      const hand = ship.hand.filter((c) => !used.has(c));
      const rows = (['sail', 'steer', 'action'] as const).map((row) => ({
        slot: `${row}${part}`,
        options: free.has(`${row}${part}`) ? [undefined, ...choicesFor(row, hand, cards)] : [undefined],
      }));
      for (const sail of rows[0]!.options)
        for (const steer of rows[1]!.options)
          for (const action of rows[2]!.options) {
            const picked = [sail, steer, action].filter((c): c is string => c !== undefined);
            if (new Set(picked).size !== picked.length) continue; // one card can't fill two slots
            const program: Record<string, string> = { ...beam.program };
            if (sail) program[rows[0]!.slot] = sail;
            if (steer) program[rows[1]!.slot] = steer;
            if (action) program[rows[2]!.slot] = action;
            // Every beam and every combination differ, so each program is new.
            const after = simulate(world, shipId, program, config);
            next.push({ program, score: evaluate(world, after, shipId, dist, program, weather) });
          }
    }
    beams = next.sort((a, b) => b.score - a.score).slice(0, BEAM);
  }
  return (beams[0] as { program: Program }).program;
}

/**
 * Every action a player's AI takes in the programming phase, in order: place the planned cards, discard down to the hand limit
 * (keeping the cards with the most useful orders is a later refinement: it drops the first ones), then ready.
 */
export function programmingTurn(state: GameState, player: PlayerId, config: RulesConfig): Action[] {
  const actions: Action[] = [];
  for (const id of (state.players[player] as Player).ships) {
    const ship = state.ships[id] as Ship;
    if (ship.status !== 'afloat' || ship.refitting) continue;
    const program = planProgram(state, id, config);
    for (const [slot, card] of Object.entries(program)) actions.push({ type: 'place', ship: id, slot, card });
    const left = ship.hand.filter((c) => !Object.values(program).includes(c));
    for (const card of left.slice(0, Math.max(0, left.length - config.handLimit))) actions.push({ type: 'discard', ship: id, card });
  }
  actions.push({ type: 'ready' });
  return actions;
}
