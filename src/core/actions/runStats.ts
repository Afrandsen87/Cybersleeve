/**
 * @module core
 *
 * What a run of an action is now: its speed and duration, its reward multiplier and payout, and the XP it gives. Read only.
 */
import type { BigNum, NumberFactory } from '../../numbers';
import { resolveEffects, type SleeveStats } from '../effects/effects';
import type { Economy } from '../economy/economy';
import { augmentXpFactor } from '../items/augments';
import type { ActionId, CriticalSuccessRule, GameConfig, GameState } from '../types';
import type { ActionLookup } from './actionLookup';
import { levelRewardFactor } from './levelRewardFactor';
import type { Progression } from './progression';
import { effectiveDurationMs, type SpeedContext, type SpeedFactor, type SpeedModifier, speedFactors, speedMultiplier } from './speed';
import type { ToggleStats } from './toggleStats';

/** What the XP of a batch of runs is sized by: the critical successes one run can have at most (see `CritStats`). */
export interface CriticalLimits {
  /** The most critical successes one completed run of the action can have now. */
  maxCritsPerRun(id: ActionId): number;
  /** What a critical success does for the action. */
  criticalRule(id: ActionId): CriticalSuccessRule;
}

/**
 * Answers the questions about one run of an action. Holds no state; reads the `GameState` it was given every time.
 *
 * Called by: `DerivedStats` (the facade), `actionRunner.ts` through it.
 * Calls: {@link Economy}, {@link ToggleStats}, {@link Progression}, `speedMultiplier`, `levelRewardFactor`, `resolveEffects`.
 */
export class RunStats {
  /**
   * Creates the unit.
   *
   * @param config reads `buyables`, `engine` and `items`
   * @param state the live game state (read only)
   * @param factory number factory
   * @param definition action lookup
   * @param economy reward formulas
   * @param progression action and sleeve levels
   * @param toggles the Overclock, Focus and level-bonus answers
   * @param sleeveStats the sleeve-wide stats (computed once per snapshot by the facade)
   * @param critical what a critical success is, for sizing a batch of runs
   * @param speedModifiers factors of the speed multiplier
   * @param bestSynthLevel the highest level a synthetic sleeve reached on an action (what Neural Mirror compares to)
   */
  constructor(
    private readonly config: Pick<GameConfig, 'buyables' | 'engine' | 'items'>,
    private readonly state: GameState,
    private readonly factory: NumberFactory,
    private readonly definition: ActionLookup,
    private readonly economy: Economy,
    private readonly progression: Pick<Progression, 'actionLevel' | 'sleeveLevel'>,
    private readonly toggles: Pick<ToggleStats, 'activeOverclock' | 'chainLinks' | 'levelBonus' | 'focusStatus'>,
    private readonly sleeveStats: () => SleeveStats,
    private readonly critical: CriticalLimits,
    private readonly speedModifiers: readonly SpeedModifier[],
    private readonly bestSynthLevel: (id: ActionId) => number,
  ) {}

  /**
   * Multiplier on the action's own reward per run, from purchases and from Overclock while it is on and has a reward bonus
   * (`1 + rewardBonus`). It scales that reward only.
   */
  rewardMultiplier(id: ActionId): BigNum {
    const fromLevel = levelRewardFactor(this.config.buyables, this.state, id, (a) => this.progression.actionLevel(this.state, a));
    const effects = resolveEffects(this.config.buyables, this.state, id, this.factory).rewardMultiplier;
    const bought = fromLevel === 1 ? effects : effects.mul(this.factory.fromNumber(fromLevel));
    const overclock = this.toggles.activeOverclock(id);
    const bonus = (overclock?.rewardBonus ?? 0) + (overclock?.chain ? this.toggles.chainLinks(id) * overclock.chain.rewardPerLink : 0);
    return bonus > 0 ? bought.mul(this.factory.fromNumber(1 + bonus)) : bought;
  }

  /** Everything the speed factors of an action read: its levels (action level including the level bonus), the interface speed and the toggles. */
  private speedContext(id: ActionId): SpeedContext {
    const overclock = this.toggles.activeOverclock(id);
    const focus = this.state.focused[id] === true ? this.toggles.focusStatus(id) : null;
    return {
      actionId: id,
      actionLevel: this.progression.actionLevel(this.state, id) + this.toggles.levelBonus(id),
      sleeveLevel: this.progression.sleeveLevel(this.state, id),
      interfaceSpeed: this.sleeveStats().interfaceSpeed,
      overclockBonus: overclock?.speedBonus ?? 0,
      focusBonus: focus?.speedBonus ?? 0,
    };
  }

  /** Current speed multiplier of an action. */
  currentSpeed(id: ActionId): number {
    return speedMultiplier(this.speedModifiers, this.speedContext(id));
  }

  /** The factors the current speed of an action is made of (action level, sleeve level, interface speed, global lever). */
  speedFactors(id: ActionId): readonly SpeedFactor[] {
    return speedFactors(this.speedModifiers, this.speedContext(id));
  }

  /** Current duration of one run of an action, after speed modifiers. @throws Error if the action id is unknown */
  currentDurationMs(id: ActionId): number {
    return effectiveDurationMs(this.definition(id).baseDurationMs, this.currentSpeed(id), this.config.engine.minRunDurationMs);
  }

  /** Amount earned per completed run (heat does not tax it). @throws Error if the action id is unknown */
  rewardPerRun(id: ActionId): BigNum {
    return this.economy.grossReward(this.definition(id), this.state.network, this.rewardMultiplier(id));
  }

  /** What a completed run actually adds now: `rewardPerRun`, rounded down for whole-unit rewards. Heat does not tax it. @throws Error if unknown */
  payoutPerRun(id: ActionId): BigNum {
    return this.economy.payout(this.definition(id), this.rewardPerRun(id));
  }

  /** Action XP gained per completed run now. @throws Error if the action id is unknown */
  xpPerRun(id: ActionId): BigNum {
    const base = this.economy.xpPerRun(this.definition(id));
    const bonus = this.config.items.augment?.xpBonusPerItem ?? 0;
    const augments = bonus > 0 ? augmentXpFactor(this.state.actions[id]?.augments ?? {}, bonus) : 1;
    const factor = augments * this.synthMirrorFactor(id);
    return factor === 1 ? base : base.mul(this.factory.fromNumber(factor));
  }

  /**
   * What Neural Mirror multiplies an action's XP per run by: its `factor` while the action's level is below the highest level a
   * synthetic sleeve reached on it, otherwise 1.
   */
  private synthMirrorFactor(id: ActionId): number {
    const factor = this.sleeveStats().synthXpFactor;
    if (factor === 1) return 1;
    return this.progression.actionLevel(this.state, id) < this.bestSynthLevel(id) ? factor : 1;
  }

  /**
   * The most action XP one run can give now: `xpPerRun`, times the critical XP multiplier for each critical success the run can have at most. Used to
   * size a batch of runs so that no level threshold is crossed before its last run. @throws Error if the id is unknown
   */
  maxXpPerRun(id: ActionId): BigNum {
    const base = this.xpPerRun(id);
    const factor = Math.max(1, this.critical.maxCritsPerRun(id) * this.critical.criticalRule(id).xpMultiplier);
    return factor > 1 ? base.mul(this.factory.fromNumber(factor)) : base;
  }
}
