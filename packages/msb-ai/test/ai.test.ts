import { describe, expect, it } from 'vitest';
import { createDecision } from '@msb/engine';
import { hex, hexKey, neighbor, type Direction } from '@msb/hex';
import { prototypeSetup } from '@msb/msb-data';
import {
  HOLD_FIRE,
  KNOCK_LOOSE,
  REFIT,
  RETURN_HEADING,
  RETURN_HEX,
  createGame,
  makeConfig,
  newGame,
  sailMove,
  type GameState,
  type Ship,
} from '@msb/msb-rules';
import {
  WEIGHTS,
  answerDecision,
  determinize,
  distanceMap,
  distanceOf,
  evaluate,
  goals,
  planProgram,
  planningWeather,
  programmingTurn,
  sailable,
  simulate,
  stepCost,
  type Simulation,
} from '@msb/msb-ai';

const config = makeConfig({});
const k = hexKey;
const game = (players = 2, seed = 4): GameState => newGame(prototypeSetup(Array.from({ length: players }, (_, i) => ({ name: `P${i + 1}` })), seed));
const ship = (s: GameState, p = 'P1') => s.ships[`${p}-ship`] as Ship;
const clone = (s: GameState) => JSON.parse(JSON.stringify(s)) as GameState;
/** Give the current and next weather spaces these cards. */
function setWeather(s: GameState, now: string, next: string) {
  s.weather.spaces[s.weather.now] = now;
  s.weather.spaces[(s.weather.now + 1) % 6] = next;
}

describe('sailing distance (engineering design §10)', () => {
  it('a step costs the inverse of the Full Sail move that way; into the wind it costs a tack', () => {
    const firmN = { strength: 'firm' as const, direction: 0 as Direction };
    expect(stepCost(0, firmN, config)).toBe(1 / sailMove('full', 0, firmN, config));
    expect(stepCost(3, firmN, config)).toBe(3);
  });

  it('only sea (and the tide’s water) is sailable; land, death reefs and off-map hexes are not', () => {
    const s = game();
    expect(sailable(s, '0,-3')).toBe(true);
    expect(sailable(s, '0,0')).toBe(false); // cliff
    expect(sailable(s, '3,1')).toBe(false); // death reef
    expect(sailable(s, '9,9')).toBe(false);
  });

  it('a sea goal is 0 away; a goal on land is reached from the hexes next to it; distance grows away from it', () => {
    const s = game();
    const w = { strength: 'firm' as const, direction: 0 as Direction };
    const sea = distanceMap(s, ['0,-3'], w, config);
    expect(sea.get('0,-3')).toBe(0);
    expect(distanceOf(sea, hex(0, -4))).toBeGreaterThan(0);
    expect(distanceOf(sea, hex(0, 3))).toBeGreaterThan(distanceOf(sea, hex(0, -4)));
    expect(distanceOf(sea, hex(9, 9))).toBe(99);
    const beach = distanceMap(s, ['1,-1'], w, config);
    expect(beach.has('1,-1')).toBe(false);
    expect(beach.get(k(neighbor(hex(1, -1), 0)))).toBe(0);
    // Two goals: the nearer one counts, and a goal listed twice is seeded once.
    expect(distanceMap(s, ['0,-3', '0,-3', '0,3'], w, config).get('0,3')).toBe(0);
  });
});

describe('what the AI plans for', () => {
  it('next turn’s wind if the next card is a wind, else the current one; Dead Calm has no direction', () => {
    const s = game();
    setWeather(s, 'firm-n', 'gale-se');
    expect(planningWeather(s)).toEqual({ strength: 'gale', direction: 2 });
    setWeather(s, 'firm-n', 'new-front');
    expect(planningWeather(s)).toEqual({ strength: 'firm', direction: 0 });
    setWeather(s, 'firm-n', 'dead-calm');
    expect(planningWeather(s)).toEqual({ strength: 'deadCalm', direction: 0 });
  });

  it('heads for the loose treasure, or home when carrying', () => {
    const s = game();
    expect(goals(s, ship(s))).toEqual(s.treasures);
    expect(goals(s, { ...ship(s), carrying: true })).toEqual([k(s.teams['T1']!.homePort)]);
  });

  it('plays fair: forgets rivals’ programs (not a teammate’s) and the dice to come', () => {
    const s = game(3);
    s.players['P3']!.team = 'T1';
    for (const p of ['P2', 'P3']) ship(s, p).program = { sail1: ship(s, p).hand[0]! };
    const d = determinize(s, 'P1');
    expect(ship(d, 'P2').program).toEqual({});
    expect(ship(d, 'P3').program).toEqual(ship(s, 'P3').program);
    expect(d.rng).not.toBe(s.rng);
    expect(d.rng % 2).toBe(1);
    expect(ship(s, 'P2').program).not.toEqual({}); // the real state is untouched
  });
});

describe('simulating and scoring a turn', () => {
  it('reports a ship that sank, even though she is back afloat after Upkeep', () => {
    const s = game(1);
    // West port, facing south-east: rowing back takes her off the map.
    const row = s.setup.commandCards.find((c) => c.sail === 'rowBack')!.id;
    const sim = simulate(s, 'P1-ship', { sail1: row }, config);
    expect(sim.sank.has('P1-ship')).toBe(true);
    expect(ship(sim.state).status).toBe('afloat');
    expect(ship(s).program).toEqual({}); // the input state is untouched
    expect(simulate(s, 'P1-ship', {}, config).sank.size).toBe(0);
  });

  it('weighs each thing the AI cares about', () => {
    const before = game(2);
    const dist = distanceMap(before, ['0,-3'], { strength: 'firm', direction: 0 }, config);
    const at = (q: number, r: number, change: (s: GameState) => void = () => undefined, sank: string[] = []) => {
      const after = clone(before);
      ship(after).pos = hex(q, r);
      ship(after).heading = 3;
      change(after);
      return evaluate(before, { state: after, sank: new Set(sank) } as Simulation, 'P1-ship', dist, {});
    };
    const base = at(0, -2);
    expect(at(0, -2, () => undefined, ['P1-ship'])).toBe(WEIGHTS.sunk);
    expect(at(0, -2, (s) => (s.teams['T1']!.score = 1))).toBe(base + WEIGHTS.scored);
    expect(at(0, -2, (s) => (ship(s).carrying = true))).toBe(base + WEIGHTS.pickUp);
    expect(at(0, -2, (s) => ship(s).blocked.push('sail1'))).toBe(base + WEIGHTS.slotDamaged);
    expect(at(0, -2, (s) => Object.assign(ship(s).crew[1]!, { state: 'wounded' }))).toBe(base + WEIGHTS.crewHurt);
    expect(at(0, -2, (s) => (ship(s).stuck = true))).toBe(base + WEIGHTS.stranded);
    expect(at(0, -2, (s) => (ship(s).heading = 0))).toBe(base + WEIGHTS.facingGoal);
    expect(at(0, -2, (s) => ship(s, 'P2').blocked.push('sail1'))).toBe(base + WEIGHTS.enemyHurt);
    expect(at(0, -2, () => undefined, ['P2-ship'])).toBe(base + WEIGHTS.enemySunk);
    expect(at(0, -2) - at(0, -1)).toBe(WEIGHTS.perDistance * (distanceOf(dist, hex(0, -2)) - distanceOf(dist, hex(0, -1))));
    // Rough water and storms hurt at the end of the next Part.
    expect(at(-2, -1)).toBeLessThan(at(-1, -1));
    // A teammate's damage isn't a gain.
    before.players['P2']!.team = 'T1';
    expect(at(0, -2, (s) => ship(s, 'P2').blocked.push('sail1'))).toBe(at(0, -2));
    before.players['P2']!.team = 'T2';
    // Dropping treasure without scoring is a loss.
    ship(before).carrying = true;
    expect(at(0, -2, (s) => (ship(s).carrying = false)) - at(0, -2)).toBe(WEIGHTS.loseTreasure);
    ship(before).carrying = false;
    // Every card used costs a little, so a plan doesn't throw cards away.
    const after = clone(before);
    ship(after).pos = hex(0, -2);
    ship(after).heading = 3;
    expect(evaluate(before, { state: after, sank: new Set() }, 'P1-ship', dist, { sail1: 'x' }) - base).toBe(WEIGHTS.cardUsed);
  });

  it('fears the map edge, and most of all being left where next turn’s wind will drift her off; but not in her own port', () => {
    const before = game(2);
    const dist = distanceMap(before, ['0,-3'], { strength: 'firm', direction: 0 }, config);
    const score = (q: number, r: number, wind: Direction, strength: 'firm' | 'light' = 'firm') => {
      const after = clone(before);
      ship(after).pos = hex(q, r);
      ship(after).heading = 3;
      return evaluate(before, { state: after, sank: new Set() }, 'P1-ship', dist, {}, { strength, direction: wind });
    };
    const rim = hex(0, -5); // the north rim (P3's port in bigger games; not a port here)
    const inside = score(0, -4, 0);
    expect(score(rim.q, rim.r, 3)).toBeLessThan(inside); // on the edge
    expect(score(rim.q, rim.r, 0)).toBe(score(rim.q, rim.r, 3) + WEIGHTS.driftOffMap); // wind blows her off
    expect(score(rim.q, rim.r, 0, 'light')).toBe(score(rim.q, rim.r, 3)); // no drift in a Light wind
    const port = before.teams['T1']!.homePort;
    expect(score(port.q, port.r, 5)).toBe(score(port.q, port.r, 2)); // sheltered in port
  });
});

describe('planning a program (Basic AI)', () => {
  it('never sails off the map when it can help it, and leaves damaged slots empty', () => {
    const s = game(1);
    const plan = planProgram(s, 'P1-ship', config);
    expect(simulate(determinize(s, 'P1'), 'P1-ship', plan, config).sank.size).toBe(0);
    const cards = Object.values(plan);
    expect(new Set(cards).size).toBe(cards.length);
    for (const c of cards) expect(ship(s).hand).toContain(c);
    ship(s).blocked = ['sail1', 'steer1', 'action1'];
    const blocked = planProgram(s, 'P1-ship', config);
    expect(Object.keys(blocked).some((slot) => slot.endsWith('1'))).toBe(false);
  });

  it('programs, discards down to the hand limit and readies; skips sunk and refitting ships; every action is legal', () => {
    const g = createGame(config);
    let s = game(2);
    ship(s).hand.push(...s.deck.splice(0, 12));
    ship(s, 'P2').status = 'sunk';
    const mine = programmingTurn(s, 'P1', config);
    expect(mine.at(-1)).toEqual({ type: 'ready' });
    expect(mine.filter((a) => a.type === 'discard').length).toBeGreaterThan(0);
    for (const a of mine) s = g.apply(s, 'P1', a).state;
    expect(ship(s).hand.length).toBeLessThanOrEqual(config.handLimit);
    expect(programmingTurn(s, 'P2', config)).toEqual([{ type: 'ready' }]);
    const t = game(2);
    ship(t, 'P2').refitting = true;
    expect(programmingTurn(t, 'P2', config)).toEqual([{ type: 'ready' }]);
  });
});

describe('answering questions mid-turn', () => {
  const ask = (s: GameState, kind: string, options: unknown[], def = 0) => {
    s.pending = createDecision(kind, 'P1', options, def);
    return answerDecision(s, config);
  };

  it('never fires on a teammate; knocks treasure loose towards its own port', () => {
    const s = game(2);
    expect(ask(s, HOLD_FIRE, ['fire:P2-ship', 'hold:P2-ship'])).toEqual({ type: 'answer', choice: 1 });
    const home = s.teams['T1']!.homePort;
    expect(ask(s, KNOCK_LOOSE, ['damage', hex(4, 0), neighbor(home, 1)])).toEqual({ type: 'answer', choice: 2 });
  });

  it('comes back nearest the treasure, facing it; leaves the rest to the rules’ defaults', () => {
    const s = game(1);
    s.treasures = ['-3,2'];
    const options = [hex(-5, 1), hex(-4, 1), hex(-4, 0)];
    const choice = (ask(s, RETURN_HEX, options) as { choice: number }).choice;
    const dist = distanceMap(s, s.treasures, planningWeather(s), config);
    for (const o of options) expect(distanceOf(dist, options[choice]!)).toBeLessThanOrEqual(distanceOf(dist, o));
    const heading = (ask(s, RETURN_HEADING, [0, 1, 2, 3, 4, 5], 2) as { choice: number }).choice;
    expect(heading).toBeGreaterThanOrEqual(0);
    expect(ask(s, REFIT, ['a', 'b', 'c'], 2)).toEqual({ type: 'answer', choice: 2 });
  });
});

describe('whole games', () => {
  /** Play AI against the board or itself; every action is checked legal by the engine. */
  function play(players: number, seed: number, maxTurns: number) {
    const g = createGame(config);
    let s = game(players, seed);
    const log: string[] = [];
    while (s.phase !== 'over' && s.turn <= maxTurns) {
      if (s.phase === 'programming') {
        for (const p of Object.keys(s.players)) {
          if (s.ready.includes(p) || s.phase !== 'programming') continue;
          for (const a of programmingTurn(s, p, config)) (s = g.apply(s, p, a).state), log.push(JSON.stringify(a));
        }
      } else {
        const a = answerDecision(s, config);
        s = g.apply(s, (s.pending as { player: string }).player, a).state;
        log.push(JSON.stringify(a));
      }
    }
    return { s, log };
  }

  it('Solo Challenge: the AI brings treasure home, and plays the same game twice from the same seed', () => {
    const a = play(1, 3, 14);
    expect(a.s.phase).toBe('over');
    expect(a.s.teams['T1']!.score).toBeGreaterThanOrEqual(1);
    expect(play(1, 3, 14).log).toEqual(a.log);
  }, 60_000);

  it('two AIs play a game through', () => {
    const { s } = play(2, 6, 30);
    expect(Object.values(s.teams).reduce((n, t) => n + t.score, 0)).toBeGreaterThanOrEqual(1);
  }, 120_000);
});
