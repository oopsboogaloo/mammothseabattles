/**
 * The game session (engineering design §11): owns the setup, the action log and the current state; applies actions through the
 * rules engine and saves after every action, so a game survives a page reload. The UI talks only to this.
 */
import { replay, type LogEntry } from '@msb/engine';
import { createGame, makeConfig, type Action, type GameEvent, type GameSetup, type GameState, type GameView } from '@msb/msb-rules';

const SAVE_KEY = 'msb-hotseat-save-v1';

export interface SaveFile {
  readonly setup: GameSetup;
  readonly safeEdge: boolean;
  readonly log: readonly LogEntry<Action>[];
}

export class Session {
  readonly game;
  state: GameState;
  log: LogEntry<Action>[];

  constructor(readonly setup: GameSetup, readonly safeEdge: boolean, log: readonly LogEntry<Action>[] = []) {
    this.game = createGame(makeConfig({ safeEdge }));
    this.log = [...log];
    this.state = replay(this.game, setup, this.log).state;
  }

  /** Apply one action and return the events it produced. */
  apply(player: string, action: Action): GameEvent[] {
    const out = this.game.apply(this.state, player, action);
    this.state = out.state;
    this.log.push({ player, action });
    this.save();
    return out.events;
  }

  view(player: string): GameView {
    return this.game.view(this.state, player);
  }

  legal(player: string): Action[] {
    return this.game.legalActions(this.state, player);
  }

  save(): void {
    const file: SaveFile = { setup: this.setup, safeEdge: this.safeEdge, log: this.log };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(file));
    } catch {
      /* storage full or unavailable: the game goes on unsaved */
    }
  }

  static load(): Session | undefined {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return undefined;
      const file = JSON.parse(raw) as SaveFile;
      return new Session(file.setup, file.safeEdge, file.log);
    } catch {
      return undefined;
    }
  }

  static clear(): void {
    localStorage.removeItem(SAVE_KEY);
  }
}
