/**
 * @module core
 *
 * What critical successes are now: the chance, the rule of an action, the links, and how many one run can have at most. Read only.
 */
import type { NumberFactory } from '../../numbers';
import { resolveEffects, type SleeveStats } from '../effects/effects';
import type { ActionDefinition, ActionId, CriticalSuccessRule, GameConfig, GameState } from '../types';
import { CriticalSuccesses, criticalRuleFor } from './critical';
import { criticalCover } from './criticalCover';

/**
 * Answers the questions about critical successes. Holds no state; reads the `GameState` it was given every time.
 *
 * Called by: `DerivedStats` (the facade). Calls: `criticalRuleFor`, `criticalCover`, {@link CriticalSuccesses.maxPerRun}, `resolveEffects`.
 */
export class CritStats {
  /**
   * Creates the unit.
   *
   * @param config reads `buyables`, `criticalSuccess` and `items`
   * @param state the live game state (read only)
   * @param factory number factory
   * @param definition action lookup (only the definition is used)
   * @param sleeveStats the sleeve-wide stats (computed once per snapshot by the facade)
   */
  constructor(
    private readonly config: Pick<GameConfig, 'buyables' | 'criticalSuccess' | 'items'>,
    private readonly state: GameState,
    private readonly factory: NumberFactory,
    private readonly definition: (id: ActionId) => ActionDefinition,
    private readonly sleeveStats: () => SleeveStats,
  ) {}

  /** Chance (0..1) that a completed run is a critical success (owned `criticalChance` buyables). */
  criticalChance(): number {
    return this.sleeveStats().criticalChance;
  }

  /** What a critical success does for this action: the global rule with the action's own fields laid over it. @throws Error if the id is unknown */
  criticalRule(id: ActionId): CriticalSuccessRule {
    const rule = criticalRuleFor(this.config.criticalSuccess, this.definition(id));
    const factor = resolveEffects(this.config.buyables, this.state, id, this.factory).criticalFactor;
    const rewardFactor = factor * this.sleeveStats().criticalRewardFactor;
    return factor === 1 && rewardFactor === 1
      ? rule
      : { ...rule, xpMultiplier: rule.xpMultiplier * factor, rewardMultiplier: rule.rewardMultiplier * rewardFactor };
  }

  /** Chance (0..1) that a critical success brings one extra, free critical success (owned `criticalExtraChance` buyables). */
  criticalExtraChance(): number {
    return this.sleeveStats().criticalExtraChance;
  }

  /** The actions that every critical run of this action banks a guaranteed critical success for (owned `criticalLink` buyables). */
  criticalLinks(id: ActionId): readonly ActionId[] {
    return resolveEffects(this.config.buyables, this.state, id, this.factory).criticalLinks;
  }

  /** True when a completed run of this action can be critical now: by chance, by a Zero-day that is switched on, or by a banked success. */
  criticalPossible(id: ActionId): boolean {
    return this.criticalChance() > 0 || criticalCover(this.state, this.config.items, id);
  }

  /**
   * The most critical successes one completed run of this action can have now: the whole part of the chance, one more while a fraction of a
   * chance remains, and one more while a Zero-day, Admin key or banked success can cover it. 0 when criticals are not possible.
   * Doubled while a `criticalExtraChance` buyable is owned (one possible extra per success).
   */
  maxCritsPerRun(id: ActionId): number {
    return CriticalSuccesses.maxPerRun(this.criticalChance(), this.criticalExtraChance(), criticalCover(this.state, this.config.items, id));
  }
}
