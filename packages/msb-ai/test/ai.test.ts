import { describe, expect, it } from 'vitest';
import { Rng, createDecision } from '@msb/engine';
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
  AI_LEVELS,
  EASY_FILL,
  BALANCED,
  HARD,
  ORDER_VALUE,
  chooseDiscards,
  handValue,
  orderValues,
  PERSONALITIES,
  STYLES,
  WEIGHTS,
  lookAhead,
  scaled,
  answerDecision,
  assignCards,
  bestIndex,
  chooseProgram,
  rankPrograms,
  sampleWorld,
  seedFor,
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
    setWeather(s, 'firm-n-1', 'gale-se');
    expect(planningWeather(s)).toEqual({ strength: 'gale', direction: 2 });
    setWeather(s, 'firm-n-1', 'new-front');
    expect(planningWeather(s)).toEqual({ strength: 'firm', direction: 0 });
    setWeather(s, 'firm-n-1', 'dead-calm');
    expect(planningWeather(s)).toEqual({ strength: 'deadCalm', direction: 0 });
  });

  it('heads for the loose treasure, or home when carrying', () => {
    const s = game();
    expect(goals(s, ship(s))).toEqual(s.treasures);
    expect(goals(s, { ...ship(s), carrying: true })).toEqual([k(s.teams['T1']!.homePort)]);
    // No treasure loose: go after a rival carrying it; none at all, nowhere to go.
    const none = clone(s);
    none.treasures = [];
    expect(goals(none, ship(none))).toEqual([]);
    ship(none, 'P2').carrying = true;
    expect(goals(none, ship(none))).toEqual([k(ship(none, 'P2').pos)]);
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
    // Played cards leave her hand (they go back in the deck at Upkeep), so next turn can't use them again.
    const card = ship(s).hand[0]!;
    expect(ship(simulate(s, 'P1-ship', { action1: card }, config).state).hand).not.toContain(card);
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
    expect(at(0, -2, () => undefined, ['P1-ship'])).toBe(base + WEIGHTS.sunk);
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
  it('finds different cards for a choice of orders when the hand allows it', () => {
    // Card a is the only first choice for both rows, but b can fill one of them.
    expect(assignCards([['a'], ['a', 'b'], undefined])).toEqual(['a', 'b', undefined]);
    expect(assignCards([['a', 'b'], ['a'], ['c']])).toEqual(['b', 'a', 'c']);
    expect(assignCards([['a'], ['a'], undefined])).toBeUndefined();
    expect(assignCards([undefined, undefined, undefined])).toEqual([undefined, undefined, undefined]);
  });

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

  it('fires on every enemy in its broadside; knocks treasure loose towards its own port', () => {
    const s = game(2);
    expect(ask(s, HOLD_FIRE, ['fire:P2-ship', 'hold:P2-ship'])).toEqual({ type: 'answer', choice: 0 });
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

describe('difficulty levels (engineering design §10)', () => {
  it('each player and turn gets its own fixed seed', () => {
    const s = game(2);
    expect(seedFor(s, 'P1')).toBe(seedFor(s, 'P1'));
    expect(seedFor(s, 'P1')).not.toBe(seedFor(s, 'P2'));
    expect(seedFor(s, 'P1') % 2).toBe(1);
    expect(seedFor({ ...s, turn: 2 }, 'P1')).not.toBe(seedFor(s, 'P1'));
  });

  it('a sampled world deals rivals plausible hands from the unseen cards and plans their programs; mine and my teammates stay as they are', () => {
    const s = game(4);
    s.players['P3']!.team = 'T1';
    ship(s, 'P3').program = { sail1: ship(s, 'P3').hand[0]! };
    ship(s, 'P4').refitting = true;
    // P2 has already programmed two cards: they leave her hand but still count as hers.
    const [c1, c2] = ship(s, 'P2').hand;
    ship(s, 'P2').program = { sail1: c1!, steer1: c2! };
    ship(s, 'P2').hand = ship(s, 'P2').hand.slice(2);
    const unseen = new Set([...s.deck, ...['P2', 'P4'].flatMap((p) => [...ship(s, p).hand, ...Object.values(ship(s, p).program)])]);
    const w = sampleWorld(s, 'P1', config, new Rng(5));
    expect(ship(w).hand).toEqual(ship(s).hand);
    expect(ship(w, 'P3').program).toEqual(ship(s, 'P3').program);
    expect(ship(w, 'P2').hand).toHaveLength(ship(s, 'P2').hand.length + 2);
    for (const p of ['P2', 'P4']) {
      for (const c of ship(w, p).hand) expect(unseen.has(c)).toBe(true);
    }
    expect(Object.values(ship(w, 'P2').program).every((c) => ship(w, 'P2').hand.includes(c))).toBe(true);
    expect(ship(w, 'P4').program).toEqual({}); // refitting: no program
    expect(w.rng).not.toBe(s.rng);
    expect(w.rng % 2).toBe(1);
  });

  it('Easy picks one of its few best plans, Normal the best, Hard the best of Normal’s plans against sampled futures; all repeatable', () => {
    const s = game(2);
    // Easy keeps Normal's Part I and fills later slots with random cards from its hand.
    const easy = chooseProgram(s, 'P1-ship', config, 'easy');
    const best = rankPrograms(s, 'P1-ship', config, 2)[0]!.program;
    expect(Object.fromEntries(Object.entries(easy).filter(([k]) => k.endsWith('1')))).toEqual(Object.fromEntries(Object.entries(best).filter(([k]) => k.endsWith('1'))));
    expect(new Set(Object.values(easy)).size).toBe(Object.values(easy).length);
    for (const c of Object.values(easy)) expect(ship(s).hand).toContain(c);
    expect(chooseProgram(s, 'P1-ship', config, 'easy')).toEqual(easy);
    // With a single card left it stops when the hand runs out.
    const thin = clone(s);
    ship(thin).hand = ship(thin).hand.slice(0, 1);
    expect(Object.keys(chooseProgram(thin, 'P1-ship', config, 'easy')).length).toBeLessThanOrEqual(1);
    expect(EASY_FILL).toBeGreaterThan(0);
    expect(chooseProgram(s, 'P1-ship', config, 'normal')).toEqual(planProgram(s, 'P1-ship', config));
    const top = rankPrograms(s, 'P1-ship', config, HARD.candidates).map((r) => r.program);
    const hard = chooseProgram(s, 'P1-ship', config, 'hard');
    expect(top).toContainEqual(hard);
    expect(chooseProgram(s, 'P1-ship', config, 'hard')).toEqual(hard);
    expect(AI_LEVELS).toEqual(['easy', 'normal', 'hard']);
    expect([bestIndex([1, 3, 2]), bestIndex([2, 2]), bestIndex([5])]).toEqual([1, 0, 0]);
  }, 60_000);

  it('a programming turn at a level is legal', () => {
    const g = createGame(config);
    let s = game(2);
    for (const a of programmingTurn(s, 'P1', config, { level: 'hard', personality: 'raider' })) s = g.apply(s, 'P1', a).state;
    expect(s.ready).toEqual(['P1']);
  }, 60_000);
});

describe('personalities and looking ahead (engineering design §10)', () => {
  it('each personality scales the standard weights its own way', () => {
    expect(PERSONALITIES).toEqual(['balanced', 'hunter', 'raider', 'cautious']);
    expect(STYLES.balanced).toBe(BALANCED);
    expect(scaled({ pickUp: 2 })).toEqual({ ...WEIGHTS, pickUp: WEIGHTS.pickUp * 2 });
    expect(STYLES.hunter.weights.pickUp).toBeGreaterThan(WEIGHTS.pickUp);
    expect(STYLES.hunter.weights.enemyHurt).toBeLessThan(WEIGHTS.enemyHurt);
    expect(STYLES.raider.weights.enemyHurt).toBeGreaterThan(WEIGHTS.enemyHurt);
    expect(STYLES.cautious.weights.slotDamaged).toBeLessThan(WEIGHTS.slotDamaged);
    expect(PERSONALITIES.filter((p) => STYLES[p].raider)).toEqual(['raider']);
  });

  it('never prefers sinking, even with nowhere to go (a hunter used to sail off the map from her own port)', () => {
    const s = game(2);
    const nowhere = distanceMap(s, [], planningWeather(s), config);
    const afloat = evaluate(s, { state: clone(s), sank: new Set() }, 'P1-ship', nowhere, {}, undefined, STYLES.hunter.weights);
    const sunk = evaluate(s, { state: clone(s), sank: new Set(['P1-ship']) }, 'P1-ship', nowhere, {}, undefined, STYLES.hunter.weights);
    expect(sunk).toBe(afloat + STYLES.hunter.weights.sunk);
  });

  it('a raider heads for a rival carrying treasure, else for treasure and rival ships alike; home when she carries it herself', () => {
    const s = game(3);
    s.players['P3']!.team = 'T1'; // a teammate isn't a target
    const rival = k(ship(s, 'P2').pos);
    expect(goals(s, ship(s), true)).toEqual([...s.treasures, rival]);
    ship(s, 'P2').carrying = true;
    expect(goals(s, ship(s), true)).toEqual([rival]);
    ship(s, 'P2').status = 'sunk';
    expect(goals(s, ship(s), true)).toEqual([...s.treasures]);
    expect(goals(s, { ...ship(s), carrying: true }, true)).toEqual([k(s.teams['T1']!.homePort)]);
  });

  it('the plan a personality picks is its own, and every personality plays legally', () => {
    const g = createGame(config);
    for (const personality of PERSONALITIES) {
      let s = game(2);
      for (const a of programmingTurn(s, 'P1', config, { beam: 1, personality })) s = g.apply(s, 'P1', a).state;
      expect(s.ready).toEqual(['P1']);
    }
    const s = game(2);
    expect(programmingTurn(s, 'P1', config, { beam: 2, personality: 'cautious' })).toEqual(programmingTurn(s, 'P1', config, { beam: 2, personality: 'cautious' }));
  }, 60_000);

  it('Hard adds part of the best next-turn score; not when she sinks or the game ends', () => {
    const s = game(1);
    const weather = planningWeather(s);
    const dist = distanceMap(s, goals(s, ship(s)), weather, config);
    const score = (world: GameState, program: Record<string, string>) => lookAhead(world, 'P1-ship', program, config, BALANCED, dist, weather);
    const now = (world: GameState, program: Record<string, string>) => evaluate(world, simulate(world, 'P1-ship', program, config), 'P1-ship', dist, program, weather);
    const next = simulate(s, 'P1-ship', {}, config).state;
    expect(score(s, {})).toBeCloseTo(now(s, {}) + HARD.lookAhead * rankPrograms(next, 'P1-ship', config, 1)[0]!.score);
    // Rowing back off the map sinks her: nothing to plan next turn.
    const row = s.setup.commandCards.find((c) => c.sail === 'rowBack')!.id;
    expect(score(s, { sail1: row })).toBe(now(s, { sail1: row }));
    // The Solo Challenge's last turn: the game is over after it.
    const last = clone(s);
    last.turn = config.soloTurns;
    expect(simulate(last, 'P1-ship', {}, config).state.phase).toBe('over');
    expect(score(last, {})).toBe(now(last, {}));
  }, 60_000);

  it('a sampled world reshuffles the rest of the deck, so looking ahead can’t foresee the next draw', () => {
    const s = game(2);
    const w = sampleWorld(s, 'P1', config, new Rng(5));
    const pool = [...s.deck, ...ship(s, 'P2').hand].sort();
    expect([...w.deck, ...ship(w, 'P2').hand].sort()).toEqual(pool);
    expect(w.deck).not.toEqual(s.deck.slice(0, w.deck.length));
  });
});

describe('discarding down to the hand limit (rules §5.1)', () => {
  const s = game(2);
  const cards = new Map(s.setup.commandCards.map((c) => [c.id, c]));
  const fresh = ship(s);

  it('values a hand by its distinct orders; a repeat is worth half the one before', () => {
    // 700: Full Sail / Ease Port / Fire; 720: Full Sail / Ease Port / Heal.
    const one = handValue(['700'], cards, ORDER_VALUE);
    expect(one).toBe(ORDER_VALUE['full']! + ORDER_VALUE['easePort']! + ORDER_VALUE['fire']!);
    expect(handValue(['700', '720'], cards, ORDER_VALUE)).toBe(one + ORDER_VALUE['full']! / 2 + ORDER_VALUE['easePort']! / 2 + ORDER_VALUE['heal']!);
  });

  it('Repair matters on a damaged ship, Heal with crew hurt, Fire to a raider', () => {
    expect(orderValues(fresh, BALANCED)).toEqual(ORDER_VALUE);
    const hurt = { ...fresh, blocked: ['sail1'], crew: fresh.crew.map((c, i) => (i === 0 ? { ...c, state: 'wounded' as const } : c)) };
    expect(orderValues(hurt, BALANCED)['repair']).toBeGreaterThan(ORDER_VALUE['repair']!);
    expect(orderValues(hurt, BALANCED)['heal']).toBeGreaterThan(ORDER_VALUE['heal']!);
    expect(orderValues(fresh, STYLES.raider)['fire']).toBe(ORDER_VALUE['fire']! * 2);
    expect(orderValues(fresh, STYLES.hunter)['fire']).toBe(ORDER_VALUE['fire']! * 0.5);
  });

  it('drops repeats before a card that brings something new, and nothing when under the limit', () => {
    // Three Full Sail / Ease Port cards and a Row Back / Hard About one: a Full Sail / Ease Port card goes.
    const hand = ['700', '720', '740', '360'];
    const out = chooseDiscards(hand, 3, fresh, cards, BALANCED);
    expect(out).toHaveLength(1);
    expect(['700', '720', '740']).toContain(out[0]);
    expect(chooseDiscards(hand, 4, fresh, cards, BALANCED)).toEqual([]);
    expect(chooseDiscards(hand, 1, fresh, cards, BALANCED)).toHaveLength(3);
  });
});
