/**
 * @module core
 *
 * The experience -> level rule, configurable per track (each action and the sleeve).
 */
import type { BigNum, NumberFactory } from '../numbers';
import type { LevelRuleConfig } from './types';

/** Tolerance when turning a floating-point logarithm into a level index. */
const LOG_EPSILON = 1e-9;

/** Level rule for one experience track. */
export class LevelRule {
  private readonly first: BigNum;
  private readonly growth: BigNum;
  private readonly logFirst: number;
  private readonly logGrowth: number;

  /**
   * Creates a rule from its configuration.
   *
   * Called by: `Progression`, tests.
   *
   * @param config thresholds (`firstLevelXp > 0`, `growthFactor > 1`)
   * @param factory number factory
   */
  constructor(
    config: LevelRuleConfig,
    private readonly factory: NumberFactory,
  ) {
    this.first = factory.fromNumber(config.firstLevelXp);
    this.growth = factory.fromNumber(config.growthFactor);
    this.logFirst = this.first.log10();
    this.logGrowth = this.growth.log10();
  }

  /**
   * Level for an amount of experience.
   *
   * @remarks
   * Levels start at 1 (XP below `firstLevelXp`). Reaching `firstLevelXp` gives 2, and each further level
   * needs `growthFactor` times more. The floating-point estimate is corrected against exact thresholds,
   * so boundaries are exact for any configuration and valid far beyond the double range.
   *
   * @param xp total experience (>= 0)
   * @returns level, an integer >= 1 (`Number.MAX_SAFE_INTEGER` for non-finite XP)
   */
  levelForXp(xp: BigNum): number {
    if (!xp.isFinite()) return Number.MAX_SAFE_INTEGER;
    if (xp.lt(this.first)) return 1;
    let k = Math.floor((xp.log10() - this.logFirst) / this.logGrowth + LOG_EPSILON);
    if (k < 0) k = 0;
    while (k > 0 && xp.lt(this.thresholdAfter(k))) k--;
    while (xp.gte(this.thresholdAfter(k + 1))) k++;
    return 2 + k;
  }

  /**
   * Total experience at which `level + 1` is reached.
   *
   * @param level current level (integer >= 1)
   * @returns the XP threshold of the next level: `firstLevelXp * growthFactor^(level - 1)`
   */
  xpForNextLevel(level: number): BigNum {
    return this.thresholdAfter(level - 1);
  }

  /**
   * How far through the current level an amount of experience is.
   *
   * Called by: `Progression`.
   *
   * @param xp total experience (>= 0)
   * @returns a fraction in [0, 1]: `(xp - levelStart) / (nextLevel - levelStart)`, where level 1 starts at 0.
   *   Non-finite XP gives 1.
   */
  progressFraction(xp: BigNum): number {
    if (!xp.isFinite()) return 1;
    const level = this.levelForXp(xp);
    const start = level <= 1 ? this.factory.fromNumber(0) : this.xpForNextLevel(level - 1);
    const span = this.xpForNextLevel(level).sub(start);
    const fraction = xp.sub(start).div(span).toNumber();
    return Number.isFinite(fraction) ? Math.min(1, Math.max(0, fraction)) : 0;
  }

  /** `first * growth^k`: the threshold of level `k + 2`. */
  private thresholdAfter(k: number): BigNum {
    return this.first.mul(this.growth.pow(k));
  }
}
