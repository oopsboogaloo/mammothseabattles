/**
 * Resolution that can stop to ask a player, then resume (engineering design §5, decision D1: re-run from the snapshot).
 *
 * Resolution is written as ordinary straight-line code that calls `ctx.ask(decision)` when a rule needs a choice.
 * The record keeps a snapshot of the state when resolution started and the answers given so far.
 * Each run starts again from the snapshot and replays the recorded answers; when it reaches a question with no
 * answer yet, it stops and reports that decision. Because the RNG lives in the state and the answers are fixed,
 * every run follows exactly the same path and gets one question further.
 *
 * Only the events after the previous stopping point are returned, so callers see each event once.
 */

import type { PendingDecision } from './decision';

export interface ResolutionRecord<State> {
  /** The state when resolution started. Plain JSON. */
  readonly snapshot: State;
  /** Chosen option index for each question asked so far, in order. */
  readonly answers: readonly number[];
  /** Number of events already returned to callers by earlier runs. */
  readonly emitted: number;
}

export interface ResolutionContext<Event> {
  /** Ask a question. Questions with one option are answered without asking and use no answer slot. */
  ask<Option>(decision: PendingDecision<Option>): Option;
  emit(event: Event): void;
}

/**
 * A resolution script: takes a private copy of the snapshot and returns the resolved state.
 * Scripts should change that copy in place, so a paused run can report how far the turn got (`partial`).
 */
export type ResolutionScript<State, Event> = (state: State, ctx: ResolutionContext<Event>) => State;

export type ResolutionOutcome<State, Event> =
  | { readonly kind: 'done'; readonly state: State; readonly events: Event[] }
  | {
      readonly kind: 'paused';
      readonly decision: PendingDecision<unknown>;
      readonly record: ResolutionRecord<State>;
      readonly events: Event[];
      /** The script's working copy at the moment it stopped: the state part-way through resolution. */
      readonly partial: State;
    };

class Pause {
  constructor(readonly decision: PendingDecision<unknown>) {}
}

export function startResolution<State>(snapshot: State): ResolutionRecord<State> {
  return { snapshot, answers: [], emitted: 0 };
}

/** Deep copy of plain JSON data, so a script can never change the snapshot. */
export function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function runResolution<State, Event>(
  record: ResolutionRecord<State>,
  script: ResolutionScript<State, Event>,
): ResolutionOutcome<State, Event> {
  const events: Event[] = [];
  let next = 0;
  const ctx: ResolutionContext<Event> = {
    ask<Option>(decision: PendingDecision<Option>): Option {
      if (decision.options.length === 1) return decision.options[0] as Option;
      if (next < record.answers.length) {
        const index = record.answers[next++] as number;
        if (!Number.isInteger(index) || index < 0 || index >= decision.options.length) {
          throw new RangeError(`Answer ${index} is not a legal option for "${decision.kind}"`);
        }
        return decision.options[index] as Option;
      }
      throw new Pause(decision);
    },
    emit(event: Event): void {
      events.push(event);
    },
  };
  const draft = cloneJson(record.snapshot);
  try {
    const state = script(draft, ctx);
    return { kind: 'done', state, events: events.slice(record.emitted) };
  } catch (e) {
    if (!(e instanceof Pause)) throw e;
    return {
      kind: 'paused',
      decision: e.decision,
      record: { ...record, emitted: events.length },
      events: events.slice(record.emitted),
      partial: draft,
    };
  }
}

/** Record an answer (an option index) and run again. */
export function answerResolution<State, Event>(
  record: ResolutionRecord<State>,
  choice: number,
  script: ResolutionScript<State, Event>,
): ResolutionOutcome<State, Event> {
  return runResolution({ ...record, answers: [...record.answers, choice] }, script);
}
