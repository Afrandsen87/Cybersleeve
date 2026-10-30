/**
 * @module core
 *
 * Sleeve levels: the per-action sleeve XP measured against the (Study-methods reduced) thresholds. Split from `progression.ts`, which
 * stays the facade the rest of the game imports.
 */
import type { BigNum, NumberFactory } from '../../numbers';
import { sleeveLevelsGateId } from '../effects/ownedOfKind';
import type { ActionId, ActionState, GameConfig, GameState } from '../types';
import { LevelRule } from './level';
import type { XpCurve } from './xpCurve';
import type { XpReductions } from './xpReductions';

/**
 * The action's state, or an error for an unknown id.
 *
 * Called by: {@link SleeveLevels}, `Progression`. Calls: nothing.
 *
 * @throws Error if the action id is unknown
 */
export function requireActionState(state: GameState, actionId: ActionId): ActionState {
  const action = state.sleeve.actions[actionId];
  if (!action) throw new Error(`Unknown action: ${actionId}`);
  return action;
}

/**
 * The level rule of an action from a table, or an error for an unknown id.
 *
 * Called by: {@link SleeveLevels}, `Progression`. Calls: nothing.
 *
 * @throws Error if the action id is unknown
 */
export function levelRuleOf(rules: ReadonlyMap<ActionId, LevelRule>, actionId: ActionId): LevelRule {
  const rule = rules.get(actionId);
  if (!rule) throw new Error(`Unknown action: ${actionId}`);
  return rule;
}

/**
 * Sleeve level, XP and curve queries of every action. Owns no mutable state; reads the `GameState` passed in.
 *
 * @remarks
 * Sleeve XP exists only while the Sleeve levels unlock is owned (a game without that buyable has it from the start). Study methods
 * lower what the thresholds ask for; that is kept as a share (`keep`), not as `1 - reduction`, so it stays exact at any level.
 * Called by: `Progression` (which delegates to it). Calls: {@link XpReductions}, {@link LevelRule}.
 */
export class SleeveLevels {
  private readonly rules = new Map<ActionId, LevelRule>();
  /** Id of the buyable that opens sleeve levels, or `null` when the content has none. */
  private readonly gateId: string | null;

  /**
   * @param config reads `actions` (per-action level overrides), `progression.sleeveLevels` and the buyables (the gate)
   * @param reductions the answer to what the reduction buyables do
   * @param factory number factory
   */
  constructor(
    config: Pick<GameConfig, 'actions' | 'progression'> & Partial<Pick<GameConfig, 'buyables'>>,
    private readonly reductions: XpReductions,
    private readonly factory: NumberFactory,
  ) {
    this.gateId = sleeveLevelsGateId(config.buyables);
    for (const a of config.actions) this.rules.set(a.id, new LevelRule(a.sleeveLevels ?? config.progression.sleeveLevels, factory));
  }

  /**
   * Whether sleeve XP exists yet. The one owner of this rule: run recording (XP and the run counter accrue only while open) and the
   * sleeve level (reads 0 while closed, which only matters for XP saved before the unlock was owned).
   *
   * Called by: `Progression.recordRuns`, {@link SleeveLevels.levelAt}. Calls: nothing.
   *
   * @param state current state (reads `purchased`)
   */
  isOpen(state: GameState): boolean {
    return this.gateId === null || (state.sleeve.purchased[this.gateId] ?? 0) > 0;
  }

  /**
   * Sleeve level of an action if its thresholds were scaled to the share `keep` of the normal XP (1 = normal).
   *
   * Called by: {@link SleeveLevels.level}, {@link SleeveLevels.xpKeep}, the XP queries. Calls: {@link SleeveLevels.isOpen}.
   */
  private levelAt(state: GameState, actionId: ActionId, keep: number): number {
    if (!this.isOpen(state)) return 0;
    return levelRuleOf(this.rules, actionId).levelForXp(this.scaledXp(state, actionId, keep));
  }

  /** Sleeve XP measured against the normal thresholds: `xp / keep`. Called by: the XP queries. */
  private scaledXp(state: GameState, actionId: ActionId, keep: number): BigNum {
    const xp = requireActionState(state, actionId).sleeveXp;
    return keep < 1 ? xp.div(this.factory.fromNumber(keep)) : xp;
  }

  /**
   * Sleeve level of an action.
   *
   * Called by: `Progression.sleeveLevel`. @throws Error if the action id is unknown
   */
  level(state: GameState, actionId: ActionId): number {
    return this.levelAt(state, actionId, this.xpKeep(state, actionId));
  }

  /**
   * The share of the normal XP that one action's sleeve levels ask for: `1 / divisor` of the owned `sleeveXpReduction` buyables (Study
   * methods). 1 without one; it tends to 0 as the source sleeve level grows but never reaches it.
   *
   * Called by: `Progression.sleeveXpKeep`, {@link SleeveLevels.level}. Calls: `XpReductions.sleeveXpDivisor`.
   *
   * @returns a number in (0, 1]
   */
  xpKeep(state: GameState, actionId: ActionId): number {
    return 1 / this.reductions.sleeveXpDivisor(state, actionId, (id) => this.levelAt(state, id, 1));
  }

  /**
   * Fraction by which the Study-methods buyables lower the XP one action's sleeve levels need (`1 - xpKeep`), for display.
   *
   * Called by: `Progression.sleeveXpReduction`, {@link SleeveLevels.curve}. Calls: {@link SleeveLevels.xpKeep}.
   *
   * @returns a fraction in [0, 1)
   */
  xpReduction(state: GameState, actionId: ActionId): number {
    return 1 - this.xpKeep(state, actionId);
  }

  /**
   * Total sleeve XP at which the action's next sleeve level is reached (all earlier levels included).
   *
   * Called by: `Progression.nextSleeveLevelXp`. @throws Error if the action id is unknown
   */
  nextLevelXp(state: GameState, actionId: ActionId): BigNum {
    const keep = this.xpKeep(state, actionId);
    const level = this.levelAt(state, actionId, keep);
    return levelRuleOf(this.rules, actionId).xpForNextLevel(level).mul(this.factory.fromNumber(keep));
  }

  /**
   * Sleeve XP gathered inside the action's current sleeve level, in the reduced units the player pays in.
   *
   * Called by: `Progression.sleeveXpIntoLevel`. @throws Error if the action id is unknown
   */
  xpIntoLevel(state: GameState, actionId: ActionId): BigNum {
    const keep = this.xpKeep(state, actionId);
    return levelRuleOf(this.rules, actionId)
      .xpIntoLevel(this.scaledXp(state, actionId, keep))
      .mul(this.factory.fromNumber(keep));
  }

  /**
   * Sleeve XP that leaving the action's current sleeve level costs on its own, after any reduction.
   *
   * Called by: `Progression.sleeveXpForLevel`. @throws Error if the action id is unknown
   */
  xpForLevel(state: GameState, actionId: ActionId): BigNum {
    const keep = this.xpKeep(state, actionId);
    return levelRuleOf(this.rules, actionId)
      .xpCostOfLevel(this.levelAt(state, actionId, keep))
      .mul(this.factory.fromNumber(keep));
  }

  /**
   * Fraction (0..1) of the way from the action's current sleeve level to the next.
   *
   * Called by: `Progression.sleeveLevelProgress`. @throws Error if the action id is unknown
   */
  levelProgress(state: GameState, actionId: ActionId): number {
    return levelRuleOf(this.rules, actionId).progressFraction(this.scaledXp(state, actionId, this.xpKeep(state, actionId)));
  }

  /**
   * The level curve of an action's sleeve levels: no delay, the Study-methods reduction.
   *
   * Called by: `Progression.sleeveXpCurve`. @throws Error if the action id is unknown
   */
  curve(state: GameState, actionId: ActionId): XpCurve {
    const rule = levelRuleOf(this.rules, actionId);
    return { firstLevelXp: rule.firstLevelXp, growthFactor: rule.growthFactor, delay: 0, reduction: this.xpReduction(state, actionId) };
  }
}
