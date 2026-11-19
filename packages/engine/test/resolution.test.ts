import { describe, expect, it } from 'vitest';
import {
  answerResolution,
  cloneJson,
  createDecision,
  replay,
  runResolution,
  startResolution,
  type GameDef,
  type ResolutionScript,
} from '@msb/engine';

interface Counter {
  total: number;
}

// A script that asks two questions, emitting an event before each and one at the end.
const script: ResolutionScript<Counter, string> = (state, ctx) => {
  ctx.emit('start');
  state.total += ctx.ask(createDecision('first', 'p1', [1, 10]));
  ctx.emit('after first');
  state.total += ctx.ask(createDecision('only one', 'p1', [100]));
  state.total += ctx.ask(createDecision('second', 'p2', [1000, 2000], 1));
  ctx.emit('end');
  return state;
};

describe('re-run resolution (engineering design §5, D1)', () => {
  it('stops at the first question with no answer', () => {
    const out = runResolution(startResolution({ total: 0 }), script);
    expect(out.kind).toBe('paused');
    if (out.kind !== 'paused') return;
    expect(out.decision.kind).toBe('first');
    expect(out.events).toEqual(['start']);
  });

  it('resumes from the snapshot, answers one-option questions itself, and returns each event once', () => {
    const first = runResolution(startResolution({ total: 0 }), script);
    if (first.kind !== 'paused') throw new Error('expected a pause');
    const second = answerResolution(first.record, 1, script);
    if (second.kind !== 'paused') throw new Error('expected a pause');
    expect(second.decision.kind).toBe('second');
    expect(second.events).toEqual(['after first']);
    const done = answerResolution(second.record, 0, script);
    expect(done).toEqual({ kind: 'done', state: { total: 1110 }, events: ['end'] });
  });

  it('never changes the snapshot', () => {
    const record = startResolution({ total: 5 });
    runResolution({ ...record, answers: [0, 0] }, script);
    expect(record.snapshot).toEqual({ total: 5 });
  });

  it('rejects an answer that is not a legal option', () => {
    expect(() => runResolution({ ...startResolution({ total: 0 }), answers: [2] }, script)).toThrow(RangeError);
    expect(() => runResolution({ ...startResolution({ total: 0 }), answers: [0.5] }, script)).toThrow(RangeError);
  });

  it('passes other errors through', () => {
    const broken: ResolutionScript<Counter, string> = () => {
      throw new Error('rule bug');
    };
    expect(() => runResolution(startResolution({ total: 0 }), broken)).toThrow('rule bug');
  });

  it('copies plain JSON deeply', () => {
    const a = { x: [1, { y: 2 }] };
    const b = cloneJson(a);
    expect(b).toEqual(a);
    expect(b.x).not.toBe(a.x);
  });
});

describe('kernel replay (engineering design §4)', () => {
  const def: GameDef<number, number, number, string, number, string> = {
    init: (start) => start,
    legalActions: () => [1, 2],
    apply: (state, player, action) => ({ state: state + action, events: [`${player}+${action}`] }),
    view: (state) => state,
    result: (state) => (state > 10 ? 'over' : undefined),
  };

  it('rebuilds a state from the setup and the action log', () => {
    const out = replay(def, 3, [
      { player: 'a', action: 2 },
      { player: 'b', action: 1 },
    ]);
    expect(out).toEqual({ state: 6, events: ['a+2', 'b+1'] });
    expect(def.legalActions(out.state, 'a')).toEqual([1, 2]);
    expect(def.view(out.state, 'a')).toBe(6);
    expect(def.result(out.state)).toBeUndefined();
    expect(def.result(11)).toBe('over');
  });
});
