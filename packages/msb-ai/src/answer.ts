/**
 * The AI's answers to questions asked during a turn (engineering design §5): where to come back after sinking, which way to
 * face, where to knock treasure, whether to fire on a teammate. Anything not handled here takes the rules' default, which is
 * already sensible (damage away from a full row, wound before kill, Captain last, refit when damaged).
 */

import { distance, neighbor, type Direction, type Hex } from '@msb/hex';
import { KNOCK_LOOSE, HOLD_FIRE, RETURN_HEADING, RETURN_HEX, type Action, type GameState, type Player, type RulesConfig, type Ship, type Team } from '@msb/msb-rules';
import { distanceMap, distanceOf } from './distance';
import { goals, planningWeather } from './plan';

const best = <T>(items: readonly T[], score: (t: T) => number): number => {
  let bestIndex = 0;
  items.forEach((t, i) => {
    if (score(t) < score(items[bestIndex] as T)) bestIndex = i;
  });
  return bestIndex;
};

/** The answer to the question the game is waiting on, for the player who must answer it. */
export function answerDecision(state: GameState, config: RulesConfig): Action {
  const d = state.pending as NonNullable<GameState['pending']>;
  const options = d.options;
  const player = state.players[d.player] as Player;
  const ship = state.ships[player.ships[0] as string] as Ship;
  const home = (state.teams[player.team] as Team).homePort;
  const toGoal = () => distanceMap(state, goals(state, { ...ship, carrying: false }), planningWeather(state), config);
  switch (d.kind) {
    case HOLD_FIRE:
      // Never fire on a teammate.
      return { type: 'answer', choice: options.findIndex((o) => String(o).startsWith('hold')) };
    case KNOCK_LOOSE:
      // Always knock it loose (denies the rival a score), into the hex nearest our own port.
      return { type: 'answer', choice: 1 + best(options.slice(1) as Hex[], (h) => distance(h, home)) };
    case RETURN_HEX: {
      const dist = toGoal();
      return { type: 'answer', choice: best(options as Hex[], (h) => distanceOf(dist, h)) };
    }
    case RETURN_HEADING: {
      // Face the way that gets nearest the treasure (judged from her port: the return hex is next to it at most).
      const dist = toGoal();
      return { type: 'answer', choice: best(options as Direction[], (h) => distanceOf(dist, neighbor(home, h))) };
    }
    default:
      return { type: 'answer', choice: d.defaultIndex };
  }
}
