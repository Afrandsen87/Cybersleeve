/**
 * @module core
 *
 * Experience bookkeeping: per-action XP/levels and per-action sleeve XP/levels.
 */
import type { BigNum, NumberFactory } from '../numbers';
import { LevelRule } from './level';
import type { ActionId, ActionState, GameConfig, GameState } from './types';

/** Above this many runs the exact remainder toward the next sleeve-XP batch is meaningless and dropped. */
const EXACT_RUN_LIMIT = 1e15;

/** `floor(x)` as a JS number (`Infinity` beyond the double range, 0 for negatives). */
function wholeCount(x: BigNum): number {
  return Math.max(0, Math.floor(x.toNumber()));
}

/**
 * Applies completed runs to the experience counters and answers level queries.
 *
 * @remarks
 * Owns no mutable state of its own; it mutates the `GameState` passed in.
 * Every action has its own action XP/level and its own sleeve XP/level.
 * Called by: `engine.ts`.
 */
export class Progression {
  private readonly actionRules = new Map<ActionId, LevelRule>();
  private readonly sleeveRules = new Map<ActionId, LevelRule>();
  private readonly runsPerSleeveXp: BigNum;
  private readonly sleeveXpPerGrant: BigNum;

  /**
   * Creates the progression service from the configuration.
   *
   * @param config reads `progression` and the per-action level overrides
   * @param factory number factory
   */
  constructor(
    config: Pick<GameConfig, 'actions' | 'progression'>,
    private readonly factory: NumberFactory,
  ) {
    for (const a of config.actions) {
      this.actionRules.set(a.id, new LevelRule(a.levels ?? config.progression.actionLevels, factory));
      this.sleeveRules.set(a.id, new LevelRule(a.sleeveLevels ?? config.progression.sleeveLevels, factory));
    }
    this.runsPerSleeveXp = factory.fromNumber(config.progression.runsPerSleeveXp);
    this.sleeveXpPerGrant = factory.fromNumber(config.progression.sleeveXpPerGrant);
  }

  /**
   * Records completed runs of an action.
   *
   * - Adds `xp` to the action's experience.
   * - Adds `runs` to the action's run counter; every `runsPerSleeveXp` runs grants it `sleeveXpPerGrant` sleeve XP.
   *
   * @param state state to mutate
   * @param actionId the action that completed
   * @param xp action XP to add (already includes multipliers)
   * @param runs runs to count towards sleeve XP (>= 1; a BigNum because output multipliers can be huge)
   * @throws Error if the action id is unknown
   */
  recordRuns(state: GameState, actionId: ActionId, xp: BigNum, runs: BigNum): void {
    const action = this.requireAction(state, actionId);
    action.xp = action.xp.add(xp);

    const total = this.factory.fromNumber(action.runsTowardSleeveXp).add(runs);
    const grants = total.div(this.runsPerSleeveXp).floor();
    action.runsTowardSleeveXp = total.lt(this.factory.fromNumber(EXACT_RUN_LIMIT))
      ? total.sub(grants.mul(this.runsPerSleeveXp)).toNumber()
      : 0;
    if (!grants.isZero()) action.sleeveXp = action.sleeveXp.add(grants.mul(this.sleeveXpPerGrant));
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
   * @param xpPerRun action XP one run grants (already includes multipliers)
   * @param countedRuns runs one run counts towards sleeve XP (the output multiplier)
   * @returns a whole number >= 1, possibly `Infinity` when nothing can ever change a level
   * @throws Error if the action id is unknown
   */
  runsBeforeLevelChange(state: GameState, actionId: ActionId, xpPerRun: BigNum, countedRuns: BigNum): number {
    const action = this.requireAction(state, actionId);
    let runs = Infinity;
    if (!xpPerRun.isZero()) {
      runs = wholeCount(this.nextActionLevelXp(state, actionId).sub(action.xp).div(xpPerRun));
    }
    if (!countedRuns.isZero()) {
      const missingXp = this.nextSleeveLevelXp(state, actionId).sub(action.sleeveXp);
      const grants = Math.max(1, wholeCount(missingXp.div(this.sleeveXpPerGrant)));
      const neededRuns = this.factory.fromNumber(grants).mul(this.runsPerSleeveXp).sub(this.factory.fromNumber(action.runsTowardSleeveXp));
      runs = Math.min(runs, wholeCount(neededRuns.div(countedRuns)));
    }
    return Math.max(1, runs);
  }

  /**
   * Level of an action.
   * @throws Error if the action id is unknown
   */
  actionLevel(state: GameState, actionId: ActionId): number {
    return this.rule(this.actionRules, actionId).levelForXp(this.requireAction(state, actionId).xp);
  }

  /**
   * XP at which the action reaches its next level.
   * @throws Error if the action id is unknown
   */
  nextActionLevelXp(state: GameState, actionId: ActionId): BigNum {
    return this.rule(this.actionRules, actionId).xpForNextLevel(this.actionLevel(state, actionId));
  }

  /**
   * Fraction (0..1) of the way from the action's current level to the next.
   * @throws Error if the action id is unknown
   */
  actionLevelProgress(state: GameState, actionId: ActionId): number {
    return this.rule(this.actionRules, actionId).progressFraction(this.requireAction(state, actionId).xp);
  }

  /**
   * Sleeve level of an action.
   * @throws Error if the action id is unknown
   */
  sleeveLevel(state: GameState, actionId: ActionId): number {
    return this.rule(this.sleeveRules, actionId).levelForXp(this.requireAction(state, actionId).sleeveXp);
  }

  /**
   * Sleeve XP at which the action's next sleeve level is reached.
   * @throws Error if the action id is unknown
   */
  nextSleeveLevelXp(state: GameState, actionId: ActionId): BigNum {
    return this.rule(this.sleeveRules, actionId).xpForNextLevel(this.sleeveLevel(state, actionId));
  }

  /**
   * Fraction (0..1) of the way from the action's current sleeve level to the next.
   * @throws Error if the action id is unknown
   */
  sleeveLevelProgress(state: GameState, actionId: ActionId): number {
    return this.rule(this.sleeveRules, actionId).progressFraction(this.requireAction(state, actionId).sleeveXp);
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
