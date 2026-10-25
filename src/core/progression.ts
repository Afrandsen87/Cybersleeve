/**
 * @module core
 *
 * Experience bookkeeping: per-action XP/levels and per-action sleeve XP/levels.
 */
import type { BigNum, NumberFactory } from '../numbers';
import { LevelRule } from './level';
import type { ActionId, ActionState, BuyableEffect, BuyableId, GameConfig, GameState } from './types';

/** A `sleeveXpReduction` buyable. */
interface ReductionSource {
  readonly id: BuyableId;
  readonly effect: Extract<BuyableEffect, { kind: 'sleeveXpReduction' }>;
}

/** An `actionXpReduction` buyable. */
interface ActionReductionSource {
  readonly id: BuyableId;
  readonly amount: number;
}

/** A `runsPerSleeveXpReduction` buyable. */
interface RunsReductionSource {
  readonly id: BuyableId;
  readonly perCopy: number;
  readonly minRuns: number;
}

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
 * `sleeveXpReduction` buyables scale down the XP every sleeve level asks for: a reduction `r` makes each threshold
 * `(1 - r)` times as large. The action whose sleeve level feeds a reduction is exempt from it, so the level is always
 * measured against the normal thresholds.
 * `actionXpReduction` buyables do the same for every ACTION level (never the sleeve levels): each action level then needs `(1 - r)`
 * times the XP.
 * `runsPerSleeveXpReduction` buyables lower how many runs one batch of sleeve XP takes (see {@link Progression.runsPerSleeveXp}).
 * Called by: `engine.ts`.
 */
export class Progression {
  private readonly actionRules = new Map<ActionId, LevelRule>();
  private readonly sleeveRules = new Map<ActionId, LevelRule>();
  private readonly baseRunsPerSleeveXp: number;
  private readonly runsReductionSources: readonly RunsReductionSource[];
  private readonly sleeveXpPerGrant: BigNum;
  private readonly reductionSources: readonly ReductionSource[];
  private readonly actionReductionSources: readonly ActionReductionSource[];
  private readonly maxTotalReduction: number;

  /**
   * Creates the progression service from the configuration.
   *
   * @param config reads `progression`, the per-action level overrides and (optionally) the buyables that reduce sleeve XP requirements
   * @param factory number factory
   */
  constructor(
    config: Pick<GameConfig, 'actions' | 'progression'> & Partial<Pick<GameConfig, 'buyables'>>,
    private readonly factory: NumberFactory,
  ) {
    this.reductionSources = (config.buyables ?? []).flatMap((b) =>
      b.effect.kind === 'sleeveXpReduction' ? [{ id: b.id, effect: b.effect }] : [],
    );
    this.actionReductionSources = (config.buyables ?? []).flatMap((b) =>
      b.effect.kind === 'actionXpReduction' ? [{ id: b.id, amount: b.effect.amount }] : [],
    );
    this.runsReductionSources = (config.buyables ?? []).flatMap((b) =>
      b.effect.kind === 'runsPerSleeveXpReduction' ? [{ id: b.id, perCopy: b.effect.perCopy, minRuns: b.effect.minRuns }] : [],
    );
    for (const a of config.actions) {
      this.actionRules.set(a.id, new LevelRule(a.levels ?? config.progression.actionLevels, factory));
      this.sleeveRules.set(a.id, new LevelRule(a.sleeveLevels ?? config.progression.sleeveLevels, factory));
    }
    this.baseRunsPerSleeveXp = config.progression.runsPerSleeveXp;
    this.sleeveXpPerGrant = factory.fromNumber(config.progression.sleeveXpPerGrant);
    this.maxTotalReduction = config.progression.maxSleeveXpReduction;
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
    let runs = this.baseRunsPerSleeveXp;
    let floor = 1;
    for (const { id, perCopy, minRuns } of this.runsReductionSources) {
      const copies = state.purchased[id] ?? 0;
      if (copies <= 0) continue;
      runs -= perCopy * copies;
      floor = Math.max(floor, minRuns);
    }
    return Math.min(this.baseRunsPerSleeveXp, Math.max(floor, runs));
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

    const runsPerXp = this.runsPerSleeveXp(state);
    const total = this.factory.fromNumber(action.runsTowardSleeveXp).add(runs);
    let grants: BigNum;
    if (total.lt(this.factory.fromNumber(EXACT_RUN_LIMIT))) {
      // Whole runs below the limit are exact as plain numbers; the number type's division is not (90 / 90 can come out just under 1).
      const runCount = Math.round(total.toNumber());
      const batches = Math.floor(runCount / runsPerXp);
      action.runsTowardSleeveXp = runCount - batches * runsPerXp;
      grants = this.factory.fromNumber(batches);
    } else {
      action.runsTowardSleeveXp = 0;
      grants = total.div(this.factory.fromNumber(runsPerXp)).floor();
    }
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
    return this.rule(this.actionRules, actionId).levelForXp(this.scaledActionXp(state, actionId));
  }

  /**
   * Fraction by which owned `actionXpReduction` buyables lower the XP every action level needs.
   *
   * @param state current state (reads `purchased`)
   * @returns a fraction in [0, `progression.maxSleeveXpReduction`] (the same cap as the sleeve levels)
   */
  actionXpReduction(state: GameState): number {
    let total = 0;
    for (const { id, amount } of this.actionReductionSources) total += amount * (state.purchased[id] ?? 0);
    return Math.min(total, this.maxTotalReduction);
  }

  /**
   * Total XP at which the action reaches its next level (all earlier levels included).
   * @throws Error if the action id is unknown
   */
  nextActionLevelXp(state: GameState, actionId: ActionId): BigNum {
    return this.rule(this.actionRules, actionId)
      .xpForNextLevel(this.actionLevel(state, actionId))
      .mul(this.factory.fromNumber(1 - this.actionXpReduction(state)));
  }

  /**
   * Experience gathered inside the action's current level (what is left of its total once the earlier levels are paid for).
   * @throws Error if the action id is unknown
   */
  actionXpIntoLevel(state: GameState, actionId: ActionId): BigNum {
    return this.rule(this.actionRules, actionId)
      .xpIntoLevel(this.scaledActionXp(state, actionId))
      .mul(this.factory.fromNumber(1 - this.actionXpReduction(state)));
  }

  /**
   * Experience that leaving the action's current level costs on its own (the full amount, whatever came before).
   * @throws Error if the action id is unknown
   */
  actionXpForLevel(state: GameState, actionId: ActionId): BigNum {
    return this.rule(this.actionRules, actionId)
      .xpCostOfLevel(this.actionLevel(state, actionId))
      .mul(this.factory.fromNumber(1 - this.actionXpReduction(state)));
  }

  /**
   * Fraction (0..1) of the way from the action's current level to the next.
   * @throws Error if the action id is unknown
   */
  actionLevelProgress(state: GameState, actionId: ActionId): number {
    return this.rule(this.actionRules, actionId).progressFraction(this.scaledActionXp(state, actionId));
  }

  /**
   * Sleeve level of an action.
   * @throws Error if the action id is unknown
   */
  sleeveLevel(state: GameState, actionId: ActionId): number {
    return this.sleeveLevelAt(state, actionId, this.sleeveXpReduction(state, actionId));
  }

  /**
   * Fraction by which owned `sleeveXpReduction` buyables lower the XP that one action's sleeve levels need.
   *
   * @remarks
   * Per buyable: `min(maxReduction, perLevel * sleeve level of sourceActionId * copies)`, summed and capped at `progression.maxSleeveXpReduction`. The
   * source action itself is not reduced by its own buyable, so its level is measured against the normal thresholds.
   *
   * @param state current state (reads `purchased` and sleeve XP)
   * @param actionId the action whose sleeve levels are asked about
   * @returns a fraction in [0, `progression.maxSleeveXpReduction`]
   */
  sleeveXpReduction(state: GameState, actionId: ActionId): number {
    let total = 0;
    for (const { id, effect } of this.reductionSources) {
      const copies = state.purchased[id] ?? 0;
      if (copies <= 0 || effect.sourceActionId === actionId) continue;
      const level = this.sleeveLevelAt(state, effect.sourceActionId, 0);
      total += Math.min(effect.maxReduction, effect.perLevel * level * copies);
    }
    return Math.min(total, this.maxTotalReduction);
  }

  /**
   * Total sleeve XP at which the action's next sleeve level is reached (all earlier levels included).
   * @throws Error if the action id is unknown
   */
  nextSleeveLevelXp(state: GameState, actionId: ActionId): BigNum {
    const reduction = this.sleeveXpReduction(state, actionId);
    const level = this.sleeveLevelAt(state, actionId, reduction);
    return this.rule(this.sleeveRules, actionId)
      .xpForNextLevel(level)
      .mul(this.factory.fromNumber(1 - reduction));
  }

  /**
   * Sleeve XP gathered inside the action's current sleeve level, in the reduced units the player pays in.
   * @throws Error if the action id is unknown
   */
  sleeveXpIntoLevel(state: GameState, actionId: ActionId): BigNum {
    const reduction = this.sleeveXpReduction(state, actionId);
    return this.rule(this.sleeveRules, actionId)
      .xpIntoLevel(this.scaledSleeveXp(state, actionId, reduction))
      .mul(this.factory.fromNumber(1 - reduction));
  }

  /**
   * Sleeve XP that leaving the action's current sleeve level costs on its own, after any reduction.
   * @throws Error if the action id is unknown
   */
  sleeveXpForLevel(state: GameState, actionId: ActionId): BigNum {
    const reduction = this.sleeveXpReduction(state, actionId);
    return this.rule(this.sleeveRules, actionId)
      .xpCostOfLevel(this.sleeveLevelAt(state, actionId, reduction))
      .mul(this.factory.fromNumber(1 - reduction));
  }

  /**
   * Fraction (0..1) of the way from the action's current sleeve level to the next.
   * @throws Error if the action id is unknown
   */
  sleeveLevelProgress(state: GameState, actionId: ActionId): number {
    return this.rule(this.sleeveRules, actionId).progressFraction(
      this.scaledSleeveXp(state, actionId, this.sleeveXpReduction(state, actionId)),
    );
  }

  /** Action XP measured against the unreduced thresholds: `xp / (1 - reduction)`. */
  private scaledActionXp(state: GameState, actionId: ActionId): BigNum {
    const xp = this.requireAction(state, actionId).xp;
    const reduction = this.actionXpReduction(state);
    return reduction > 0 ? xp.div(this.factory.fromNumber(1 - reduction)) : xp;
  }

  /** Sleeve level of an action if thresholds were reduced by `reduction`. */
  private sleeveLevelAt(state: GameState, actionId: ActionId, reduction: number): number {
    return this.rule(this.sleeveRules, actionId).levelForXp(this.scaledSleeveXp(state, actionId, reduction));
  }

  /** Sleeve XP measured against the unreduced thresholds: `xp / (1 - reduction)`. */
  private scaledSleeveXp(state: GameState, actionId: ActionId, reduction: number): BigNum {
    const xp = this.requireAction(state, actionId).sleeveXp;
    return reduction > 0 ? xp.div(this.factory.fromNumber(1 - reduction)) : xp;
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
