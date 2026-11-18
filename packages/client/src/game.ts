/**
 * Mock-up game model. NOT the M1 engine: it plays a believable turn with the real sailing, drift and broadside rules
 * from msb-rules, and leaves out what isn't designed yet (currents, terrain, pushing, tides; see the README).
 */
import { Rng, seedRng } from '@msb/engine';
import { hex, hexKey, neighbor, rotate, toDirection, type Direction, type Hex } from '@msb/hex';
import {
  DEFAULT_CONFIG,
  broadsideArcs,
  driftsInPart,
  galeDamage,
  makeConfig,
  pointOfSail,
  rollDamage,
  sailDirection,
  sailMove,
  slotKey,
  type Part,
  type RulesConfig,
  type SailLevel,
  type SlotRow,
  type Weather,
} from '@msb/msb-rules';
import { CARDS, CARD_BY_ID, CREW, SAIL_LABEL, STEER_LABEL, STEER_STEPS, WEATHER_BY_ID, type CommandCard } from './data/content';

export interface CrewMember {
  readonly def: string;
  wounded: boolean;
}

export interface Ship {
  readonly id: string;
  readonly name: string;
  readonly playerId: string;
  readonly colour: string;
  hex: Hex;
  heading: Direction;
  sail: SailLevel;
  /** slotKey → damaged (rules §7.3). */
  damage: Set<string>;
  crew: CrewMember[];
  hand: string[];
  /** slotKey → card id. */
  program: Map<string, string>;
  ready: boolean;
  treasure: number;
  equipment: string[];
}

export interface Player {
  readonly id: string;
  readonly name: string;
  readonly ai: boolean;
  shipIds: string[];
}

export interface Game {
  turn: number;
  /** Weather board: 6 ring spaces clockwise from the top (High tide). `ring` is the current space. */
  ring: number;
  weather: string[]; // [current, next, then]
  players: Player[];
  ships: Ship[];
  deck: string[];
  discard: string[];
  rng: Rng;
  config: RulesConfig;
  onBoard: Set<string>;
}

export const PLAYER_COLOURS = ['#c8102e', '#1f5fbf', '#e0a100', '#2e8b57', '#7b3fa0', '#e06a1b', '#f2f2f2', '#222222'];

export interface ScenarioShip {
  name: string;
  player: string;
  colour: string;
  at: [col: number, row: number];
  heading: Direction;
  crew: string[];
  equipment?: string[];
  treasure?: number;
  damage?: string[];
}

/** Offset (flat-topped, odd-q) ↔ cube coordinates. */
export const offsetToHex = (col: number, row: number): Hex => hex(col, row - (col - (col & 1)) / 2);
export const hexToOffset = (h: Hex): [number, number] => [h.q, h.r + (h.q - (h.q & 1)) / 2];

export function newGame(opts: { onBoard: [number, number][]; fleets: boolean; pointsOfSail: boolean; seed?: number }): Game {
  const rng = new Rng(seedRng(opts.seed ?? 20251118));
  const players: Player[] = [
    { id: 'you', name: 'You', ai: false, shipIds: [] },
    { id: 'p2', name: 'Grandpa', ai: true, shipIds: [] },
    { id: 'p3', name: 'Ellie', ai: true, shipIds: [] },
    { id: 'p4', name: 'Sam', ai: true, shipIds: [] },
  ];
  const ships: ScenarioShip[] = [
    { name: 'Woolly Revenge', player: 'you', colour: PLAYER_COLOURS[0]!, at: [5, 8], heading: 1, crew: ['captain', 'pirate', 'gunner', 'pirate2'], equipment: ['cannon-sights'], damage: ['action3'] },
    ...(opts.fleets
      ? [{ name: 'Tusk & Trunk', player: 'you', colour: PLAYER_COLOURS[0]!, at: [4, 12] as [number, number], heading: 0 as Direction, crew: ['captain', 'cook', 'carpenter'] }]
      : []),
    { name: "Mammoth's Tusk", player: 'p2', colour: PLAYER_COLOURS[1]!, at: [9, 10], heading: 5, crew: ['captain', 'helmsman', 'pirate'], treasure: 1 },
    { name: 'Iron Mastodon', player: 'p3', colour: PLAYER_COLOURS[2]!, at: [2, 8], heading: 2, crew: ['captain', 'marksman', 'lookout', 'bosun'], damage: ['steer1', 'sail2'] },
    { name: 'Hairy Hannah', player: 'p4', colour: PLAYER_COLOURS[3]!, at: [7, 3], heading: 3, crew: ['captain', 'navigator'] },
  ];
  const deck = rng.shuffle(CARDS.map((c) => c.id));
  const game: Game = {
    turn: 1,
    ring: 1,
    weather: ['strong-ne', 'firm-n', 'gale-nw'],
    players,
    ships: [],
    deck,
    discard: [],
    rng,
    config: makeConfig({ pointsOfSail: opts.pointsOfSail }),
    onBoard: new Set(opts.onBoard.map(([c, r]) => hexKey(offsetToHex(c, r)))),
  };
  ships.forEach((s, i) => {
    const ship: Ship = {
      id: `ship${i}`,
      name: s.name,
      playerId: s.player,
      colour: s.colour,
      hex: offsetToHex(...s.at),
      heading: s.heading,
      sail: 'half',
      damage: new Set(s.damage ?? []),
      crew: s.crew.map((def, k) => ({ def, wounded: def === 'gunner' || (k === 2 && s.player === 'p3') })),
      hand: [],
      program: new Map(),
      ready: false,
      treasure: s.treasure ?? 0,
      equipment: s.equipment ?? [],
    };
    game.ships.push(ship);
    players.find((p) => p.id === s.player)!.shipIds.push(ship.id);
  });
  for (const ship of game.ships) drawCards(game, ship);
  return game;
}

export const cardsToDraw = (ship: Ship): number => ship.crew.filter((c) => !c.wounded).reduce((n, c) => n + (CREW[c.def]?.draws ?? 1), 0);

/** §5.1: draw one card per healthy crew card icon, keeping the hand at most 9. */
export function drawCards(game: Game, ship: Ship): void {
  const n = Math.min(cardsToDraw(ship), game.config.handLimit - ship.hand.length);
  for (let i = 0; i < n; i++) {
    if (game.deck.length === 0) game.deck = game.rng.shuffle(game.discard.splice(0));
    const c = game.deck.pop();
    if (c) ship.hand.push(c);
  }
  ship.hand.sort((a, b) => CARD_BY_ID.get(a)!.initiative - CARD_BY_ID.get(b)!.initiative);
}

export function currentWeather(game: Game): Weather & { id: string } {
  const w = WEATHER_BY_ID.get(game.weather[0]!)!;
  return { id: w.id, strength: w.strength ?? 'deadCalm', direction: w.direction ?? 0 };
}

// ---------- simulation of one ship's programmed turn ----------

export type Phase = 'move' | 'steer' | 'currents' | 'action' | 'drift';
export const PHASES: readonly Phase[] = ['move', 'steer', 'currents', 'action', 'drift'];
export const PHASE_LABEL: Record<Phase, string> = { move: 'Move', steer: 'Steer', currents: 'Currents', action: 'Action', drift: 'Wind drift' };

export interface ShipState {
  hex: Hex;
  heading: Direction;
  sail: SailLevel;
}
export interface Step {
  part: Part;
  phase: Phase;
  /** Hexes passed through, in order (empty = didn't move). */
  path: Hex[];
  after: ShipState;
  caption: string;
  card?: CommandCard;
  /** Gale damage taken (DD). */
  dd?: number;
}

const POS_LABEL = { windward: 'into the wind', closeHauled: 'close hauled', broadReach: 'broad reach', running: 'running' } as const;
const PART_NAME: Record<Part, string> = { 1: 'I', 2: 'II', 3: 'III' };
export const partName = (p: Part): string => PART_NAME[p];

const cardIn = (ship: Ship, row: SlotRow, part: Part): CommandCard | undefined => {
  const key = slotKey({ row, part });
  if (ship.damage.has(key)) return undefined;
  const id = ship.program.get(key);
  return id ? CARD_BY_ID.get(id) : undefined;
};

/** Move up to |n| hexes in `dir`, stopping at the board edge. */
function travel(game: Game, from: Hex, dir: Direction, n: number): { path: Hex[]; blocked: boolean } {
  const path: Hex[] = [];
  let at = from;
  for (let i = 0; i < n; i++) {
    const next = neighbor(at, dir);
    if (!game.onBoard.has(hexKey(next))) return { path, blocked: true };
    path.push(next);
    at = next;
  }
  return { path, blocked: false };
}

export function simulate(game: Game, ship: Ship): Step[] {
  const weather = currentWeather(game);
  const special = WEATHER_BY_ID.get(weather.id)!.strength === null;
  const s: ShipState = { hex: ship.hex, heading: ship.heading, sail: ship.sail };
  const steps: Step[] = [];
  for (const part of [1, 2, 3] as Part[]) {
    let anchored = false;
    // Move phase
    {
      const card = cardIn(ship, 'sail', part);
      let move = 0;
      let caption: string;
      let dir = s.heading;
      if (card?.sail === 'anchor') {
        anchored = true;
        s.sail = 'none';
        caption = 'Anchor: sails down, holds position (assumed: no sail move or drift this Part)';
      } else if (card?.sail === 'rowAhead' || card?.sail === 'rowBack') {
        move = card.sail === 'rowAhead' ? 1 : -1;
        dir = sailDirection(s.heading, move);
        caption = `${SAIL_LABEL[card.sail]}: 1 hex ${move > 0 ? 'ahead' : 'astern'} whatever the wind (assumed)`;
      } else {
        if (card) s.sail = card.sail as SailLevel;
        move = special ? 0 : sailMove(s.sail, s.heading, weather, game.config);
        dir = sailDirection(s.heading, move);
        const pos = game.config.pointsOfSail ? `, ${POS_LABEL[pointOfSail(s.heading, weather.direction)]}` : '';
        const level = s.sail === 'none' ? 'No Sail' : s.sail === 'half' ? 'Half Sail' : 'Full Sail';
        caption = `${card ? '' : 'Sail unchanged: '}${level}${s.sail === 'none' ? '' : pos} in a ${WEATHER_BY_ID.get(weather.id)!.name} = ${Math.abs(move)} hex${Math.abs(move) === 1 ? '' : 'es'}${move < 0 ? ' backwards (taken aback)' : ''}`;
      }
      const { path, blocked } = travel(game, s.hex, dir, Math.abs(move));
      if (path.length) s.hex = path[path.length - 1]!;
      if (blocked) caption += ' (stopped at the board edge)';
      const dd = galeDamage(s.sail, weather, game.config);
      steps.push({ part, phase: 'move', path, after: { ...s }, caption: dd ? `${caption}; Gale: ${dd} DD for Full Sail` : caption, ...(card ? { card } : {}), ...(dd ? { dd } : {}) });
    }
    // Steer phase
    {
      const card = cardIn(ship, 'steer', part);
      if (card) s.heading = rotate(s.heading, STEER_STEPS[card.steer]);
      steps.push({ part, phase: 'steer', path: [], after: { ...s }, caption: card ? `${STEER_LABEL[card.steer]}` : 'No turn', ...(card ? { card } : {}) });
    }
    // Currents: need the board tile data (rules Q18–Q20)
    steps.push({ part, phase: 'currents', path: [], after: { ...s }, caption: 'Currents: not in the mock-up yet (waiting on the board tile data)' });
    // Action phase
    {
      const card = cardIn(ship, 'action', part);
      steps.push({ part, phase: 'action', path: [], after: { ...s }, caption: card ? `${card.action === 'fire' ? 'Fire Cannons' : card.action === 'heal' ? 'Heal' : 'Repair'}` : 'No action', ...(card ? { card } : {}) });
    }
    // Wind drift
    {
      const drifts = !special && !anchored && driftsInPart(weather.strength, part);
      const { path, blocked } = drifts ? travel(game, s.hex, weather.direction, 1) : { path: [], blocked: false };
      if (path.length) s.hex = path[0]!;
      steps.push({
        part,
        phase: 'drift',
        path,
        after: { ...s },
        caption: drifts ? `Wind drift: 1 hex downwind${blocked ? ' (blocked by the board edge)' : ''}` : 'No drift this Part',
      });
    }
  }
  return steps;
}

/** Ship position at the end of each Part (for the ghost preview). */
export function partEnds(steps: Step[]): ShipState[] {
  return [1, 2, 3].map((p) => steps.filter((s) => s.part === p).at(-1)!.after);
}

// ---------- AI programming (mock: random but stays on the board) ----------

export function aiProgram(game: Game, ship: Ship): void {
  let best: { prog: Map<string, string>; score: number } | null = null;
  for (let attempt = 0; attempt < 40; attempt++) {
    const hand = game.rng.shuffle(ship.hand);
    const prog = new Map<string, string>();
    const slots = (['sail', 'steer', 'action'] as SlotRow[]).flatMap((row) => ([1, 2, 3] as Part[]).map((part) => slotKey({ row, part })));
    for (const key of slots) {
      if (ship.damage.has(key) || hand.length === 0) continue;
      if (game.rng.float() < 0.75) prog.set(key, hand.pop()!);
    }
    ship.program = prog;
    const steps = simulate(game, ship);
    const edgeHits = steps.filter((s) => s.caption.includes('board edge')).length;
    const moved = steps.reduce((n, s) => n + s.path.length, 0);
    const score = moved - edgeHits * 5;
    if (!best || score > best.score) best = { prog, score };
  }
  ship.program = best!.prog;
}

// ---------- resolution: all ships, phase by phase ----------

export interface Shot {
  from: string;
  target: string;
  dd: number;
  ship: number;
  crew: number;
}
export interface ResolutionStep {
  part: Part;
  phase: Phase;
  /** ship id → that ship's step. */
  ships: Map<string, Step>;
  shots: Shot[];
  caption: string;
}

export function resolveTurn(game: Game): ResolutionStep[] {
  const perShip = new Map(game.ships.map((s) => [s.id, simulate(game, s)]));
  const out: ResolutionStep[] = [];
  let i = 0;
  for (const part of [1, 2, 3] as Part[])
    for (const phase of PHASES) {
      const ships = new Map<string, Step>();
      for (const s of game.ships) ships.set(s.id, perShip.get(s.id)![i]!);
      const shots: Shot[] = [];
      if (phase === 'action') {
        // §5.3 Action-slot initiative order; every enemy in either broadside arc is hit (§7.1).
        const firing = game.ships
          .map((s) => ({ s, step: ships.get(s.id)! }))
          .filter(({ step }) => step.card?.action === 'fire')
          .sort((a, b) => b.step.card!.initiative - a.step.card!.initiative);
        for (const { s, step } of firing) {
          const arcs = broadsideArcs(step.after.hex, step.after.heading, game.config);
          const inArc = new Set([...arcs.port, ...arcs.starboard].map(hexKey));
          for (const t of game.ships) {
            if (t.playerId === s.playerId) continue;
            if (!inArc.has(hexKey(ships.get(t.id)!.after.hex))) continue;
            const r = rollDamage(game.rng, game.config.dd.cannonHit, game.config);
            shots.push({ from: s.id, target: t.id, dd: game.config.dd.cannonHit, ship: r.ship, crew: r.crew });
          }
        }
      }
      const you = game.ships.find((s) => s.playerId === 'you')!;
      const yourStep = ships.get(you.id)!;
      const shotText = shots.map((sh) => `${shipName(game, sh.from)} hits ${shipName(game, sh.target)}: ${dmgText(sh)}`).join(' · ');
      out.push({ part, phase, ships, shots, caption: shotText || `${you.name}: ${yourStep.caption}` });
      i++;
    }
  return out;
}

const shipName = (g: Game, id: string) => g.ships.find((s) => s.id === id)!.name;
const dmgText = (s: Shot) => (s.ship + s.crew === 0 ? 'a miss' : [s.ship && `${s.ship} ship`, s.crew && `${s.crew} crew`].filter(Boolean).join(' + ') + ' damage');

/** End of turn: commit positions, return used cards, advance the weather board, draw. */
export function upkeep(game: Game, steps: ResolutionStep[]): string[] {
  const notes: string[] = [];
  const last = steps.at(-1)!;
  for (const ship of game.ships) {
    const st = last.ships.get(ship.id)!.after;
    ship.hex = st.hex;
    ship.heading = st.heading;
    ship.sail = st.sail;
    game.discard.push(...ship.program.values());
    ship.program = new Map();
    ship.ready = false;
  }
  game.turn++;
  game.ring = (game.ring + 1) % 6;
  const pool = ['light-n', 'firm-se', 'strong-sw', 'gale-ne', 'firm-nw', 'light-s', 'strong-n', 'dead-calm'];
  game.weather = [game.weather[1]!, game.weather[2]!, pool[game.rng.int(0, pool.length - 1)]!];
  notes.push(`New weather: ${WEATHER_BY_ID.get(game.weather[0]!)!.name}. The tide moves on.`);
  for (const ship of game.ships) drawCards(game, ship);
  notes.push('Each ship draws one command card per healthy crew card icon (hand limit 9).');
  return notes;
}

export const wouldSink = (ship: Ship): boolean =>
  (['sail', 'steer', 'action'] as SlotRow[]).some((row) => ([1, 2, 3] as Part[]).every((part) => ship.damage.has(slotKey({ row, part }))));

export { DEFAULT_CONFIG, toDirection };
