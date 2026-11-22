/**
 * The game session (engineering design §11): owns the setup, the action log and the current state; applies actions through the
 * rules engine and saves after every action, so a game survives a page reload. The UI talks only to this.
 */
import { replay, type LogEntry } from '@msb/engine';
import type { AiLevel, Personality } from '@msb/msb-ai';
import { DEFAULT_CONFIG, auditGame, createGame, makeConfig, type Action, type GameEvent, type GameSetup, type GameState, type GameView } from '@msb/msb-rules';

const SAVE_KEY = 'msb-hotseat-save-v1';

/** Rule settings a game is played under, kept with the save so a later rules change can't break a game in progress. */
export interface SessionRules {
  readonly startingCrew: number;
  readonly windDrift: boolean;
}

/** Today's rules, for a new game. */
export const CURRENT_RULES: SessionRules = { startingCrew: DEFAULT_CONFIG.startingCrew, windDrift: DEFAULT_CONFIG.windDrift };
/** The rules before v0.152 (crew of 3, wind drift on): saves made then don't record their rules. */
export const LEGACY_RULES: SessionRules = { startingCrew: 3, windDrift: true };

export interface SaveFile {
  readonly setup: GameSetup;
  readonly safeEdge: boolean;
  /** Players the computer plays (engineering design §10). */
  readonly ai?: readonly string[];
  /** Each computer player's level; Normal if missing (saves from before levels existed). */
  readonly levels?: Readonly<Record<string, AiLevel>>;
  /** Each computer player's personality; balanced if missing. */
  readonly styles?: Readonly<Record<string, Personality>>;
  readonly log: readonly LogEntry<Action>[];
  /** The rule settings the game is played under; missing in saves from before v0.152 (LEGACY_RULES). */
  readonly rules?: SessionRules;
  /** What the client noticed that the rules engine can't see, e.g. the board drawing a ship somewhere else (game log). */
  readonly notes?: readonly string[];
}

export class Session {
  readonly game;
  readonly config;
  state: GameState;
  log: LogEntry<Action>[];
  notes: string[];

  constructor(
    readonly setup: GameSetup,
    readonly safeEdge: boolean,
    log: readonly LogEntry<Action>[] = [],
    readonly ai: readonly string[] = [],
    readonly levels: Readonly<Record<string, AiLevel>> = {},
    readonly styles: Readonly<Record<string, Personality>> = {},
    notes: readonly string[] = [],
    readonly rules: SessionRules = CURRENT_RULES,
  ) {
    this.notes = [...notes];
    this.config = makeConfig({ safeEdge, ...rules });
    this.game = createGame(this.config);
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
    const file: SaveFile = { setup: this.setup, safeEdge: this.safeEdge, ai: this.ai, levels: this.levels, styles: this.styles, log: this.log, notes: this.notes, rules: this.rules };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(file));
    } catch {
      /* storage full or unavailable: the game goes on unsaved */
    }
  }

  /** Record something odd the client saw, against the action it followed. */
  note(text: string): void {
    this.notes.push(`after #${this.log.length - 1} (turn ${this.state.turn}): ${text}`);
    this.save();
  }

  /**
   * The full game log as text (engineering design §11): everything needed to replay the game exactly, the problems found, and a
   * trace of every action, card, event and the ship and board state. It shows every player's hidden cards.
   */
  report(build: string, when: string, browser: string): string {
    const { trace, problems } = auditGame(this.setup, this.log, this.config);
    const file: SaveFile = { setup: this.setup, safeEdge: this.safeEdge, ai: this.ai, levels: this.levels, styles: this.styles, log: this.log, notes: this.notes, rules: this.rules };
    return [
      `Mammoth Sea Battles game log`,
      `build ${build} · exported ${when} · ${this.log.length} actions · turn ${this.state.turn} · seed ${this.setup.seed}`,
      `browser: ${browser}`,
      `Shows every player's hidden cards.`,
      ``,
      `=== PROBLEMS FOUND BY THE RULES CHECKS (${problems.length}) ===`,
      ...(problems.length ? problems : ['none']),
      ``,
      `=== NOTES FROM THE BOARD (${this.notes.length}) ===`,
      ...(this.notes.length ? this.notes : ['none']),
      ``,
      `=== TRACE ===`,
      trace,
      ``,
      `=== REPLAY DATA (JSON: the setup and every action, to rebuild the game exactly) ===`,
      JSON.stringify(file),
      ``,
    ].join('\n');
  }

  static load(): Session | undefined {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return undefined;
      const file = JSON.parse(raw) as SaveFile;
      return new Session(file.setup, file.safeEdge, file.log, file.ai ?? [], file.levels ?? {}, file.styles ?? {}, file.notes ?? [], file.rules ?? LEGACY_RULES);
    } catch {
      return undefined;
    }
  }

  static clear(): void {
    localStorage.removeItem(SAVE_KEY);
  }
}
