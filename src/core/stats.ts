/**
 * @module core
 *
 * Derived values: everything that is computed from the state, the content and the tuning but changes nothing.
 */
import type { BigNum, NumberFactory } from '../numbers';
import type { ActionLookup } from './actionLookup';
import { augmentXpFactor } from './augments';
import type { Economy } from './economy';
import {
  type BackChannelRule,
  resolveBackChannel,
  resolveDropChanceFactor,
  resolveEffects,
  resolveLevelBonus,
  resolveNetworkGrowth,
  resolveSleeveStats,
  type SleeveStats,
} from './effects';
import type { Progression } from './progression';
import { Snapshot } from './snapshot';
import { shiftWeights, wholeOrders } from './rarityShift';
import { effectiveDurationMs, type SpeedContext, type SpeedFactor, speedFactors, speedMultiplier, type SpeedModifier } from './speed';
import type { ActionId, GameConfig, GameState, ItemDropRule } from './types';

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
   * @param snapshot scope in which the sleeve stats are computed once (default: a private one that is never opened)
   */
  constructor(
    private readonly config: GameConfig,
    private readonly state: GameState,
    private readonly progression: Progression,
    private readonly economy: Economy,
    private readonly speedModifiers: readonly SpeedModifier[],
    private readonly factory: NumberFactory,
    private readonly definition: ActionLookup,
    private readonly snapshot: Snapshot = new Snapshot(),
  ) {}

  /** The global sleeve stats (access level, interface speed, heat, ...) after sleeve-wide purchases. */
  sleeveStats(): SleeveStats {
    return this.snapshot.memo('sleeveStats', () => resolveSleeveStats(this.config.buyables, this.state, this.config.sleeve, this.factory));
  }

  /** The share of node income kept after the heat tax (with the current ICE Rating). */
  creditKeepFactor(): number {
    return this.economy.keepFactor(this.state.heat, this.sleeveStats().heatReduction);
  }

  /** Multiplier on the action's own reward per run, from purchases (>= 1). It scales that reward only. */
  rewardMultiplier(id: ActionId): BigNum {
    return resolveEffects(this.config.buyables, this.state, id, this.factory).rewardMultiplier;
  }

  /**
   * The items the action may drop per completed run, from its owned `itemDrop` buyables, with the rarity weights as they stand now:
   * shifted towards the rarer rarities by Hacking Proficiency when a `rarityShiftFromProficiency` buyable of the action is owned,
   * and with the drop chance raised by owned `itemDropChanceMultiplier` buyables (never above 1).
   */
  itemDrops(id: ActionId): readonly ItemDropRule[] {
    const { drops, rarityShifts } = resolveEffects(this.config.buyables, this.state, id, this.factory);
    const steps = rarityShifts.length === 0 ? 0 : wholeOrders(this.effectiveHackingProficiency());
    const rarityIds = this.config.items.rarities.map((r) => r.id);
    return drops.map((rule) => {
      let weights = rarityIds.map((r) => rule.rarityWeights[r] ?? 0);
      for (const fraction of rarityShifts) weights = shiftWeights(weights, steps, fraction);
      const factor = resolveDropChanceFactor(this.config.buyables, this.state, rule.itemId);
      return {
        ...rule,
        chance: Math.min(1, rule.chance * factor),
        rarityWeights: rarityShifts.length === 0 ? rule.rarityWeights : Object.fromEntries(rarityIds.map((r, i) => [r, weights[i]!])),
      };
    });
  }

  /** Hacking Proficiency as it counts: the stored total times the factor of owned `hackingProficiencyMultiplier` buyables. */
  effectiveHackingProficiency(): BigNum {
    const factor = this.sleeveStats().hackingProficiencyFactor;
    return factor === 1 ? this.state.hackingProficiency : this.state.hackingProficiency.mul(this.factory.fromNumber(factor));
  }

  /** The back channel the player has unlocked (an owned `backChannel` buyable), or `null`. */
  backChannel(): BackChannelRule | null {
    return resolveBackChannel(this.config.buyables, this.state);
  }

  /** True when the action restarts itself (an owned, switched-on auto-run buyable). */
  isAutoRun(id: ActionId): boolean {
    return resolveEffects(this.config.buyables, this.state, id, this.factory).autoRun;
  }

  /** Levels added to an action's level for speed by buyables; its XP progress is not affected. */
  levelBonus(id: ActionId): number {
    return resolveLevelBonus(this.config.buyables, this.state, id, (source) => this.progression.sleeveLevel(this.state, source));
  }

  /** Everything the speed factors of an action read: its levels (action level including the level bonus) and the interface speed. */
  private speedContext(id: ActionId): SpeedContext {
    return {
      actionId: id,
      actionLevel: this.progression.actionLevel(this.state, id) + this.levelBonus(id),
      sleeveLevel: this.progression.sleeveLevel(this.state, id),
      interfaceSpeed: this.sleeveStats().interfaceSpeed,
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
    const factor = bonus > 0 ? augmentXpFactor(this.state.actions[id]?.augments ?? {}, bonus) : 1;
    return factor === 1 ? base : base.mul(this.factory.fromNumber(factor));
  }

  /** Fraction of its size the network grows by per second right now (fixed rates plus level-based rates of the growth buyables). */
  networkGrowthRate(): number {
    return resolveNetworkGrowth(this.config.buyables, this.state, (id) => this.progression.actionLevel(this.state, id));
  }

  /** Credits one network node delivers per second right now, after the payout multiplier and the heat tax. */
  passiveCreditsPerNode(): BigNum {
    const stats = this.sleeveStats();
    return this.economy.passiveCreditsPerNode(this.state.heat, stats.heatReduction, stats.nodePayoutMultiplier, stats.nodePayoutBonus);
  }

  /** Credits the network delivers per second right now, after the heat tax. */
  passiveCreditsPerSecond(): BigNum {
    const stats = this.sleeveStats();
    return this.economy.passiveCreditsPerSecond(
      this.state.network,
      this.state.heat,
      stats.heatReduction,
      stats.nodePayoutMultiplier,
      stats.nodePayoutBonus,
    );
  }
}
