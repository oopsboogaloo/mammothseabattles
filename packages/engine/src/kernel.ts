/**
 * Game kernel (engineering design §4). The kernel knows nothing about ships: a game plugs in by implementing GameDef.
 *
 * A game is its setup plus its action log. `replay` rebuilds any state from those two, which gives save files,
 * replays, bug reports and deterministic tests from one mechanism (NFR-3).
 */

export type PlayerId = string;

export interface GameDef<State, Action, View, Event, Setup, Result> {
  init(setup: Setup): State;
  /** Who may act now, and what they may do. Empty for every player = game over. */
  legalActions(state: State, player: PlayerId): Action[];
  /** Pure. Throws on an illegal action. */
  apply(state: State, player: PlayerId, action: Action): { state: State; events: Event[] };
  view(state: State, player: PlayerId): View;
  result(state: State): Result | undefined;
}

export interface LogEntry<Action> {
  readonly player: PlayerId;
  readonly action: Action;
}

/** Rebuild the state reached by applying `log` to a new game made from `setup`. */
export function replay<State, Action, View, Event, Setup, Result>(
  def: GameDef<State, Action, View, Event, Setup, Result>,
  setup: Setup,
  log: readonly LogEntry<Action>[],
): { state: State; events: Event[] } {
  let state = def.init(setup);
  const events: Event[] = [];
  for (const entry of log) {
    const out = def.apply(state, entry.player, entry.action);
    state = out.state;
    events.push(...out.events);
  }
  return { state, events };
}
