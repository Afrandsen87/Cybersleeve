/**
 * @module core
 *
 * Experience bookkeeping: per-action XP/levels and per-action sleeve XP/levels. The reduction buyables live in `xpReductions.ts` and the
 * run counting in `sleeveXp.ts`; this is the facade the rest of the game imports.
 */
import type { BigNum, NumberFactory } from '../../numbers';
import { LevelRule } from './level';
import { SleeveLevels, levelRuleOf, requireActionState } from './sleeveLevels';
import { countRunsTowardSleeveXp, wholeCount } from './sleeveXp';
import type { XpCurve } from './xpCurve';
import { XpReductions } from './xpReductions';
import type { ActionId, ActionState, GameConfig, GameState } from '../types';

/**
 * Applies completed runs to the experience counters and answers level queries.
 *
 * @remarks
 * Owns no mutable state of its own; it mutates the `GameState` passed in.
 * Every action has its own action XP/level and its own sleeve XP/level.
 * Reduction buyables are answered by {@link XpReductions}; the level queries here measure XP against the unreduced thresholds.
 * Called by: `engine.ts`. Calls: {@link XpReductions}, {@link SleeveLevels}, `countRunsTowardSleeveXp`.
 */
export class Progression {
  private readonly actionRules = new Map<ActionId, LevelRule>();
  private readonly sleeve: SleeveLevels;
  private readonly reductions: XpReductions;
  private readonly sleeveXpPerGrant: BigNum;
  /** Levels one Skill shard delays the action XP scaling by (0 when the game has none). */
  private readonly levelsPerShard: number;

  /**
   * Creates the progression service from the configuration.
   *
   * @param config reads `progression`, the per-action level overrides and (optionally) the buyables that reduce sleeve XP requirements
   * @param factory number factory
   */
  constructor(
    config: Pick<GameConfig, 'actions' | 'progression'> & Partial<Pick<GameConfig, 'buyables' | 'items'>>,
    private readonly factory: NumberFactory,
  ) {
    this.reductions = new XpReductions(config.buyables ?? [], config.progression.runsPerSleeveXp, config.progression.maxSleeveXpReduction);
    this.sleeve = new SleeveLevels(config, this.reductions, factory);
    for (const a of config.actions) {
      this.actionRules.set(a.id, new LevelRule(a.levels ?? config.progression.actionLevels, factory));
    }
    this.sleeveXpPerGrant = factory.fromNumber(config.progression.sleeveXpPerGrant);
    this.levelsPerShard = config.items?.skillShard?.levelsDelayed ?? 0;
  }

  /**
   * Completed runs one batch of sleeve XP takes right now.
   *
   * @remarks
   * `progression.runsPerSleeveXp` less `perCopy` per owned copy of each `runsPerSleeveXpReduction` buyable, but never below the
   * largest `minRuns` among the owned ones, and never above the base. Called by: `recordRuns`, `runsBeforeLevelChange`, `engine.ts`.
   *
   * @param state current state (reads `purchased`)
   * @returns a whole number between 1 and `progression.runsPerSleeveXp`
   */
  runsPerSleeveXp(state: GameState): number {
    return this.reductions.runsPerSleeveXp(state);
  }

  /**
   * Records completed runs of an action.
   *
   * - Adds `xp` to the action's experience.
   * - Adds `runs` to the action's run counter; every {@link Progression.runsPerSleeveXp} runs grants it `sleeveXpPerGrant` sleeve XP.
   *
   * @param state state to mutate
   * @param actionId the action that completed
   * @param xp action XP to add
   * @param runs runs to count towards sleeve XP (>= 1)
   * @throws Error if the action id is unknown
   */
  recordRuns(state: GameState, actionId: ActionId, xp: BigNum, runs: BigNum): void {
    const action = this.requireAction(state, actionId);
    action.xp = action.xp.add(xp);

    if (this.sleeve.isOpen(state)) countRunsTowardSleeveXp(action, runs, this.runsPerSleeveXp(state), this.sleeveXpPerGrant, this.factory);
  }

  /**
   * How many identical runs of an action can be applied in one batch: the largest count such that neither the
   * action level nor the sleeve level changes before the LAST of those runs completes (the last run may cross a
   * threshold). Lets the engine compute runs in closed form between level changes.
   *
   * @remarks
   * Conservative: the result never exceeds the true count, so a batch can be too small (the engine then simply
   * starts another one) but never too large. Always at least 1.
   *
   * Called by: `engine.ts`.
   *
   * @param state current state
   * @param actionId the action
   * @param xpPerRun action XP one run grants
   * @returns a whole number >= 1 (the sleeve level always bounds it: every run counts towards it)
   * @throws Error if the action id is unknown
   */
  runsBeforeLevelChange(state: GameState, actionId: ActionId, xpPerRun: BigNum): number {
    const action = this.requireAction(state, actionId);
    let runs = Infinity;
    if (!xpPerRun.isZero()) {
      runs = wholeCount(this.nextActionLevelXp(state, actionId).sub(action.xp).div(xpPerRun));
    }
    const missingXp = this.nextSleeveLevelXp(state, actionId).sub(action.sleeveXp);
    const grants = Math.max(1, wholeCount(missingXp.div(this.sleeveXpPerGrant)));
    const neededRuns = this.factory
      .fromNumber(grants)
      .mul(this.factory.fromNumber(this.runsPerSleeveXp(state)))
      .sub(this.factory.fromNumber(action.runsTowardSleeveXp));
    runs = Math.min(runs, wholeCount(neededRuns));
    return Math.max(1, runs);
  }

  /**
   * Level of an action.
   * @throws Error if the action id is unknown
   */
  actionLevel(state: GameState, actionId: ActionId): number {
    return this.rule(this.actionRules, actionId).levelForXp(this.scaledActionXp(state, actionId), this.xpDelay(state, actionId));
  }

  /**
   * Fraction by which the XP every level of one action needs is lowered.
   *
   * @remarks
   * Two sources multiply: the flat `actionXpReduction` buyables (summed, capped at `progression.maxSleeveXpReduction`, the same cap as the
   * sleeve levels) and Sleeve Euphoria (`actionXpReductionFromSleeveLevel`, which depends on THIS action's sleeve level and has its own
   * ceiling). The result is `1 - (1 - flat) x (1 - euphoria)`.
   *
   * @param state current state (reads `purchased` and sleeve XP)
   * @param actionId the action whose levels are asked about
   * @returns a fraction in [0, 1)
   */
  actionXpReduction(state: GameState, actionId: ActionId): number {
    return this.reductions.actionXpReduction(state, () => this.sleeveLevel(state, actionId));
  }

  /**
   * The total of the ACTION levels of all actions (the number synthetic sleeves compare, and what skill points are earned from).
   *
   * @param state current state
   * @returns a whole number >= 0
   */
  totalActionLevels(state: GameState): number {
    let total = 0;
    for (const id of this.actionRules.keys()) total += this.actionLevel(state, id);
    return total;
  }

  /**
   * The total of the SLEEVE levels of all actions (the progress gate and the run record compare it).
   *
   * Called by: `resleeve/progressGate.ts`, `resleeve/resleever.ts`. Calls: {@link Progression.sleeveLevel}.
   *
   * @param state current state
   * @returns a whole number >= 0 (NaN counts as 0)
   */
  totalSleeveLevels(state: GameState): number {
    let total = 0;
    for (const id of this.actionRules.keys()) total += this.sleeveLevel(state, id);
    return Math.max(0, total) || 0;
  }

  /**
   * The total of the action levels with the fraction of each action's current level added (level + progress into it), so it rises
   * continuously. Synthetic sleeves measure the live sleeve with it.
   *
   * Called by: `synth/synthSleeves.ts`. Calls: {@link Progression.actionLevel}, {@link Progression.actionLevelProgress}.
   *
   * @param state current state
   * @returns a number >= 0
   */
  totalActionLevelsWithProgress(state: GameState): number {
    let total = 0;
    for (const id of this.actionRules.keys()) total += this.actionLevel(state, id) + this.actionLevelProgress(state, id);
    return total;
  }

  /**
   * Total XP at which the action reaches its next level (all earlier levels included).
   * @throws Error if the action id is unknown
   */
  nextActionLevelXp(state: GameState, actionId: ActionId): BigNum {
    return this.rule(this.actionRules, actionId)
      .xpForNextLevel(this.actionLevel(state, actionId), this.xpDelay(state, actionId))
      .mul(this.factory.fromNumber(1 - this.actionXpReduction(state, actionId)));
  }

  /**
   * Experience gathered inside the action's current level (what is left of its total once the earlier levels are paid for).
   * @throws Error if the action id is unknown
   */
  actionXpIntoLevel(state: GameState, actionId: ActionId): BigNum {
    return this.rule(this.actionRules, actionId)
      .xpIntoLevel(this.scaledActionXp(state, actionId), this.xpDelay(state, actionId))
      .mul(this.factory.fromNumber(1 - this.actionXpReduction(state, actionId)));
  }

  /**
   * Experience that leaving the action's current level costs on its own (the full amount, whatever came before).
   * @throws Error if the action id is unknown
   */
  actionXpForLevel(state: GameState, actionId: ActionId): BigNum {
    return this.rule(this.actionRules, actionId)
      .xpCostOfLevel(this.actionLevel(state, actionId), this.xpDelay(state, actionId))
      .mul(this.factory.fromNumber(1 - this.actionXpReduction(state, actionId)));
  }

  /**
   * Fraction (0..1) of the way from the action's current level to the next.
   * @throws Error if the action id is unknown
   */
  actionLevelProgress(state: GameState, actionId: ActionId): number {
    return this.rule(this.actionRules, actionId).progressFraction(this.scaledActionXp(state, actionId), this.xpDelay(state, actionId));
  }

  /** Sleeve level of an action (see {@link SleeveLevels.level}). Called by: `engine.ts`, `runStats.ts`, `toggleStats.ts`, `stats.ts`, `progressGate.ts`. */
  sleeveLevel(state: GameState, actionId: ActionId): number {
    return this.sleeve.level(state, actionId);
  }

  /** The share of the normal XP the action's sleeve levels ask for (see {@link SleeveLevels.xpKeep}). Called by: `engine.ts`, `stats.ts`. */
  sleeveXpKeep(state: GameState, actionId: ActionId): number {
    return this.sleeve.xpKeep(state, actionId);
  }

  /** Fraction by which Study methods lower the sleeve XP needed (see {@link SleeveLevels.xpReduction}). Called by: `engine.ts`. */
  sleeveXpReduction(state: GameState, actionId: ActionId): number {
    return this.sleeve.xpReduction(state, actionId);
  }

  /** Total sleeve XP at which the next sleeve level is reached (see {@link SleeveLevels.nextLevelXp}). Called by: `engine.ts`. */
  nextSleeveLevelXp(state: GameState, actionId: ActionId): BigNum {
    return this.sleeve.nextLevelXp(state, actionId);
  }

  /** Sleeve XP gathered inside the current sleeve level (see {@link SleeveLevels.xpIntoLevel}). Called by: `engine.ts`. */
  sleeveXpIntoLevel(state: GameState, actionId: ActionId): BigNum {
    return this.sleeve.xpIntoLevel(state, actionId);
  }

  /** Sleeve XP that leaving the current sleeve level costs (see {@link SleeveLevels.xpForLevel}). Called by: `engine.ts`. */
  sleeveXpForLevel(state: GameState, actionId: ActionId): BigNum {
    return this.sleeve.xpForLevel(state, actionId);
  }

  /** Fraction of the way to the next sleeve level (see {@link SleeveLevels.levelProgress}). Called by: `engine.ts`. */
  sleeveLevelProgress(state: GameState, actionId: ActionId): number {
    return this.sleeve.levelProgress(state, actionId);
  }

  /**
   * Levels the XP scaling of an action's levels is delayed by: the Skill shards used on it times the levels one shard delays
   * (see `LevelRule.xpCostOfLevel`). Action levels only.
   *
   * @param state current state (reads the action's `skillShards`)
   * @param actionId the action
   * @returns a whole number >= 0
   */
  xpDelay(state: GameState, actionId: ActionId): number {
    return (state.sleeve.actions[actionId]?.skillShards ?? 0) * this.levelsPerShard;
  }

  /**
   * The level curve of an action as the player pays it (see {@link XpCurve}). Called by: `GameEngine.actionXpCurve`.
   * @throws Error if the action id is unknown
   */
  actionXpCurve(state: GameState, actionId: ActionId): XpCurve {
    const rule = this.rule(this.actionRules, actionId);
    return {
      firstLevelXp: rule.firstLevelXp,
      growthFactor: rule.growthFactor,
      delay: this.xpDelay(state, actionId),
      reduction: this.actionXpReduction(state, actionId),
    };
  }

  /** The level curve of an action's sleeve levels (see {@link SleeveLevels.curve}). Called by: `GameEngine.sleeveXpCurve`. */
  sleeveXpCurve(state: GameState, actionId: ActionId): XpCurve {
    return this.sleeve.curve(state, actionId);
  }

  /** Sleeve XP one batch of runs grants (`progression.sleeveXpPerGrant`). Called by: `GameEngine.sleeveXpGrant`. */
  sleeveXpGrant(): BigNum {
    return this.sleeveXpPerGrant;
  }

  /** Action XP measured against the unreduced thresholds: `xp / (1 - reduction)`. */
  private scaledActionXp(state: GameState, actionId: ActionId): BigNum {
    const xp = this.requireAction(state, actionId).xp;
    const reduction = this.actionXpReduction(state, actionId);
    return reduction > 0 ? xp.div(this.factory.fromNumber(1 - reduction)) : xp;
  }

  private rule(rules: ReadonlyMap<ActionId, LevelRule>, actionId: ActionId): LevelRule {
    return levelRuleOf(rules, actionId);
  }

  private requireAction(state: GameState, actionId: ActionId): ActionState {
    return requireActionState(state, actionId);
  }
}
