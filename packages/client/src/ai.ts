/** Ask the computer for its actions: in a Web Worker when the browser has one, else on the main thread. */
import { answerDecision, programmingTurn, type AiLevel } from '@msb/msb-ai';
import type { Action, GameState, RulesConfig } from '@msb/msb-rules';
import type { AiRequest } from './ai-worker';

let worker: Worker | null = null;
let nextId = 1;
const waiting = new Map<number, (actions: Action[]) => void>();

function getWorker(): Worker | null {
  if (worker) return worker;
  try {
    worker = new Worker(new URL('./ai-worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<{ id: number; actions: Action[] }>) => {
      waiting.get(e.data.id)?.(e.data.actions);
      waiting.delete(e.data.id);
    };
    return worker;
  } catch {
    return null;
  }
}

export function askAi(kind: AiRequest['kind'], state: GameState, player: string, config: RulesConfig, level: AiLevel): Promise<Action[]> {
  const w = getWorker();
  if (!w) return Promise.resolve(kind === 'program' ? programmingTurn(state, player, config, undefined, level) : [answerDecision(state, config)]);
  const id = nextId++;
  return new Promise((resolve) => {
    waiting.set(id, resolve);
    w.postMessage({ id, kind, state, player, config, level } satisfies AiRequest);
  });
}
