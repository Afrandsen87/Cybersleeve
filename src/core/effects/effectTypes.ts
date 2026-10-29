/**
 * @module core
 *
 * The shapes the effect registry is built from: traits, the two accumulators the hooks write into, the hook contexts and
 * {@link EffectDefinition}.
 *
 * @remarks
 * Kept apart from the table so that the entry files (`effects/entries/*`, `heat/heatEffects.ts`, `resleeve/resleeveEffects.ts`) can import
 * the types without importing the registry that imports them. Called by: the entry files, `effectRegistry.ts`, `actionResolver.ts`, `sleeveResolver.ts`.
 */
import type { BigNum, NumberFactory } from '../../numbers';
import type { ActionId, BuyableEffect, ChainRule, ItemDropRule, PaysActionRule, StateSlice } from '../types';

/** Facts about one kind of effect. */
export interface EffectTraits {
  /** The effect changes the action the buyable belongs to, so the buyable must name an `actionId`. */
  readonly needsAction: boolean;
  /** Once owned, clicking the buyable switches the effect on or off instead of buying another copy. */
  readonly toggleable: boolean;
  /** The buyable belongs to the corporation: it is shown in the Asset Acquisition widget, not in the Sleeve widgets. Default: false. */
  readonly corporate?: boolean;
}

/** What owned effects add up to for one action (the running result of the action hooks). */
export interface ActionAccumulator {
  autoRun: boolean;
  /** The Overclock toggle of the action is unlocked. */
  overclockUnlocked: boolean;
  /** The Focus toggle of the action is unlocked. */
  focusUnlocked: boolean;
  /** The chain an owned `overclockChain` buyable adds to the action's Overclock, or `null`. */
  chain: ChainRule | null;
  rewardMultiplier: BigNum;
  /** What the critical success multipliers of the action are multiplied by (starts at 1). */
  criticalFactor: number;
  /** The actions that every critical run of this action banks a guaranteed critical success for. */
  criticalLinks: ActionId[];
  /** The `perLevel` of every owned `startCostReduction` buyable of the action. */
  startCostReductions: number[];
  /** Seconds of node income paid per node destroyed by the start cost (0 without a `creditSiphon`). */
  siphonSeconds: number;
  drops: ItemDropRule[];
  rarityShifts: number[];
}

/** What owned effects add up to for the sleeve (the running result of the sleeve hooks). Plain factors start at 1, amounts at 0. */
export interface SleeveAccumulator {
  accessLevel: number;
  interfaceBoosts: number;
  interfaceNetworkFactor: number;
  /** Base ICE Rating added on top of the earned value (before the multipliers). */
  iceRatingBonus: BigNum;
  /** What the `iceRatingMultiplier` buyables multiply the base ICE Rating by (starts at 1). */
  iceRatingFactor: BigNum;
  nodePayoutFactor: number;
  interfaceSkillFactor: number;
  hackingProficiencyFactor: number;
  heatCooldownSpeed: number;
  heatCooldownBoost: number;
  /** Heat removed per cooldown cycle on top of `sleeve.heatCooldownAmount`. */
  extraHeatCooldownAmount: number;
  /** Heat each Burn lead takes away on top of its percentage (0 without `burnLeadFlatHeat`). */
  burnLeadFlatHeat: number;
  /** How many times as fast heat cools while no action is in progress (1 without `idleHeatCooldown`). */
  idleHeatCooldown: number;
  /** The actions that still count as "no action in progress" while running without Overclock (`idleHeatCooldownAction`). */
  idleHeatCooldownActions: ActionId[];
  /** The `bonusPerOrder` of `moleAggregation`, or `null` while it is not owned. */
  moleAggregation: number | null;
  /** The largest share of node income the heat tax may take (1 = no cap; `heatTaxCap` lowers it). */
  heatTaxCap: number;
  criticalChance: number;
  /** The `paysActionReward` rules: each completed run of a source action may also pay one reward of a target action. */
  paysActions: PaysActionRule[];
  /** Chance (0..1) that a critical success brings one extra, summed over `criticalExtraChance` buyables. */
  criticalExtraChance: number;
  /** What the `criticalRewardMultiplier` buyables multiply the reward of every critical success by (starts at 1). */
  criticalRewardFactor: number;
  /** How strong every Overclock is: 1, plus `perCopy` for each copy of an Overclock strength buyable. */
  overclockStrength: number;
  /** Focus slots bought on top of the base slots. */
  extraFocusSlots: number;
  /** Several Focus slots may sit on one action (the player owns a `focusStacking` buyable). */
  focusStacking: boolean;
  /** What action XP is multiplied by while an action is behind the best synthetic sleeve's level on it (1 without Neural Mirror). */
  synthXpFactor: number;
  /** The lowest heat factor of Overclock set by `overclockHeatFactor` buyables, by action. */
  overclockHeatFactors: Record<ActionId, number>;
}

/** What an action hook may look at besides the effect. */
export interface ActionHookContext {
  /** Copies of the buyable owned (>= 1). */
  readonly owned: number;
  /** The player has switched this (toggleable) buyable off. */
  readonly switchedOff: boolean;
  readonly factory: NumberFactory;
}

/** What a sleeve hook may look at besides the effect. */
export interface SleeveHookContext {
  /** Copies of the buyable owned (>= 1). */
  readonly owned: number;
  readonly state: StateSlice<'network' | 'inventory' | 'synths'>;
  readonly factory: NumberFactory;
  /** Plain action level of an action (without level bonuses). */
  readonly actionLevelOf: (actionId: ActionId) => number;
  /** Sleeve level of an action. */
  readonly sleeveLevelOf: (actionId: ActionId) => number;
  /** How many distinct rarities have at least one augment applied on any action. */
  readonly augmentRaritiesHeld: () => number;
}

/** What a validator may look at besides the effect itself. */
export interface EffectContext {
  /** Prefix for messages, e.g. `buyable "x"`. */
  readonly where: string;
  readonly actionIds: ReadonlySet<string>;
  readonly itemIds: ReadonlySet<string>;
  readonly rarityIds: ReadonlySet<string>;
  /** The items that have no rarity (`ItemDefinition.hasRarity: false`). */
  readonly raritylessItemIds: ReadonlySet<string>;
  /** Every buyable id of the content. */
  readonly buyableIds: ReadonlySet<string>;
  readonly errors: string[];
}

/** Everything the game knows about one kind of effect. */
export interface EffectDefinition<E extends BuyableEffect> {
  readonly traits: EffectTraits;
  /** Reports invalid numbers and unknown references of an effect of this kind (pushes into `ctx.errors`). */
  validate(effect: E, ctx: EffectContext): void;
  /** Adds one owned buyable of this kind (all its copies) to the effects on its action. */
  action?(acc: ActionAccumulator, effect: E, ctx: ActionHookContext): void;
  /** Adds one owned buyable of this kind (all its copies) to the sleeve's stats. */
  sleeve?(acc: SleeveAccumulator, effect: E, ctx: SleeveHookContext): void;
}
