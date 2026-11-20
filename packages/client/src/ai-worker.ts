/**
 * The computer players' thinking, off the main thread (engineering design §10), so the board keeps moving while the AI plans
 * (the Hard level takes a second or so).
 */
import { answerDecision, programmingTurn, type AiLevel, type Personality } from '@msb/msb-ai';
import type { GameState, RulesConfig } from '@msb/msb-rules';

export interface AiRequest {
  readonly id: number;
  readonly kind: 'program' | 'answer';
  readonly state: GameState;
  readonly player: string;
  readonly config: RulesConfig;
  readonly level: AiLevel;
  readonly personality: Personality;
}

self.onmessage = (e: MessageEvent<AiRequest>) => {
  const { id, kind, state, player, config, level, personality } = e.data;
  const actions = kind === 'program' ? programmingTurn(state, player, config, { level, personality }) : [answerDecision(state, config)];
  self.postMessage({ id, actions });
};
