/**
 * @module core
 *
 * Experience bookkeeping: per-action XP/levels and per-action sleeve XP/levels. The reduction buyables live in `xpReductions.ts` and the
 * run counting in `sleeveXp.ts`; this is the facade the rest of the game imports.
 */
import type { BigNum, NumberFactory } from '../../numbers';
import { LevelRule } from './level';
import { sleeveLevelsGateId } from '../resleeve/resleeveGate';
import { countRunsTowardSleeveXp, wholeCount } from './sleeveXp';
import { XpReductions } from './xpReductions';
import type { ActionId, ActionState, GameConfig, GameState } from '../types';

/**
 * Applies completed runs to the experience counters and answers level queries.
 *
 * @remarks
 * Owns no mutable state of its own; it mutates the `GameState` passed in.
 * Every action has its own action XP/level and its own sleeve XP/level.
 * Reduction buyables are answered by {@link XpReductions}; the level queries here measure XP against the unreduced thresholds.
 * Called by: `engine.ts`. Calls: {@link XpReductions}, `countRunsTowardSleeveXp`.
 */
export class Progression {
  private readonly actionRules = new Map<ActionId, LevelRule>();
  private readonly sleeveRules = new Map<ActionId, LevelRule>();
  private readonly reductions: XpReductions;
  private readonly sleeveXpPerGrant: BigNum;
  /** Id of the buyable that opens sleeve levels, or `null` when the content has none. */
  private readonly sleeveLevelsGateId: string | null;
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
    this.sleeveLevelsGateId = sleeveLevelsGateId(config.buyables);
    for (const a of config.actions) {
      this.actionRules.set(a.id, new LevelRule(a.levels ?? config.progression.actionLevels, factory));
      this.sleeveRules.set(a.id, new LevelRule(a.sleeveLevels ?? config.progression.sleeveLevels, factory));
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

    countRunsTowardSleeveXp(action, runs, this.runsPerSleeveXp(state), this.sleeveXpPerGrant, this.factory);
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

  /**
   * Sleeve level of an action.
   * @throws Error if the action id is unknown
   */
  sleeveLevel(state: GameState, actionId: ActionId): number {
    return this.sleeveLevelAt(state, actionId, this.sleeveXpKeep(state, actionId));
  }

  /**
   * The share of the normal XP that one action's sleeve levels ask for: `1 / divisor` of the owned `sleeveXpReduction` buyables (Study
   * methods). 1 without one; it tends to 0 as the source sleeve level grows but never reaches it. Kept as a share, not as `1 - reduction`,
   * so it stays exact at any level.
   *
   * @param state current state (reads `purchased` and sleeve XP)
   * @param actionId the action whose sleeve levels are asked about
   * @returns a number in (0, 1]
   */
  sleeveXpKeep(state: GameState, actionId: ActionId): number {
    return 1 / this.reductions.sleeveXpDivisor(state, actionId, (id) => this.sleeveLevelAt(state, id, 1));
  }

  /**
   * Fraction by which the owned `sleeveXpReduction` buyables lower the XP that one action's sleeve levels need (`1 - sleeveXpKeep`), for
   * display. With Study methods at source level L it is `L / (L + 1)`.
   *
   * @returns a fraction in [0, 1)
   */
  sleeveXpReduction(state: GameState, actionId: ActionId): number {
    return 1 - this.sleeveXpKeep(state, actionId);
  }

  /**
   * Total sleeve XP at which the action's next sleeve level is reached (all earlier levels included).
   * @throws Error if the action id is unknown
   */
  nextSleeveLevelXp(state: GameState, actionId: ActionId): BigNum {
    const keep = this.sleeveXpKeep(state, actionId);
    const level = this.sleeveLevelAt(state, actionId, keep);
    return this.rule(this.sleeveRules, actionId).xpForNextLevel(level).mul(this.factory.fromNumber(keep));
  }

  /**
   * Sleeve XP gathered inside the action's current sleeve level, in the reduced units the player pays in.
   * @throws Error if the action id is unknown
   */
  sleeveXpIntoLevel(state: GameState, actionId: ActionId): BigNum {
    const keep = this.sleeveXpKeep(state, actionId);
    return this.rule(this.sleeveRules, actionId)
      .xpIntoLevel(this.scaledSleeveXp(state, actionId, keep))
      .mul(this.factory.fromNumber(keep));
  }

  /**
   * Sleeve XP that leaving the action's current sleeve level costs on its own, after any reduction.
   * @throws Error if the action id is unknown
   */
  sleeveXpForLevel(state: GameState, actionId: ActionId): BigNum {
    const keep = this.sleeveXpKeep(state, actionId);
    return this.rule(this.sleeveRules, actionId)
      .xpCostOfLevel(this.sleeveLevelAt(state, actionId, keep))
      .mul(this.factory.fromNumber(keep));
  }

  /**
   * Fraction (0..1) of the way from the action's current sleeve level to the next.
   * @throws Error if the action id is unknown
   */
  sleeveLevelProgress(state: GameState, actionId: ActionId): number {
    return this.rule(this.sleeveRules, actionId).progressFraction(this.scaledSleeveXp(state, actionId, this.sleeveXpKeep(state, actionId)));
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
    return (state.actions[actionId]?.skillShards ?? 0) * this.levelsPerShard;
  }

  /** Action XP measured against the unreduced thresholds: `xp / (1 - reduction)`. */
  private scaledActionXp(state: GameState, actionId: ActionId): BigNum {
    const xp = this.requireAction(state, actionId).xp;
    const reduction = this.actionXpReduction(state, actionId);
    return reduction > 0 ? xp.div(this.factory.fromNumber(1 - reduction)) : xp;
  }

  /** Sleeve level of an action if its thresholds were scaled to the share `keep` of the normal XP (1 = normal). */
  private sleeveLevelAt(state: GameState, actionId: ActionId, keep: number): number {
    // sleeve XP is tracked all along, but its levels count only once the unlock is owned (a game without that buyable has no gate)
    if (this.sleeveLevelsGateId !== null && (state.purchased[this.sleeveLevelsGateId] ?? 0) <= 0) return 0;
    return this.rule(this.sleeveRules, actionId).levelForXp(this.scaledSleeveXp(state, actionId, keep));
  }

  /** Sleeve XP measured against the normal thresholds: `xp / keep`. */
  private scaledSleeveXp(state: GameState, actionId: ActionId, keep: number): BigNum {
    const xp = this.requireAction(state, actionId).sleeveXp;
    return keep < 1 ? xp.div(this.factory.fromNumber(keep)) : xp;
  }

  private rule(rules: ReadonlyMap<ActionId, LevelRule>, actionId: ActionId): LevelRule {
    const rule = rules.get(actionId);
    if (!rule) throw new Error(`Unknown action: ${actionId}`);
    return rule;
  }

  private requireAction(state: GameState, actionId: ActionId): ActionState {
    const action = state.actions[actionId];
    if (!action) throw new Error(`Unknown action: ${actionId}`);
    return action;
  }
}
