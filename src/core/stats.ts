/**
 * @module core
 *
 * Derived values: everything that is computed from the state, the content and the tuning but changes nothing.
 */
import type { BigNum, NumberFactory } from '../numbers';
import type { ActionLookup } from './actionLookup';
import type { Economy } from './economy';
import { resolveEffects, resolveLevelBonus, resolveSleeveStats, type SleeveStats } from './effects';
import { heatTaxFactor } from './heat';
import type { Progression } from './progression';
import { effectiveDurationMs, speedMultiplier, type SpeedModifier } from './speed';
import type { ActionId, GameConfig, GameState } from './types';

/**
 * Read-only calculations over the game state: sleeve stats, speed, durations, rewards and passive income.
 *
 * @remarks
 * Holds no state of its own; it reads the `GameState` it was given every time, so it always reflects the current game.
 * Called by: `engine.ts`, `actionRunner.ts`, `network.ts`.
 * Calls: `resolveSleeveStats`, `resolveEffects`, `resolveLevelBonus`, {@link Progression}, {@link Economy}, `speedMultiplier`.
 */
export class DerivedStats {
  /**
   * Creates the unit.
   *
   * @param config content and tuning
   * @param state the live game state (read only)
   * @param progression XP/level service
   * @param economy reward formulas
   * @param speedModifiers factors of the speed multiplier
   * @param factory number factory
   * @param definition action lookup
   */
  constructor(
    private readonly config: GameConfig,
    private readonly state: GameState,
    private readonly progression: Progression,
    private readonly economy: Economy,
    private readonly speedModifiers: readonly SpeedModifier[],
    private readonly factory: NumberFactory,
    private readonly definition: ActionLookup,
  ) {}

  /** The global sleeve stats (access level, interface speed, heat, ...) after sleeve-wide purchases. */
  sleeveStats(): SleeveStats {
    return resolveSleeveStats(this.config.buyables, this.state, this.config.sleeve, this.factory);
  }

  /** The share of earned credits kept after the heat tax (`heatTaxFactor` with the current Circumvention). */
  creditKeepFactor(): number {
    return heatTaxFactor(this.state.heat, this.sleeveStats().heatReduction);
  }

  /** Output multiplier from purchases for an action (>= 1). */
  outputMultiplier(id: ActionId): BigNum {
    return resolveEffects(this.config.buyables, this.state, id, this.factory).outputMultiplier;
  }

  /** True when the action restarts itself (an owned, switched-on auto-run buyable). */
  isAutoRun(id: ActionId): boolean {
    return resolveEffects(this.config.buyables, this.state, id, this.factory).autoRun;
  }

  /** Levels added to an action's level for speed by buyables; its XP progress is not affected. */
  levelBonus(id: ActionId): number {
    return resolveLevelBonus(this.config.buyables, this.state, id, (source) => this.progression.sleeveLevel(this.state, source));
  }

  /** Current speed multiplier of an action. */
  currentSpeed(id: ActionId): number {
    return speedMultiplier(this.speedModifiers, {
      actionId: id,
      actionLevel: this.progression.actionLevel(this.state, id) + this.levelBonus(id),
      sleeveLevel: this.progression.sleeveLevel(this.state, id),
      interfaceSpeed: this.sleeveStats().interfaceSpeed,
    });
  }

  /** Current duration of one run of an action, after speed modifiers. @throws Error if the action id is unknown */
  currentDurationMs(id: ActionId): number {
    return effectiveDurationMs(this.definition(id).baseDurationMs, this.currentSpeed(id));
  }

  /** Amount earned per completed run BEFORE the heat tax. @throws Error if the action id is unknown */
  rewardPerRun(id: ActionId): BigNum {
    return this.economy.grossReward(this.definition(id), this.state.network, this.outputMultiplier(id));
  }

  /** What a completed run actually adds now: `rewardPerRun`, for credits after the heat tax. @throws Error if unknown */
  payoutPerRun(id: ActionId): BigNum {
    return this.economy.payout(this.definition(id), this.rewardPerRun(id), this.state.heat, this.sleeveStats().heatReduction);
  }

  /** Action XP gained per completed run now. @throws Error if the action id is unknown */
  xpPerRun(id: ActionId): BigNum {
    return this.economy.xpPerRun(this.definition(id), this.outputMultiplier(id));
  }

  /** Credits the network delivers per second right now, after the heat tax. */
  passiveCreditsPerSecond(): BigNum {
    const stats = this.sleeveStats();
    return this.economy.passiveCreditsPerSecond(this.state.network, this.state.heat, stats.heatReduction, stats.nodePayoutMultiplier);
  }
}
