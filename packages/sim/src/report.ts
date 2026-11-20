/**
 * Turning many game reports into numbers a designer can read: averages, spreads, win rates by seat, and a Markdown table that
 * compares rule variants side by side.
 */

import { runGame, type GameOptions, type GameReport } from './run';

export interface Summary {
  readonly name: string;
  readonly games: number;
  readonly players: number;
  /** Share of games that ended (a winner, or the Solo Challenge's last turn) before the turn limit. */
  readonly finishedRate: number;
  readonly turns: Spread;
  /** Treasure brought home per seat per game (the Solo Challenge score with one player). */
  readonly score: Spread;
  /** Share of finished games each seat won (seat 1 first). Empty for the Solo Challenge. */
  readonly winRateBySeat: readonly number[];
  /** Per game, on average. */
  readonly sinkingsPerGame: Readonly<Record<string, number>>;
  readonly damagePerGame: Readonly<Record<string, number>>;
  readonly perGame: Readonly<Record<'cannonHits' | 'rams' | 'treasuresPickedUp' | 'treasuresKnockedLoose' | 'whirlpools' | 'caves' | 'strandings', number>>;
}

export interface Spread {
  readonly mean: number;
  readonly min: number;
  readonly max: number;
}

export function spread(values: readonly number[]): Spread {
  if (values.length === 0) return { mean: 0, min: 0, max: 0 };
  return { mean: values.reduce((a, b) => a + b, 0) / values.length, min: Math.min(...values), max: Math.max(...values) };
}

const perGame = (reports: readonly GameReport[], pick: (r: GameReport) => Readonly<Record<string, number>>) => {
  const total: Record<string, number> = {};
  for (const r of reports) for (const [k, v] of Object.entries(pick(r))) total[k] = (total[k] ?? 0) + v;
  return Object.fromEntries(Object.entries(total).map(([k, v]) => [k, v / reports.length]));
};

export function summarize(name: string, reports: readonly GameReport[]): Summary {
  const players = reports[0]?.players ?? 0;
  const finished = reports.filter((r) => r.finished);
  const won = finished.filter((r) => r.winner !== undefined);
  const mean = (pick: (r: GameReport) => number) => (reports.length ? reports.reduce((n, r) => n + pick(r), 0) / reports.length : 0);
  return {
    name,
    games: reports.length,
    players,
    finishedRate: reports.length ? finished.length / reports.length : 0,
    turns: spread(reports.map((r) => r.turns)),
    score: spread(reports.flatMap((r) => r.scores)),
    winRateBySeat: players > 1 ? Array.from({ length: players }, (_, i) => (won.length ? won.filter((r) => r.winner === i + 1).length / won.length : 0)) : [],
    sinkingsPerGame: perGame(reports, (r) => r.sinkings),
    damagePerGame: perGame(reports, (r) => r.damageBySource),
    perGame: {
      cannonHits: mean((r) => r.cannonHits),
      rams: mean((r) => r.rams),
      treasuresPickedUp: mean((r) => r.treasuresPickedUp),
      treasuresKnockedLoose: mean((r) => r.treasuresKnockedLoose),
      whirlpools: mean((r) => r.whirlpools),
      caves: mean((r) => r.caves),
      strandings: mean((r) => r.strandings),
    },
  };
}

export interface Variant {
  readonly name: string;
  readonly rules?: GameOptions['rules'];
}

export interface ExperimentOptions {
  readonly players: number;
  readonly games: number;
  /** Game i of every variant uses seed `firstSeed + i`, so variants are compared on the same deals. */
  readonly firstSeed?: number;
  readonly maxTurns?: number;
  readonly beam?: number;
  /** Difficulty level for each seat in turn; when given, it replaces `beam`. */
  readonly levels?: GameOptions['levels'];
  /** Called after each game (for progress output). */
  readonly onGame?: (variant: string, report: GameReport) => void;
}

/** Play the same games under each variant of the rules. */
export function runExperiment(variants: readonly Variant[], options: ExperimentOptions): Summary[] {
  return variants.map((v) => {
    const reports = Array.from({ length: options.games }, (_, i) => {
      const report = runGame({
        players: options.players,
        seed: (options.firstSeed ?? 1) + i,
        ...(v.rules ? { rules: v.rules } : {}),
        ...(options.maxTurns === undefined ? {} : { maxTurns: options.maxTurns }),
        ...(options.beam === undefined ? {} : { beam: options.beam }),
        ...(options.levels ? { levels: options.levels } : {}),
      });
      options.onGame?.(v.name, report);
      return report;
    });
    return summarize(v.name, reports);
  });
}

const f1 = (n: number) => (Math.round(n * 10) / 10).toString();
const pct = (n: number) => `${Math.round(n * 100)}%`;
const range = (s: Spread) => `${f1(s.mean)} (${s.min}–${s.max})`;

/** A Markdown table comparing the variants, one column each. */
export function formatTable(summaries: readonly Summary[]): string {
  const keys = (pick: (s: Summary) => Readonly<Record<string, number>>) => [...new Set(summaries.flatMap((s) => Object.keys(pick(s))))].sort();
  const rows: [string, (s: Summary) => string][] = [
    ['Games', (s) => String(s.games)],
    ['Finished before the turn limit', (s) => pct(s.finishedRate)],
    ['Turns per game, mean (min–max)', (s) => range(s.turns)],
    [summaries[0]?.players === 1 ? 'Solo score (treasure in the turn limit)' : 'Treasure home per ship', (s) => range(s.score)],
  ];
  const seats = Math.max(0, ...summaries.map((s) => s.winRateBySeat.length));
  for (let i = 0; i < seats; i++) rows.push([`Wins, seat ${i + 1}`, (s) => (s.winRateBySeat[i] === undefined ? '—' : pct(s.winRateBySeat[i]!))]);
  for (const k of keys((s) => s.sinkingsPerGame)) rows.push([`Sinkings per game: ${k}`, (s) => f1(s.sinkingsPerGame[k] ?? 0)]);
  for (const k of keys((s) => s.damagePerGame)) rows.push([`Times damaged per game: ${k}`, (s) => f1(s.damagePerGame[k] ?? 0)]);
  for (const k of Object.keys(summaries[0]?.perGame ?? {}) as (keyof Summary['perGame'])[]) rows.push([`${k} per game`, (s) => f1(s.perGame[k])]);
  const head = `| | ${summaries.map((s) => s.name).join(' | ')} |\n|---|${summaries.map(() => '---').join('|')}|`;
  return [head, ...rows.map(([label, cell]) => `| ${label} | ${summaries.map(cell).join(' | ')} |`)].join('\n');
}
