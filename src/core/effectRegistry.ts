/**
 * @module core
 *
 * The registry of buyable effects: everything the game knows about one kind of effect, in one place.
 *
 * @remarks
 * One entry per kind of {@link BuyableEffect}, and the mapped type of {@link EFFECTS} makes the compiler demand an entry for every
 * kind. An entry says what the effect IS ({@link EffectTraits}), how its numbers are validated, and how it contributes to the two
 * things that buyables change directly: one action ({@link ActionAccumulator}) or the sleeve ({@link SleeveAccumulator}). The
 * resolvers in `effects.ts` loop over the owned buyables and call the hooks, so they contain no `switch` over kinds: adding a kind
 * means one union member in `types.ts` and one entry here. A kind whose only consumer is a dedicated query (network growth, the
 * level bonus, XP reductions, drop chance, the back channel) leaves both hooks out and is read by that query.
 */
import type { BigNum, NumberFactory } from '../numbers';
import { AUTOMATION_FEATURES } from './automation';
import { HEAT_EFFECTS } from './heatEffects';
import { itemCount } from './inventory';
import type { ActionId, BuyableDefinition, ChainRule, BuyableEffect, GameState, ItemDropRule, PaysActionRule } from './types';

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
  readonly state: Pick<GameState, 'network' | 'inventory'>;
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

const sleeveWide: EffectTraits = { needsAction: false, toggleable: false };
const corporate: EffectTraits = { needsAction: false, toggleable: false, corporate: true };
const perAction: EffectTraits = { needsAction: true, toggleable: false };

/** `ln(n)`, but never below 0 (so a network of 0 or 1 nodes adds nothing). */
function naturalLog(n: BigNum): number {
  const ln = n.log10() * Math.LN10;
  return Number.isFinite(ln) && ln > 0 ? ln : 0;
}

const none = (): void => {};

function factorAtLeastOne(e: { kind: string; factor: number }, { where, errors }: EffectContext): void {
  if (!(Number.isFinite(e.factor) && e.factor >= 1)) errors.push(`${where}: ${e.kind} factor must be >= 1`);
}

/** Every kind of effect, with its facts, validator and hooks. */
export const EFFECTS: { readonly [K in BuyableEffect['kind']]: EffectDefinition<Extract<BuyableEffect, { kind: K }>> } = {
  ...HEAT_EFFECTS,
  autoRun: {
    traits: { needsAction: true, toggleable: true },
    validate: none,
    action: (acc, _e, { switchedOff }) => {
      if (!switchedOff) acc.autoRun = true;
    },
  },
  overclockUnlock: {
    traits: perAction,
    validate: none,
    action: (acc) => {
      acc.overclockUnlocked = true;
    },
  },
  overclockChain: {
    traits: perAction,
    validate: ({ chain }, { where, errors }) => {
      if (!(Number.isInteger(chain.maxLinks) && chain.maxLinks >= 1)) errors.push(`${where}: chain maxLinks must be an integer >= 1`);
      if (!(Number.isFinite(chain.rewardPerLink) && chain.rewardPerLink > 0)) errors.push(`${where}: chain rewardPerLink must be > 0`);
      if (!(Number.isFinite(chain.nodesPerLink) && chain.nodesPerLink >= 0)) errors.push(`${where}: chain nodesPerLink must be >= 0`);
    },
    action: (acc, e) => {
      acc.chain = e.chain;
    },
  },
  focusUnlock: {
    traits: perAction,
    validate: none,
    action: (acc) => {
      acc.focusUnlocked = true;
    },
  },
  overclockStrength: {
    traits: sleeveWide,
    validate: (e, { where, errors }) => {
      if (!(Number.isFinite(e.perCopy) && e.perCopy > 0)) errors.push(`${where}: overclockStrength perCopy must be > 0`);
    },
    sleeve: (acc, e, { owned }) => {
      acc.overclockStrength += e.perCopy * owned;
    },
  },
  focusSlots: {
    traits: sleeveWide,
    validate: (e, { where, errors }) => {
      if (!(Number.isInteger(e.perCopy) && e.perCopy >= 1)) errors.push(`${where}: focusSlots perCopy must be an integer >= 1`);
    },
    sleeve: (acc, e, { owned }) => {
      acc.extraFocusSlots += e.perCopy * owned;
    },
  },
  automationPoints: {
    // read only by the Automation unit, which sums the copies itself
    traits: sleeveWide,
    validate: (e, { where, errors }) => {
      if (!(Number.isInteger(e.perCopy) && e.perCopy >= 1)) errors.push(`${where}: automationPoints perCopy must be an integer >= 1`);
    },
  },
  criticalChance: {
    traits: sleeveWide,
    validate: (e, { where, errors }) => {
      if (!(Number.isFinite(e.chance) && e.chance > 0 && e.chance <= 1)) errors.push(`${where}: criticalChance chance must be in (0, 1]`);
    },
    sleeve: (acc, e, { owned }) => {
      acc.criticalChance += e.chance * owned;
    },
  },
  rewardMultiplier: {
    traits: perAction,
    validate: factorAtLeastOne,
    action: (acc, e, { owned, factory }) => {
      acc.rewardMultiplier = acc.rewardMultiplier.mul(factory.fromNumber(e.factor).pow(owned));
    },
  },
  startCostReduction: {
    traits: perAction,
    validate: (e, { where, errors }) => {
      if (!(Number.isFinite(e.perLevel) && e.perLevel > 0 && e.perLevel < 1))
        errors.push(`${where}: startCostReduction perLevel must be in (0, 1)`);
    },
    action: (acc, e) => {
      acc.startCostReductions.push(e.perLevel);
    },
  },
  creditSiphon: {
    traits: perAction,
    validate: (e, { where, errors }) => {
      if (!(Number.isFinite(e.seconds) && e.seconds > 0)) errors.push(`${where}: creditSiphon seconds must be > 0`);
    },
    action: (acc, e) => {
      acc.siphonSeconds += e.seconds;
    },
  },
  criticalBoost: {
    traits: perAction,
    validate: factorAtLeastOne,
    action: (acc, e) => {
      acc.criticalFactor *= e.factor;
    },
  },
  criticalLink: {
    traits: perAction,
    validate: (e, { where, actionIds, errors }) => {
      if (!actionIds.has(e.targetActionId)) errors.push(`${where}: criticalLink refers to unknown action "${e.targetActionId}"`);
    },
    action: (acc, e) => {
      acc.criticalLinks.push(e.targetActionId);
    },
  },
  overclockHeatFactor: {
    traits: sleeveWide,
    validate: (e, ctx) => {
      factorAtLeastOne(e, ctx);
      if (!ctx.actionIds.has(e.targetActionId))
        ctx.errors.push(`${ctx.where}: overclockHeatFactor refers to unknown action "${e.targetActionId}"`);
    },
    sleeve: (acc, e) => {
      acc.overclockHeatFactors[e.targetActionId] = Math.min(acc.overclockHeatFactors[e.targetActionId] ?? Infinity, e.factor);
    },
  },
  criticalExtraChance: {
    traits: sleeveWide,
    validate: (e, { where, errors }) => {
      if (!(Number.isFinite(e.chance) && e.chance > 0 && e.chance <= 1))
        errors.push(`${where}: criticalExtraChance chance must be in (0, 1]`);
    },
    sleeve: (acc, e, { owned }) => {
      acc.criticalExtraChance = Math.min(1, acc.criticalExtraChance + e.chance * owned);
    },
  },
  criticalRewardMultiplier: {
    traits: sleeveWide,
    validate: factorAtLeastOne,
    sleeve: (acc, e, { owned }) => {
      acc.criticalRewardFactor *= e.factor ** owned;
    },
  },
  paysActionReward: {
    traits: sleeveWide,
    validate: (e, { where, actionIds, errors }) => {
      for (const id of [e.sourceActionId, e.targetActionId]) {
        if (!actionIds.has(id)) errors.push(`${where}: paysActionReward refers to unknown action "${id}"`);
      }
      if (!(Number.isFinite(e.chance) && e.chance > 0 && e.chance <= 1)) errors.push(`${where}: paysActionReward chance must be in (0, 1]`);
    },
    sleeve: (acc, e) => {
      acc.paysActions.push({ sourceActionId: e.sourceActionId, targetActionId: e.targetActionId, chance: e.chance });
    },
  },
  rewardMultiplierFromActionLevel: {
    // read only by `levelRewardFactor.ts` (through `DerivedStats.rewardMultiplier`)
    traits: sleeveWide,
    validate: (e, { where, actionIds, errors }) => {
      for (const id of [e.sourceActionId, e.targetActionId]) {
        if (!actionIds.has(id)) errors.push(`${where}: rewardMultiplierFromActionLevel refers to unknown action "${id}"`);
      }
      if (!(Number.isFinite(e.coefficient) && e.coefficient > 0))
        errors.push(`${where}: rewardMultiplierFromActionLevel coefficient must be > 0`);
      if (!(Number.isFinite(e.scale) && e.scale > 0)) errors.push(`${where}: rewardMultiplierFromActionLevel scale must be > 0`);
    },
  },
  interfaceSpeedFromAugmentRarities: {
    traits: sleeveWide,
    validate: (e, { where, errors }) => {
      if (!(Number.isFinite(e.perRarity) && e.perRarity > 0))
        errors.push(`${where}: interfaceSpeedFromAugmentRarities perRarity must be > 0`);
    },
    sleeve: (acc, e, { augmentRaritiesHeld }) => {
      acc.interfaceSkillFactor *= 1 + e.perRarity * augmentRaritiesHeld();
    },
  },
  itemDrop: {
    traits: perAction,
    validate: ({ drop }, { where, itemIds, rarityIds, raritylessItemIds, errors }) => {
      if (!itemIds.has(drop.itemId)) errors.push(`${where}: drop refers to unknown item "${drop.itemId}"`);
      if (!(Number.isFinite(drop.chance) && drop.chance >= 0 && drop.chance <= 1))
        errors.push(`${where}: drop chance must be between 0 and 1`);
      if (raritylessItemIds.has(drop.itemId)) {
        if (drop.rarityWeights !== undefined) errors.push(`${where}: an item without rarity takes no rarity weights`);
        return;
      }
      if (drop.rarityWeights === undefined) {
        errors.push(`${where}: a drop of an item with rarities needs rarity weights`);
        return;
      }
      let total = 0;
      for (const [rarity, weight] of Object.entries(drop.rarityWeights)) {
        if (!rarityIds.has(rarity)) errors.push(`${where}: drop weights refer to unknown rarity "${rarity}"`);
        if (!(Number.isFinite(weight) && weight >= 0)) errors.push(`${where}: drop weight of "${rarity}" must be >= 0`);
        else total += weight;
      }
      if (!(total > 0)) errors.push(`${where}: at least one drop weight must be > 0`);
    },
    action: (acc, e) => {
      acc.drops.push(e.drop);
    },
  },
  rarityShiftFromProficiency: {
    traits: perAction,
    validate: (e, { where, errors }) => {
      if (!(Number.isFinite(e.fractionPerOrder) && e.fractionPerOrder > 0 && e.fractionPerOrder <= 1)) {
        errors.push(`${where}: fractionPerOrder must be in (0, 1]`);
      }
    },
    action: (acc, e) => {
      acc.rarityShifts.push(e.fractionPerOrder);
    },
  },
  interfaceSpeedMultiplier: {
    traits: sleeveWide,
    validate: factorAtLeastOne,
    sleeve: (acc, e, { owned }) => {
      acc.interfaceSkillFactor *= e.factor ** owned;
    },
  },
  heatCooldownSpeed: {
    traits: sleeveWide,
    validate: factorAtLeastOne,
    sleeve: (acc, e, { owned }) => {
      acc.heatCooldownSpeed *= e.factor ** owned;
    },
  },
  actionXpReductionFromSleeveLevel: {
    traits: sleeveWide,
    validate: (e, { where, errors }) => {
      if (!(Number.isFinite(e.remainingPerOrder) && e.remainingPerOrder > 0 && e.remainingPerOrder < 1))
        errors.push(`${where}: actionXpReductionFromSleeveLevel remainingPerOrder must be in (0, 1)`);
      if (!(Number.isFinite(e.maxReduction) && e.maxReduction >= 0 && e.maxReduction < 1))
        errors.push(`${where}: actionXpReductionFromSleeveLevel maxReduction must be in [0, 1)`);
    },
  },
  synthSleeves: { traits: sleeveWide, validate: none },
  unlockSleeveLevels: { traits: sleeveWide, validate: none },
  unlocksCorporation: { traits: sleeveWide, validate: none },
  addsCorporationEffect: { traits: corporate, validate: none },
  corporateRank: {
    traits: corporate,
    validate: (e, { where, errors }) => {
      if (!(Number.isInteger(e.amount) && e.amount >= 1)) errors.push(`${where}: corporate rank amount must be an integer >= 1`);
    },
  },
  unlocksAutomation: {
    // read only by the Automation unit, which looks for the owned buyable of each feature
    traits: sleeveWide,
    validate: (e, { where, errors }) => {
      if (!AUTOMATION_FEATURES.includes(e.feature))
        errors.push(`${where}: unlocksAutomation names an unknown feature "${String(e.feature)}"`);
    },
  },
  placeholder: { traits: sleeveWide, validate: none },
  heatCooldownAmountFromSleeveLevel: {
    traits: sleeveWide,
    validate: (e, { where, actionIds, errors }) => {
      if (!(Number.isFinite(e.perLevel) && e.perLevel > 0)) errors.push(`${where}: heat per sleeve level must be > 0`);
      if (!actionIds.has(e.sourceActionId)) errors.push(`${where}: heat per sleeve level refers to unknown action "${e.sourceActionId}"`);
    },
    sleeve: (acc, e, { owned, sleeveLevelOf }) => {
      acc.extraHeatCooldownAmount += e.perLevel * sleeveLevelOf(e.sourceActionId) * owned;
    },
  },
  hackingProficiencyMultiplier: {
    traits: sleeveWide,
    validate: factorAtLeastOne,
    sleeve: (acc, e, { owned }) => {
      acc.hackingProficiencyFactor *= e.factor ** owned;
    },
  },
  actionXpReduction: {
    traits: sleeveWide,
    validate: (e, { where, errors }) => {
      if (!(Number.isFinite(e.amount) && e.amount > 0 && e.amount < 1)) errors.push(`${where}: actionXpReduction amount must be in (0, 1)`);
    },
  },
  runsPerSleeveXpReduction: {
    traits: sleeveWide,
    validate: (e, { where, errors }) => {
      if (!(Number.isInteger(e.perCopy) && e.perCopy >= 1))
        errors.push(`${where}: runsPerSleeveXpReduction perCopy must be an integer >= 1`);
      if (!(Number.isInteger(e.minRuns) && e.minRuns >= 1))
        errors.push(`${where}: runsPerSleeveXpReduction minRuns must be an integer >= 1`);
    },
  },
  itemDropChanceMultiplier: {
    traits: sleeveWide,
    validate: (e, ctx) => {
      factorAtLeastOne(e, ctx);
      if (!ctx.itemIds.has(e.itemId)) ctx.errors.push(`${ctx.where}: drop chance refers to unknown item "${e.itemId}"`);
    },
  },
  nodePayoutFromItems: {
    traits: sleeveWide,
    validate: (e, { where, itemIds, rarityIds, errors }) => {
      if (!itemIds.has(e.itemId)) errors.push(`${where}: refers to unknown item "${e.itemId}"`);
      if (!rarityIds.has(e.rarityId)) errors.push(`${where}: refers to unknown rarity "${e.rarityId}"`);
      if (!(Number.isFinite(e.perItem) && e.perItem >= 0)) errors.push(`${where}: perItem must be >= 0`);
    },
    sleeve: (acc, e, { owned, state }) => {
      acc.nodePayoutFactor *= (1 + e.perItem * itemCount(state, e.itemId, e.rarityId)) ** owned;
    },
  },
  backChannel: {
    traits: sleeveWide,
    validate: (e, { where, itemIds, rarityIds, errors }) => {
      if (!itemIds.has(e.itemId)) errors.push(`${where}: refers to unknown item "${e.itemId}"`);
      if (!rarityIds.has(e.rarityId)) errors.push(`${where}: refers to unknown rarity "${e.rarityId}"`);
      if (!(Number.isFinite(e.molesPerItem) && e.molesPerItem > 0)) errors.push(`${where}: molesPerItem must be > 0`);
      if (!(Number.isFinite(e.cooldownBoost) && e.cooldownBoost >= 0)) errors.push(`${where}: cooldownBoost must be >= 0`);
    },
    sleeve: (acc, e, { owned }) => {
      acc.heatCooldownBoost += e.cooldownBoost * owned;
    },
  },
  backChannelRarityScaling: {
    traits: sleeveWide,
    validate: (e, { where, itemIds, errors }) => {
      if (!itemIds.has(e.itemId)) errors.push(`${where}: refers to unknown item "${e.itemId}"`);
    },
  },
  backChannelMultiplier: {
    traits: sleeveWide,
    validate: (e, { where, itemIds, errors }) => {
      if (!itemIds.has(e.itemId)) errors.push(`${where}: refers to unknown item "${e.itemId}"`);
      if (!(Number.isFinite(e.factor) && e.factor >= 1)) errors.push(`${where}: factor must be >= 1`);
    },
  },
  rarityWeightBonus: {
    traits: sleeveWide,
    validate: (e, { where, itemIds, errors }) => {
      if (!itemIds.has(e.itemId)) errors.push(`${where}: refers to unknown item "${e.itemId}"`);
      if (!(Number.isFinite(e.amount) && e.amount > 0)) errors.push(`${where}: amount must be > 0`);
    },
  },
  interfaceSpeed: {
    traits: sleeveWide,
    validate: (e, { where, errors }) => {
      if (!(Number.isFinite(e.amount) && e.amount >= 0)) errors.push(`${where}: interface speed amount must be >= 0`);
    },
    sleeve: (acc, e, { owned }) => {
      acc.interfaceBoosts += e.amount * owned;
    },
  },
  accessLevel: {
    traits: sleeveWide,
    validate: (e, { where, errors }) => {
      if (!(Number.isInteger(e.amount) && e.amount >= 1)) errors.push(`${where}: access level amount must be an integer >= 1`);
    },
    sleeve: (acc, e, { owned }) => {
      acc.accessLevel += e.amount * owned;
    },
  },
  nodePayoutMultiplier: {
    traits: sleeveWide,
    validate: factorAtLeastOne,
    sleeve: (acc, e, { owned }) => {
      acc.nodePayoutFactor *= e.factor ** owned;
    },
  },
  iceRatingMultiplier: {
    traits: sleeveWide,
    validate: factorAtLeastOne,
    sleeve: (acc, e, { owned, factory }) => {
      acc.iceRatingFactor = acc.iceRatingFactor.mul(factory.fromNumber(e.factor).pow(owned));
    },
  },
  iceRatingFromActionLevel: {
    traits: sleeveWide,
    validate: (e, { where, actionIds, errors }) => {
      if (!(Number.isFinite(e.perLevel) && e.perLevel > 0)) errors.push(`${where}: ICE Rating per level must be > 0`);
      if (!actionIds.has(e.sourceActionId)) errors.push(`${where}: ICE Rating refers to unknown action "${e.sourceActionId}"`);
    },
    sleeve: (acc, e, { owned, factory, actionLevelOf }) => {
      acc.iceRatingBonus = acc.iceRatingBonus.add(factory.fromNumber(e.perLevel * actionLevelOf(e.sourceActionId) * owned));
    },
  },
  networkGrowth: {
    traits: sleeveWide,
    validate: (e, { where, errors }) => {
      if (!(Number.isFinite(e.ratePerSecond) && e.ratePerSecond >= 0)) errors.push(`${where}: network growth rate must be >= 0`);
    },
  },
  networkGrowthFromActionLevel: {
    traits: sleeveWide,
    validate: (e, { where, actionIds, errors }) => {
      if (!(Number.isFinite(e.percentPerLevel) && e.percentPerLevel >= 0))
        errors.push(`${where}: network growth percent per level must be >= 0`);
      if (!actionIds.has(e.sourceActionId)) errors.push(`${where}: network growth refers to unknown action "${e.sourceActionId}"`);
    },
  },
  interfaceSpeedPerLnNodes: {
    traits: sleeveWide,
    validate: (e, { where, errors }) => {
      if (!(Number.isFinite(e.perLn) && e.perLn >= 0)) errors.push(`${where}: perLn must be >= 0`);
    },
    sleeve: (acc, e, { owned, state }) => {
      acc.interfaceNetworkFactor *= (1 + e.perLn * naturalLog(state.network)) ** owned;
    },
  },
  levelBonusFromSleeveLevel: {
    traits: sleeveWide,
    validate: (e, { where, actionIds, errors }) => {
      for (const id of [e.sourceActionId, e.targetActionId]) {
        if (!actionIds.has(id)) errors.push(`${where}: level bonus refers to unknown action "${id}"`);
      }
    },
  },
  sleeveXpReduction: {
    traits: sleeveWide,
    validate: (e, { where, actionIds, errors }) => {
      if (!actionIds.has(e.sourceActionId)) errors.push(`${where}: XP reduction refers to unknown action "${e.sourceActionId}"`);
      if (!(Number.isFinite(e.perLevel) && e.perLevel > 0)) errors.push(`${where}: XP reduction perLevel must be > 0`);
      if (!(Number.isFinite(e.maxReduction) && e.maxReduction >= 0 && e.maxReduction < 1)) {
        errors.push(`${where}: XP reduction maxReduction must be in [0, 1)`);
      }
    },
  },
};

/**
 * The registry entry of a buyable's effect, typed loosely so a hook can be called without knowing the kind.
 *
 * Called by: `effects.ts`, `effectTraits.ts`, `config.ts`.
 *
 * @param buyable the buyable
 */
export function definitionOf(buyable: Pick<BuyableDefinition, 'effect'>): EffectDefinition<BuyableEffect> {
  return EFFECTS[buyable.effect.kind] as EffectDefinition<BuyableEffect>;
}
