/** Public surface of the core module. */
export * from './types';
export { type ConfigOverrides, createConfig, validateConfig } from './config/config';
export { LevelRule } from './actions/level';
export { Snapshot } from './kernel/snapshot';
export {
  type SpeedContext,
  type SpeedFactor,
  type SpeedModifier,
  SPEED_FACTOR_IDS,
  createSpeedModifiers,
  levelFactor,
  speedFactors,
  speedMultiplier,
  effectiveDurationMs,
} from './actions/speed';
export {
  type ActionEffects,
  type FactorTerm,
  type SleeveStats,
  resolveEffects,
  resolveLevelBonus,
  resolveNetworkGrowth,
  resolveSleeveStats,
  earnedSpeedBeyond,
} from './effects/effects';
export { type BoostedCooldownState, type HeatCooldownState, coolHeat, coolHeatBoosted, heatTaxFactor } from './heat/heat';
export { coolsNow, cycleMs, heatStopPoint, heatTaxShare, moleSpeedFactor } from './heat/heatModel';
export { applyCompletionEffects } from './actions/completion';
export { SCALAR_FIELDS, type ScalarField } from './kernel/fields';
export { type RewardDescriptor, REWARDS, REWARD_KINDS, DEFAULT_REWARD_KIND, payReward, rewardOf, wholeRunAmount } from './actions/rewards';
export { StartCosts } from './actions/startCosts';
export { RewardPayer, type RewardMultipliers } from './actions/rewardPayer';
export { EFFECT_TRAITS, type EffectTraits, assertNever, traitsOf } from './effects/effectTraits';
export { Economy } from './economy/economy';
export { Inventory, itemCount } from './items/inventory';
export { Augments, augmentXpFactor } from './items/augments';
export { BackChannel } from './items/backChannel';
export type { BackChannelRule } from './items/leverageEffects';
export { BurnLeads } from './items/burnLeads';
export { type CoolingPace, type CoolingPaceInputs, coolingPace } from './heat/heatPace';
export { ZeroDays, type CriticalKeyKind } from './crits/zeroDays';
export { SkillShards } from './items/skillShards';
export { CriticalLinks, type CriticalLinkSource } from './crits/criticalLinks';
export { ActionToggles, type FocusStatus, type ModeStatuses, type OverclockStatus, type ChainStatus } from './actions/actionToggles';
export { INFINITY, saturate } from './kernel/infinity';
export { EFFECTS, definitionOf, type EffectDefinition } from './effects/effectRegistry';
export { earnedSkillPoints } from './skills/skills';
export { ItemDrops, type DropRules } from './items/drops';
export {
  AUTOMATION_FEATURES,
  Automation,
  automationPointsEarned,
  isFeatureUnlocked,
  unlockingBuyable,
  type AutomationShop,
  type AutomationControls,
  type AutomationFeature,
  type AutomationState,
  createAutomationState,
} from './automation/automation';
export { CRIT_WINDOW_MS, CritFeed, type RecentCrits } from './crits/critFeed';
export { LinkedPayouts, type LinkedPayout, type LinkedPayoutRules } from './actions/linkedPayouts';
export { CriticalSuccesses, criticalRuleFor, type CriticalBatch, type CriticalChanceSource } from './crits/critical';
export { shiftWeights } from './items/rarityShift';
export { bigOrders, logScaled, orders, wholeOrders } from './kernel/curves';
export { CURRENCIES, CURRENCY_IDS, DEFAULT_CURRENCY, type CurrencyDescriptor, currencyInfo, isPointCurrency } from './kernel/currencies';
export { type RandomSource, binomial, multinomial } from './kernel/sampling';
export { type OverflowPolicy, createClampOverflowPolicy } from './kernel/overflow';
export { Progression } from './actions/progression';
export { BuyableCaps } from './effects/buyableCaps';
export { ReflexArchive, type Steppable } from './resleeve/reflexArchive';
export { isActionCardPurchase } from './resleeve/resleeveCarry';
export { Shop, type PurchaseListener, type PurchaseResult } from './economy/shop';
export { euphoriaReduction } from './sleeve/sleeveEuphoria';
export { type SynthIncome, SynthSleeves, synthCreditsPerSecond } from './synth/synthSleeves';
export { Resleever } from './resleeve/resleever';
export { type ResleevePolicy, alwaysAllowResleeve } from './resleeve/resleeve';
export { ResleeveGate, sleeveLevelsGateId } from './resleeve/resleeveGate';
export {
  CARRIED_OVER_ACTION_FIELDS,
  CARRIED_OVER_BUYABLE_CURRENCIES,
  createInitialState,
  resetForNewGame,
  resetForResleeve,
} from './save/state';
export type {
  ActionCommands,
  ActionQueries,
  ActivateResult,
  CorporationCommands,
  CorporationQueries,
  GameCommands,
  GameQueries,
  ItemCommands,
  ItemQueries,
  LevelQueries,
  ShopCommands,
  ShopQueries,
  SkillQueries,
  SleeveCommands,
  TestAidCommands,
  SleeveQueries,
  StateQueries,
} from './engine/api';
export { type Diagnostics, silentDiagnostics } from './kernel/diagnostics';
export { DerivedStats } from './engine/stats';
export { ActionRunner } from './actions/actionRunner';
export { Corporation } from './corporation/corporation';
export { type CorporationEffectContext, CORPORATION_EFFECTS, applyCorporationEffect } from './corporation/corporationEffects';
export { createCorporationState } from './corporation/corporationState';
export { CorporationLevels } from './corporation/corporationLevels';
export { NetworkSystem } from './economy/network';
export { coolDownHeat, decayLegend } from './heat/cooldowns';
export { type ActionLookup, createActionLookup } from './actions/actionLookup';
export { GameEngine, type EngineDependencies } from './engine/engine';
export { SAVE_VERSION, serializeState, deserializeState } from './save/serialization';
