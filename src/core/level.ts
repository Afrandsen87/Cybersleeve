/**
 * @module core
 *
 * The experience -> level rule, configurable per track (each action and the sleeve).
 *
 * @remarks
 * Levels start at 0 and a level is the number of level-ups gained. Every level costs its own full amount of experience: going from
 * level 0 to 1 takes `firstLevelXp`, from 1 to 2 takes `firstLevelXp * growthFactor`, from 2 to 3 `firstLevelXp * growthFactor^2`,
 * and so on. The experience a track has is
 * stored as one running total; what is "left over" in the current level is derived from it ({@link LevelRule.xpIntoLevel}),
 * so batching runs in closed form never has to carry a remainder across a level-up.
 */
import type { BigNum, NumberFactory } from '../numbers';
import type { LevelRuleConfig } from './types';

/** Tolerance when turning a floating-point logarithm into a level index. */
const LOG_EPSILON = 1e-9;

/** Up to this many levels the total is summed level by level (exact for whole costs); beyond it the closed form is used. */
const EXACT_SUM_LEVELS = 64;

/**
 * Relative slack when comparing experience with a threshold. Thresholds are sums of powers computed with ~15 significant
 * digits, so a total that is exactly on a boundary must not fall a rounding error short of it.
 */
const THRESHOLD_SLACK = 1e-12;

/** Level rule for one experience track. */
export class LevelRule {
  private readonly first: BigNum;
  private readonly growth: BigNum;
  private readonly growthLessOne: BigNum;
  private readonly one: BigNum;
  private readonly zero: BigNum;
  private readonly slack: BigNum;
  private readonly logGrowth: number;
  /** `exactCosts[i]` is the cost of leaving level `i`, `exactTotals[n]` the total of the first `n` levels; both have the same length and grow on demand up to {@link EXACT_SUM_LEVELS}. */
  private readonly exactCosts: BigNum[];
  private readonly exactTotals: BigNum[];
  /** The last lookup of {@link LevelRule.levelForXp}: the screen asks about the same XP many times per refresh. */
  private lastXp: BigNum | null = null;
  private lastLevel = 0;

  /**
   * Creates a rule from its configuration.
   *
   * Called by: `Progression`, tests.
   *
   * @param config what the first level costs (`firstLevelXp > 0`) and how much more each further level costs (`growthFactor > 1`)
   * @param factory number factory
   */
  constructor(config: LevelRuleConfig, factory: NumberFactory) {
    this.first = factory.fromNumber(config.firstLevelXp);
    this.growth = factory.fromNumber(config.growthFactor);
    this.one = factory.fromNumber(1);
    this.zero = factory.fromNumber(0);
    this.growthLessOne = this.growth.sub(this.one);
    this.slack = factory.fromNumber(1 - THRESHOLD_SLACK);
    this.logGrowth = this.growth.log10();
    this.exactCosts = [this.first];
    this.exactTotals = [this.zero];
  }

  /**
   * Level for an amount of experience.
   *
   * @remarks
   * Levels start at 0. The experience needed to reach level `n + 1` in total is {@link LevelRule.xpForNextLevel}`(n)`. The
   * floating-point estimate is corrected against exact thresholds, so boundaries are exact for any configuration and valid
   * far beyond the double range.
   *
   * @param xp total experience (>= 0)
   * @returns level, an integer >= 0 (`Number.MAX_SAFE_INTEGER` for non-finite XP)
   */
  levelForXp(xp: BigNum): number {
    if (!xp.isFinite()) return Number.MAX_SAFE_INTEGER;
    if (this.lastXp?.eq(xp)) return this.lastLevel;
    // levels gained n satisfy first * (g^n - 1) / (g - 1) <= xp, so n = floor(log_g(xp * (g - 1) / first + 1)).
    const estimate = xp.mul(this.growthLessOne).div(this.first).add(this.one).log10() / this.logGrowth;
    let gained = Math.max(0, Math.floor(estimate + LOG_EPSILON));
    while (gained > 0 && !this.reached(xp, this.totalFor(gained))) gained--;
    while (this.reached(xp, this.totalFor(gained + 1))) gained++;
    this.lastXp = xp;
    this.lastLevel = gained;
    return gained;
  }

  /**
   * Total experience at which `level + 1` is reached.
   *
   * @param level current level (integer >= 0)
   * @returns the sum of the costs of levels 0 to `level`: `firstLevelXp * (growthFactor^(level + 1) - 1) / (growthFactor - 1)`
   */
  xpForNextLevel(level: number): BigNum {
    return this.totalFor(level + 1);
  }

  /**
   * Experience that going from `level` to `level + 1` costs on its own.
   *
   * @param level the level being left (integer >= 0)
   * @returns `firstLevelXp * growthFactor^level`
   */
  xpCostOfLevel(level: number): BigNum {
    return this.first.mul(this.growth.pow(level));
  }

  /**
   * Experience gathered inside the current level: what is left of the running total once the earlier levels are paid for.
   *
   * Called by: `Progression`.
   *
   * @param xp total experience (>= 0)
   * @returns a value from 0 up to (not including) {@link LevelRule.xpCostOfLevel} of the current level
   */
  xpIntoLevel(xp: BigNum): BigNum {
    if (!xp.isFinite()) return this.xpCostOfLevel(this.levelForXp(xp));
    const start = this.totalFor(this.levelForXp(xp));
    const into = xp.sub(start);
    return into.isNegative() ? this.zero : into;
  }

  /**
   * How far through the current level an amount of experience is.
   *
   * Called by: `Progression`.
   *
   * @param xp total experience (>= 0)
   * @returns a fraction in [0, 1]: `xpIntoLevel / xpCostOfLevel`. Non-finite XP gives 1.
   */
  progressFraction(xp: BigNum): number {
    if (!xp.isFinite()) return 1;
    const level = this.levelForXp(xp);
    const fraction = this.xpIntoLevel(xp).div(this.xpCostOfLevel(level)).toNumber();
    return Number.isFinite(fraction) ? Math.min(1, Math.max(0, fraction)) : 0;
  }

  /**
   * The total experience of `gained` complete levels (0 for none): the sum of their costs. Summed one level at a time while
   * that is cheap, so whole costs give whole totals (110, not 110.00000000000001); beyond that the closed form
   * `first * (g^gained - 1) / (g - 1)` is used, where 15 significant digits are all anyone can see anyway.
   * The exact totals are computed once and kept: they depend on the configuration only.
   */
  private totalFor(gained: number): BigNum {
    if (gained <= 0) return this.zero;
    if (gained > EXACT_SUM_LEVELS) return this.first.mul(this.growth.pow(gained).sub(this.one)).div(this.growthLessOne);
    while (this.exactTotals.length <= gained) {
      const n = this.exactTotals.length;
      this.exactTotals.push(this.exactTotals[n - 1]!.add(this.exactCosts[n - 1]!));
      this.exactCosts.push(this.exactCosts[n - 1]!.mul(this.growth));
    }
    return this.exactTotals[gained]!;
  }

  /** True when `xp` has reached `threshold`, allowing for rounding in the threshold. */
  private reached(xp: BigNum, threshold: BigNum): boolean {
    return xp.gte(threshold.mul(this.slack));
  }
}
