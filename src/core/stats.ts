/**
 * @module core
 *
 * Derived values: everything that is computed from the state, the content and the tuning but changes nothing.
 */
import type { BigNum, NumberFactory } from '../numbers';
import type { ActionLookup } from './actionLookup';
import type { FocusStatus, ModeStatuses, OverclockStatus } from './actionToggles';
import { augmentXpFactor, distinctAugmentRarities } from './augments';
import { criticalRuleFor } from './critical';
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
import { levelRewardFactor } from './levelRewardFactor';
import type { Progression } from './progression';
import { Snapshot } from './snapshot';
import { shiftWeights, wholeOrders } from './rarityShift';
import { effectiveDurationMs, type SpeedContext, type SpeedFactor, speedFactors, speedMultiplier, type SpeedModifier } from './speed';
import type { ActionId, CriticalSuccessRule, GameConfig, GameState, ItemDropRule, PaysActionRule } from './types';

/**
 * Read-only calculations over the game state: sleeve stats, speed, durations, rewards and passive income.
 *
 * @remarks
 * Holds no state of its own; it reads the `GameState` it was given every time, so it always reflects the current game.
 * Called by: `engine.ts`, `actionRunner.ts`, `network.ts`.
 * Calls: `resolveSleeveStats`, `resolveEffects`, `resolveLevelBonus`, {@link Progression}, {@link Economy}, `speedMultiplier`.
 */
export class DerivedStats implements ModeStatuses {
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
    return this.snapshot.memo('sleeveStats', () =>
      resolveSleeveStats(
        this.config.buyables,
        this.state,
        this.config.sleeve,
        this.factory,
        (id) => this.progression.actionLevel(this.state, id),
        (id) => this.progression.sleeveLevel(this.state, id),
        () => distinctAugmentRarities(this.state.actions),
      ),
    );
  }

  /** The share of node income kept after the heat tax (with the current ICE Rating). */
  creditKeepFactor(): number {
    return this.economy.keepFactor(this.state.heat, this.sleeveStats().heatReduction);
  }

  /**
   * Multiplier on the action's own reward per run, from purchases and from Overclock while it is on and has a reward bonus
   * (`1 + rewardBonus`). It scales that reward only.
   */
  rewardMultiplier(id: ActionId): BigNum {
    const fromLevel = levelRewardFactor(this.config.buyables, this.state, id, (a) => this.progression.actionLevel(this.state, a));
    const effects = resolveEffects(this.config.buyables, this.state, id, this.factory).rewardMultiplier;
    const bought = fromLevel === 1 ? effects : effects.mul(this.factory.fromNumber(fromLevel));
    const overclock = this.activeOverclock(id);
    const bonus = (overclock?.rewardBonus ?? 0) + (overclock?.chain ? this.chainLinks(id) * overclock.chain.rewardPerLink : 0);
    return bonus > 0 ? bought.mul(this.factory.fromNumber(1 + bonus)) : bought;
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
      const base = rule.rarityWeights;
      const factor = resolveDropChanceFactor(this.config.buyables, this.state, rule.itemId);
      if (base === undefined) return { ...rule, chance: Math.min(1, rule.chance * factor) }; // an item without rarity has no ratios to shift
      let weights = rarityIds.map((r) => base[r] ?? 0);
      for (const fraction of rarityShifts) weights = shiftWeights(weights, steps, fraction);
      return {
        ...rule,
        chance: Math.min(1, rule.chance * factor),
        rarityWeights: rarityShifts.length === 0 ? base : Object.fromEntries(rarityIds.map((r, i) => [r, weights[i]!])),
      };
    });
  }

  /**
   * Where one stack of items can drop from right now: for each action that can drop the item, the chance that ONE completed run of it
   * drops this item in this rarity. That is the drop chance (with the chance multipliers) times the share of the rarity in the drop
   * ratios as they stand now (Hacking Proficiency shifts included); an item without rarity is one stack, so its share is 1. Actions
   * that cannot drop it, and rarities with a share of 0, are left out.
   *
   * @param itemId the item
   * @param rarityId the rarity of the stack (the first rarity for an item without rarity)
   * @returns the actions in configuration order, with the chance of this stack per completed run of each (0..1)
   */
  dropSources(itemId: string, rarityId: string): readonly { readonly actionId: ActionId; readonly chance: number }[] {
    const first = this.config.items.rarities[0]?.id;
    const sources: { actionId: ActionId; chance: number }[] = [];
    for (const def of this.config.actions) {
      let chance = 0;
      for (const rule of this.itemDrops(def.id)) {
        if (rule.itemId !== itemId) continue;
        const weights = rule.rarityWeights;
        if (weights === undefined) {
          if (rarityId === first) chance += rule.chance;
          continue;
        }
        const total = Object.values(weights).reduce((sum, w) => sum + w, 0);
        if (total > 0) chance += (rule.chance * (weights[rarityId] ?? 0)) / total;
      }
      if (chance > 0) sources.push({ actionId: def.id, chance });
    }
    return sources;
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

  /** What each completed run of the action may also pay: one reward of another action, by chance (owned `paysActionReward` buyables). */
  paysActions(id: ActionId): readonly PaysActionRule[] {
    return this.sleeveStats().paysActions.filter((rule) => rule.sourceActionId === id);
  }

  /** The actions that every critical run of this action banks a guaranteed critical success for (owned `criticalLink` buyables). */
  criticalLinks(id: ActionId): readonly ActionId[] {
    return resolveEffects(this.config.buyables, this.state, id, this.factory).criticalLinks;
  }

  /** True when a completed run of this action can be critical now: by chance, by a Zero-day that is switched on, or by a banked success. */
  criticalPossible(id: ActionId): boolean {
    const { zeroDay, adminKey } = this.config.items;
    return (
      this.criticalChance() > 0 ||
      (this.state.zeroDaysOn && zeroDay?.actionId === id) ||
      (this.state.adminKeysOn && adminKey?.actionId === id) ||
      (this.state.bankedCriticals[id] ?? 0) > 0
    );
  }

  /**
   * The most critical successes one completed run of this action can have now: the whole part of the chance, one more while a fraction of a
   * chance remains, and one more while a Zero-day, Admin key or banked success can cover it. 0 when criticals are not possible.
   * Doubled while a `criticalExtraChance` buyable is owned (one possible extra per success).
   */
  maxCritsPerRun(id: ActionId): number {
    const chance = this.criticalChance();
    const { zeroDay, adminKey } = this.config.items;
    const covered =
      (this.state.zeroDaysOn && zeroDay?.actionId === id) ||
      (this.state.adminKeysOn && adminKey?.actionId === id) ||
      (this.state.bankedCriticals[id] ?? 0) > 0;
    const rolled = Math.floor(chance) + (chance % 1 > 0 ? 1 : 0) + (covered ? 1 : 0);
    // Each critical success may bring one extra (which does not roll again).
    return this.criticalExtraChance() > 0 ? rolled * 2 : rolled;
  }

  /**
   * The chain links an action holds now: what its runs have built up while Overclock is on (0 when Overclock is off, the rule has no chain,
   * or the chain is broken).
   */
  chainLinks(id: ActionId): number {
    const chain = this.activeOverclock(id)?.chain;
    return chain ? Math.min(chain.maxLinks, this.state.chains[id] ?? 0) : 0;
  }

  /**
   * How the start cost share of an action is scaled now: `factor` is `(1 - perLevel)^level` for every owned `startCostReduction` buyable of
   * the action, times `1 + links x nodesPerLink` while an Overclock chain is held; `atLeastOne` says a node cost that rounds down to 0 is
   * raised to 1 (a reduction is owned, so the cost must never vanish).
   */
  startCostScale(id: ActionId): { readonly factor: number; readonly atLeastOne: boolean } {
    const { startCostReductions } = resolveEffects(this.config.buyables, this.state, id, this.factory);
    const level = this.progression.actionLevel(this.state, id);
    let factor = 1;
    for (const perLevel of startCostReductions) factor *= (1 - perLevel) ** level;
    const chain = this.activeOverclock(id)?.chain;
    if (chain) factor *= 1 + this.chainLinks(id) * chain.nodesPerLink;
    return { factor, atLeastOne: startCostReductions.length > 0 };
  }

  /** Seconds of node income paid per node the start cost of this action destroys (0 without a Credit Siphon). */
  siphonSeconds(id: ActionId): number {
    return resolveEffects(this.config.buyables, this.state, id, this.factory).siphonSeconds;
  }

  /**
   * True while an action is running overclocked with an Overclock that stops heat from cooling. Then the cooldown stands still and Burn
   * leads cannot be used.
   */
  heatCoolingBlocked(): boolean {
    return this.config.actions.some(
      (a) => this.state.actions[a.id]?.running === true && this.activeOverclock(a.id)?.blocksHeatCooling === true,
    );
  }

  /** Levels added to an action's level for speed by buyables; its XP progress is not affected. */
  levelBonus(id: ActionId): number {
    return resolveLevelBonus(this.config.buyables, this.state, id, (source) => this.progression.sleeveLevel(this.state, source));
  }

  /**
   * Overclock for an action: its rule scaled by the strength of the owned Overclock upgrades, and whether the player has it on.
   * @returns the status, or `null` while the action's Overclock is not unlocked or the action has no Overclock rule (then there is no toggle)
   * @throws Error if the action id is unknown
   */
  overclockStatus(id: ActionId): OverclockStatus | null {
    const rule = this.definition(id).overclock;
    const owned = resolveEffects(this.config.buyables, this.state, id, this.factory);
    if (!rule || !owned.overclockUnlocked) return null;
    const chain = owned.chain;
    const strength = this.sleeveStats().overclockStrength;
    const on = this.state.overclocked[id] === true;
    return {
      on,
      blocksHeatCooling: rule.stopsHeatCooling === true,
      chain: chain
        ? {
            links: on ? Math.min(chain.maxLinks, this.state.chains[id] ?? 0) : 0,
            maxLinks: chain.maxLinks,
            rewardPerLink: chain.rewardPerLink * strength,
            nodesPerLink: chain.nodesPerLink,
          }
        : null,
      speedBonus: (rule.speedBonus ?? 0) * strength,
      rewardBonus: (rule.rewardBonus ?? 0) * strength,
      heatPerMinute: rule.heatPerMinute ?? 0,
      heatPerRunFactor: Math.min(rule.heatPerRunFactor ?? 1, this.sleeveStats().overclockHeatFactors[id] ?? Infinity),
      completionEffects: rule.completionEffects ?? [],
      alsoPays: rule.alsoPays ?? null,
      strength,
    };
  }

  /** Overclock for an action while the player has it switched on (what it does to the action now), or `null` while it is off or unavailable. */
  activeOverclock(id: ActionId): OverclockStatus | null {
    if (this.state.overclocked[id] !== true) return null;
    const status = this.overclockStatus(id);
    return status?.on ? status : null;
  }

  /**
   * Focus for an action: whether it is focused, and how many of the Focus slots are taken.
   * @returns the status, or `null` while the action's Focus is not unlocked (then there is no toggle)
   * @throws Error if the action id is unknown
   */
  focusStatus(id: ActionId): FocusStatus | null {
    this.definition(id);
    if (!resolveEffects(this.config.buyables, this.state, id, this.factory).focusUnlocked) return null;
    const { speedBonus, baseSlots } = this.config.focus;
    const slots = baseSlots + this.sleeveStats().extraFocusSlots;
    const on = this.state.focused[id] === true;
    const used = this.config.actions.reduce((n, a) => n + (this.state.focused[a.id] === true ? 1 : 0), 0);
    return { on, speedBonus, slots, used, canSwitchOn: on || used < slots };
  }

  /** Everything the speed factors of an action read: its levels (action level including the level bonus), the interface speed and the toggles. */
  private speedContext(id: ActionId): SpeedContext {
    const overclock = this.activeOverclock(id);
    const focus = this.state.focused[id] === true ? this.focusStatus(id) : null;
    return {
      actionId: id,
      actionLevel: this.progression.actionLevel(this.state, id) + this.levelBonus(id),
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
    const factor = bonus > 0 ? augmentXpFactor(this.state.actions[id]?.augments ?? {}, bonus) : 1;
    return factor === 1 ? base : base.mul(this.factory.fromNumber(factor));
  }

  /**
   * The most action XP one run can give now: `xpPerRun`, times the critical XP multiplier for each critical success the run can have at most. Used to
   * size a batch of runs so that no level threshold is crossed before its last run. @throws Error if the id is unknown
   */
  maxXpPerRun(id: ActionId): BigNum {
    const base = this.xpPerRun(id);
    const factor = Math.max(1, this.maxCritsPerRun(id) * this.criticalRule(id).xpMultiplier);
    return factor > 1 ? base.mul(this.factory.fromNumber(factor)) : base;
  }

  /** Fraction of its size the network grows by per second right now (fixed rates plus level-based rates of the growth buyables). */
  networkGrowthRate(): number {
    return resolveNetworkGrowth(this.config.buyables, this.state, (id) => this.progression.actionLevel(this.state, id));
  }

  /** Credits one network node delivers per second right now, after the payout multiplier. The heat tax is not part of it (it applies to the income, see below). */
  passiveCreditsPerNode(): BigNum {
    const stats = this.sleeveStats();
    return this.economy.passiveCreditsPerNode(stats.nodePayoutMultiplier, stats.nodePayoutBonus);
  }

  /** What one node delivers per second right now once the heat tax has taken its share: {@link DerivedStats.passiveCreditsPerNode} times the share kept. */
  taxedCreditsPerNode(): BigNum {
    return this.passiveCreditsPerNode().mul(this.factory.fromNumber(this.creditKeepFactor()));
  }

  /** Credits the network delivers per second right now: nodes times the per-node payout, then the heat tax on the whole. */
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
