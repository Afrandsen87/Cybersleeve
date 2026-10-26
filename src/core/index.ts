/** Public surface of the core module. */
export * from './types';
export { type ConfigOverrides, createConfig, validateConfig } from './config';
export { LevelRule } from './level';
export { Snapshot } from './snapshot';
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
} from './speed';
export {
  type ActionEffects,
  type BackChannelRule,
  type FactorTerm,
  type SleeveStats,
  resolveEffects,
  resolveLevelBonus,
  resolveNetworkGrowth,
  resolveSleeveStats,
  earnedSpeedBeyond,
} from './effects';
export { type BoostedCooldownState, type HeatCooldownState, coolHeat, coolHeatBoosted, heatTaxFactor } from './heat';
export { applyCompletionEffects } from './completion';
export { SCALAR_FIELDS, type ScalarField } from './fields';
export { type RewardDescriptor, REWARDS, REWARD_KINDS, payReward, rewardOf } from './rewards';
export { EFFECT_TRAITS, type EffectTraits, assertNever, traitsOf } from './effectTraits';
export { Economy } from './economy';
export { Inventory, itemCount } from './inventory';
export { Augments, augmentXpFactor } from './augments';
export { BackChannel } from './backChannel';
export { BurnLeads } from './burnLeads';
export { ZeroDays, type CriticalKeyKind } from './zeroDays';
export { SkillShards } from './skillShards';
export { CriticalLinks, type CriticalLinkSource } from './criticalLinks';
export { ActionToggles, type FocusStatus, type ModeStatuses, type OverclockStatus, type ChainStatus } from './actionToggles';
export { INFINITY, saturate } from './infinity';
export { EFFECTS, definitionOf, type EffectDefinition } from './effectRegistry';
export { earnedSkillPoints } from './skills';
export { ItemDrops, type DropRules } from './drops';
export {
  AUTOMATION_FEATURES,
  Automation,
  type AutomationControls,
  type AutomationFeature,
  type AutomationState,
  createAutomationState,
} from './automation';
export { CRIT_WINDOW_MS, CritFeed, type RecentCrits } from './critFeed';
export { CriticalSuccesses, criticalRuleFor, type CriticalBatch, type CriticalChanceSource } from './critical';
export { shiftWeights, wholeOrders } from './rarityShift';
export { type RandomSource, binomial, multinomial } from './sampling';
export { type OverflowPolicy, createClampOverflowPolicy } from './overflow';
export { Progression } from './progression';
export { Shop, type PurchaseResult } from './shop';
export { type ResleevePolicy, alwaysAllowResleeve } from './resleeve';
export { CARRIED_OVER_ACTION_FIELDS, createInitialState, resetForNewGame, resetForResleeve } from './state';
export type {
  ActionQueries,
  ActivateResult,
  GameCommands,
  GameQueries,
  ShopQueries,
  SleeveQueries,
  StateQueries,
} from './api';
export { type Diagnostics, silentDiagnostics } from './diagnostics';
export { DerivedStats } from './stats';
export { ActionRunner } from './actionRunner';
export { NetworkSystem } from './network';
export { coolDownHeat, decayLegend } from './cooldowns';
export { type ActionLookup, createActionLookup } from './actionLookup';
export { GameEngine, type EngineDependencies } from './engine';
export { SAVE_VERSION, serializeState, deserializeState } from './serialization';
