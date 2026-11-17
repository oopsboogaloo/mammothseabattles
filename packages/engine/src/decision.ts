/**
 * Decisions during resolution (web-spec §3.2).
 *
 * When a rule needs a player's choice mid-resolution (hold fire, knock treasure loose, where damage goes),
 * the engine pauses with a PendingDecision. Humans, AI players and timeouts all answer through the same
 * mechanism, so resolution stays deterministic and testable.
 */

export interface PendingDecision<Option> {
  /** Stable identifier of the kind of decision, e.g. "placeShipDamage". */
  readonly kind: string;
  /** The player who must decide. */
  readonly player: string;
  /** Every legal answer. Never empty. */
  readonly options: readonly Option[];
  /** Index into `options` used when the player doesn't answer in time. */
  readonly defaultIndex: number;
  /** Seconds before the default is applied (online play). */
  readonly timeoutSeconds: number;
}

export function createDecision<Option>(
  kind: string,
  player: string,
  options: readonly Option[],
  defaultIndex = 0,
  timeoutSeconds = 60,
): PendingDecision<Option> {
  if (options.length === 0) {
    throw new Error(`Decision "${kind}" for ${player} has no options`);
  }
  if (!Number.isInteger(defaultIndex) || defaultIndex < 0 || defaultIndex >= options.length) {
    throw new RangeError(`Decision "${kind}": default index ${defaultIndex} out of range`);
  }
  return { kind, player, options, defaultIndex, timeoutSeconds };
}

/** Resolve a decision with the chosen option index, or the default if `choice` is undefined (timeout). */
export function resolveDecision<Option>(decision: PendingDecision<Option>, choice?: number): Option {
  const index = choice ?? decision.defaultIndex;
  if (!Number.isInteger(index) || index < 0 || index >= decision.options.length) {
    throw new RangeError(`Decision "${decision.kind}": choice ${index} is not a legal option`);
  }
  return decision.options[index] as Option;
}
