import { describe, expect, it } from 'vitest';
import { Rng, type PendingDecision, type ResolutionContext } from '@msb/engine';
import { Direction, distance, hex, hexKey, neighbor, type Hex } from '@msb/hex';
import {
  advanceWeather,
  advanceWeatherAndTide,
  createGame,
  driftShip,
  makeConfig,
  moveShip,
  newGame,
  resolveNewFront,
  runActions,
  runCurrents,
  setUpWeather,
  steerShip,
  stepShip,
  tide,
  type CommandCard,
  type GameEvent,
  type GameMap,
  type GameState,
  type MapHex,
  type MoveContext,
  type WeatherCard,
  type WindStrength,
} from '@msb/msb-rules';
import { CALM_WEATHER, TEST_CARDS } from './fixtures';

const { N, NE, S } = Direction;
const O = hex(0, 0);
const k = hexKey;
const MISS = makeConfig({ damageDie: Array(12).fill({ ship: 0, crew: 0 }) });
const PORT_A = hex(-4, 0);

function map(overrides: Record<string, MapHex> = {}): GameMap {
  const hexes: Record<string, MapHex> = {};
  for (let q = -4; q <= 4; q++) for (let r = -4; r <= 4; r++) if (distance(O, hex(q, r)) <= 4) hexes[k(hex(q, r))] = { terrain: 'sea' };
  return { id: 'test', hexes: { ...hexes, ...overrides } };
}

function game(m: GameMap = map(), weather: readonly WeatherCard[] = CALM_WEATHER): GameState {
  const seats = [
    { player: 'A', team: 'red', name: 'A', homePort: PORT_A, heading: N },
    { player: 'B', team: 'blue', name: 'B', homePort: hex(4, -4), heading: N },
  ];
  return newGame({ seed: 5, map: m, seats, commandCards: TEST_CARDS, weatherCards: weather });
}

const ship = (s: GameState, id: string) => s.ships[`${id}-ship`]!;
function place(s: GameState, id: string, at: Hex, heading: Direction = N): void {
  Object.assign(ship(s, id), { pos: at, heading });
}
function setWeather(s: GameState, strength: WindStrength, direction: Direction = N, space = 1): void {
  const card: WeatherCard = { id: `w-${strength}-${direction}`, strength, direction };
  (s.setup as unknown as { weatherCards: WeatherCard[] }).weatherCards = [card];
  s.weather.spaces = Array(6).fill(card.id);
  s.weather.now = space;
}
function card(sail: CommandCard['sail']): string {
  return TEST_CARDS.find((c) => c.sail === sail)!.id;
}
function run(s: GameState, fn: (m: MoveContext) => void, config = MISS): GameEvent[] {
  const events: GameEvent[] = [];
  const ctx: ResolutionContext<GameEvent> = { ask: <T,>(d: PendingDecision<T>) => d.options[d.defaultIndex] as T, emit: (e) => events.push(e) };
  fn({ state: s, config, part: 1, ctx });
  return events;
}

const winds = (n: number): WeatherCard[] => Array.from({ length: n }, (_, i) => ({ id: `w${i}`, strength: 'firm', direction: (i % 6) as Direction }));

describe('the weather board (rules §3.5, §5.4 step 7)', () => {
  it('advances one space; the card leaving "now" is discarded and its space refilled from the deck', () => {
    const cards = winds(10);
    const { board } = setUpWeather(cards, 1);
    const before = { ...board, spaces: [...board.spaces], deck: [...board.deck] };
    advanceWeather(board, cards, new Rng(1));
    expect(board.now).toBe((before.now + 1) % 6);
    expect(board.discards).toEqual([before.spaces[before.now]]);
    expect(board.spaces[before.now]).toBe(before.deck[0]);
    expect(board.deck).toEqual(before.deck.slice(1));
  });

  it('reshuffles the discards when the deck runs out', () => {
    const cards = winds(6);
    const { board } = setUpWeather(cards, 2);
    expect(board.deck).toEqual([]);
    for (let i = 0; i < 8; i++) advanceWeather(board, cards, new Rng(i));
    expect([...board.spaces].sort()).toEqual(cards.map((c) => c.id).sort());
  });

  it('New Weather Front: when it becomes "now", every weather card is reshuffled and 6 new ones dealt', () => {
    const cards: WeatherCard[] = [{ id: 'front', strength: 'newFront' }, ...winds(8)];
    const board = { spaces: ['w0', 'front', 'w1', 'w2', 'w3', 'w4'], now: 0, deck: ['w5', 'w6', 'w7'], discards: [] as string[] };
    const { fronts } = advanceWeather(board, cards, new Rng(3));
    expect(fronts).toBeGreaterThanOrEqual(1);
    expect(board.spaces[board.now]).not.toBe('front');
    expect([...board.spaces, ...board.deck, ...board.discards].sort()).toEqual(cards.map((c) => c.id).sort());
    expect(() => resolveNewFront({ spaces: Array(6).fill('front'), now: 0, deck: [], discards: [] }, [cards[0]!], new Rng(1))).toThrow('some wind');
  });

  it('a game never starts with New Weather Front as "now"', () => {
    for (let seed = 1; seed < 40; seed++) {
      const cards: WeatherCard[] = [{ id: 'front', strength: 'newFront' }, ...winds(6)];
      const { board } = setUpWeather(cards, seed);
      expect(board.spaces[board.now]).not.toBe('front');
    }
  });
});

describe('tides and stranding (rules §6.4, §6.7)', () => {
  it('when the tide dries her hex, she is stuck; when it floods again, she is freed', () => {
    const s = game(map({ [k(O)]: { terrain: 'sandbank' } }));
    place(s, 'A', O);
    s.weather.now = 0; // High: the sandbank is water
    const events = run(s, (m) => advanceWeatherAndTide(s, m.ctx)); // → Mid
    expect(tide(s.weather)).toBe('mid');
    expect(events).toContainEqual({ type: 'TideChanged', rule: '6.4', tide: 'mid' });
    expect(events).toContainEqual({ type: 'ShipStranded', rule: '6.7', ship: 'A-ship' });
    expect(ship(s, 'A').stuck).toBe(true);
    s.weather.now = 5;
    const freed = run(s, (m) => advanceWeatherAndTide(s, m.ctx)); // → High
    expect(freed).toContainEqual({ type: 'ShipFreed', rule: '6.7', ship: 'A-ship' });
    expect(ship(s, 'A').stuck).toBe(false);
    s.weather.now = 1;
    expect(run(s, (m) => advanceWeatherAndTide(s, m.ctx)).some((e) => e.type === 'TideChanged')).toBe(false); // Mid → Mid
  });

  it('a stuck ship can’t sail, steer, drift or be carried, and stops others like a beach; she can still act', () => {
    const s = game(map({ [k(O)]: { terrain: 'sea', current: { kind: 'flow', to: k(neighbor(O, N)), turn: 1, strength: 1 } } }));
    setWeather(s, 'gale', N);
    place(s, 'A', O, N);
    ship(s, 'A').stuck = true;
    ship(s, 'A').program = { sail1: card('full'), steer1: card('full'), action1: TEST_CARDS.find((c) => c.action === 'fire')!.id };
    place(s, 'B', hex(2, 0));
    const events = run(s, (m) => {
      moveShip(m, ship(s, 'A'));
      steerShip(m, ship(s, 'A'));
      runCurrents(m, [ship(s, 'A')]);
      driftShip(m, ship(s, 'A'));
      stepShip(m, ship(s, 'A'), N, 'push');
    });
    expect(ship(s, 'A')).toMatchObject({ pos: O, heading: N });
    expect(events).toEqual([{ type: 'ShipStopped', rule: '3.2.0', ship: 'A-ship', at: O, by: 'stuck' }]);
    place(s, 'B', neighbor(O, S), N);
    const rammed = run(s, (m) => stepShip(m, ship(s, 'B'), N, 'sail'));
    expect(rammed).toEqual([{ type: 'ShipStopped', rule: '3.2.0', ship: 'B-ship', at: neighbor(O, S), by: 'beach' }]);
    place(s, 'B', hex(2, 0));
    const acted = run(s, (m) => runActions(s, [ship(s, 'A'), ship(s, 'B')], 1, MISS, m.ctx));
    expect(acted.find((e) => e.type === 'CannonFired')).toMatchObject({ ship: 'A-ship', targets: ['B-ship'] });
  });
});

describe('home port shelter and leaving port (rules §8.2.4)', () => {
  it('in her own port there is no drift and no Gale count; a rival’s port shelters nobody', () => {
    const s = game();
    setWeather(s, 'gale', S);
    place(s, 'A', PORT_A);
    run(s, (m) => driftShip(m, ship(s, 'A')));
    expect(ship(s, 'A').pos).toEqual(PORT_A);
    place(s, 'B', PORT_A.q === -4 ? hex(-3, 0) : O);
    run(s, (m) => driftShip(m, ship(s, 'B')));
    expect(ship(s, 'B').pos).toEqual(neighbor(hex(-3, 0), S));
  });

  it('she always gets 1 hex out of port, even in a Dead Calm; the rest of her move is worked out normally', () => {
    const s = game();
    setWeather(s, 'deadCalm');
    place(s, 'A', PORT_A, NE);
    ship(s, 'A').program = { sail1: card('full') };
    run(s, (m) => moveShip(m, ship(s, 'A')));
    expect(ship(s, 'A').pos).toEqual(neighbor(PORT_A, NE));
    // Broad reach in a Firm wind is 3 at Full Sail: 1 out of port, then 2 more.
    place(s, 'A', PORT_A, NE);
    setWeather(s, 'firm', SEdir());
    run(s, (m) => moveShip(m, ship(s, 'A')));
    expect(ship(s, 'A').pos).toEqual(neighbor(neighbor(neighbor(PORT_A, NE), NE), NE));
    // Blocked on the way out: she stays in port.
    place(s, 'A', PORT_A, NE);
    place(s, 'B', neighbor(PORT_A, NE));
    ship(s, 'B').stuck = true;
    run(s, (m) => moveShip(m, ship(s, 'A')));
    expect(ship(s, 'A').pos).toEqual(PORT_A);
    expect(ship(s, 'A').galeParts).toBe(0);
  });

  it('no end-of-Part storm damage in her own port', () => {
    const g = createGame();
    let s = game(map({ [k(PORT_A)]: { terrain: 'storm' } }));
    const events: GameEvent[] = [];
    for (const p of ['A', 'B']) {
      const out = g.apply(s, p, { type: 'ready' });
      s = out.state;
      events.push(...out.events);
    }
    // The only question is whether to refit (she's in port, with room for crew); undamaged, the default is no refit.
    expect(s.pending).toMatchObject({ kind: 'refit', player: 'A' });
    let out = g.apply(s, 'A', { type: 'answer', choice: s.pending!.defaultIndex });
    events.push(...out.events);
    expect(out.state.pending).toMatchObject({ kind: 'refit', player: 'B' }); // B is in her port too
    out = g.apply(out.state, 'B', { type: 'answer', choice: out.state.pending!.defaultIndex });
    events.push(...out.events);
    expect(events.some((e) => e.type === 'DamageRolled')).toBe(false);
    expect(out.state.turn).toBe(2);
    expect(out.state.ships['A-ship']!.refitting).toBe(false);
  });
});

function SEdir(): Direction {
  return Direction.SE;
}
