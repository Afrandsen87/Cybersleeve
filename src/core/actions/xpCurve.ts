/**
 * @module core
 *
 * The level curve of one experience track as the player pays it, for explaining it.
 *
 * @remarks
 * Called by: `Progression.actionXpCurve` / `sleeveXpCurve`, `ui/view/xpTipView.ts` through the engine. Pure type.
 */
import type { BigNum } from '../../numbers';

/** Leaving level `n` costs `firstLevelXp x growthFactor^max(0, n - delay) x (1 - reduction)`. */
export interface XpCurve {
  /** What the first level costs, before any delay or reduction. */
  readonly firstLevelXp: BigNum;
  /** How much more each further level costs. */
  readonly growthFactor: number;
  /** Levels the growth is delayed by (Skill shards; 0 for sleeve levels). */
  readonly delay: number;
  /** Share of every level's cost that is taken off, 0..1. */
  readonly reduction: number;
}
