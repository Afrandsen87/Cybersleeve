/** Public surface of the core module. */
export * from './types';
export { createConfig, validateConfig } from './config/config';
export { LevelRule } from './actions/level';
export { Snapshot } from './kernel/snapshot';
export { SPEED_FACTOR_IDS, createSpeedModifiers, levelFactor, speedFactors, speedMultiplier, effectiveDurationMs } from './actions/speed';
export { type FactorTerm, type SleeveStats, resolveEffects, resolveSleeveStats, earnedSpeedBeyond } from './effects/effects';
export { coolHeat, coolHeatBoosted, heatTaxFactor } from './heat/heat';
export { coolsNow, cycleMs, heatStopPoint, heatTaxShare, moleSpeedFactor } from './heat/heatModel';
export { applyCompletionEffects } from './actions/completion';
export { SCALAR_FIELDS, scalarValue } from './kernel/fields';
export { REWARDS, REWARD_KINDS, payReward, rewardOf } from './actions/rewards';
export { StartCosts } from './actions/startCosts';
export { RewardPayer } from './actions/rewardPayer';
export { EFFECT_TRAITS, traitsOf } from './effects/effectTraits';
export { Economy } from './economy/economy';
export { Inventory, itemCount } from './items/inventory';
export { Augments, augmentXpFactor } from './items/augments';
export { BackChannel } from './items/backChannel';
export { BurnLeads } from './items/burnLeads';
export { type CoolingPaceInputs, coolingPace } from './heat/heatPace';
export { ZeroDays } from './crits/zeroDays';
export { SkillShards } from './items/skillShards';
export { CriticalLinks } from './crits/criticalLinks';
export { ActionToggles } from './actions/actionToggles';
export { earnedSkillPoints } from './skills/skills';
export { ItemDrops } from './items/drops';
export {
  AUTOMATION_FEATURES,
  Automation,
  automationPointsEarned,
  isFeatureUnlocked,
  type AutomationControls,
  type AutomationFeature,
} from './automation/automation';
export { CritFeed } from './crits/critFeed';
export { LinkedPayouts } from './actions/linkedPayouts';
export { CriticalSuccesses, criticalRuleFor } from './crits/critical';
export { shiftWeights } from './items/rarityShift';
export { wholeOrders } from './kernel/curves';
export { isPointCurrency } from './kernel/currencies';
export type { RandomSource } from './kernel/sampling';
export { createClampOverflowPolicy } from './kernel/overflow';
export { Progression } from './actions/progression';
export { BuyableCaps } from './effects/buyableCaps';
export { ReflexArchive } from './resleeve/reflexArchive';
export { isActionCardPurchase } from './resleeve/resleeveCarry';
export { Shop } from './economy/shop';
export { SynthSleeves, synthCreditsPerSecond } from './synth/synthSleeves';
export { Resleever } from './resleeve/resleever';
export { allOf } from './resleeve/resleeve';
export { SleeveLevelGate } from './resleeve/sleeveLevelGate';
export { ResleeveGate, sleeveLevelsGateId } from './resleeve/resleeveGate';
export { CARRIED_OVER_ACTION_FIELDS, CARRIED_OVER_WALLET_FIELDS, createInitialState, resetForResleeve } from './save/state';
export type {
  ActionQueries,
  CorporationQueries,
  GameCommands,
  GameQueries,
  ItemCommands,
  ItemQueries,
  LevelQueries,
  ShopQueries,
  SkillQueries,
  SleeveQueries,
  StateQueries,
} from './engine/api';
export { type Diagnostics, silentDiagnostics } from './kernel/diagnostics';
export { DerivedStats } from './engine/stats';
export { ActionRunner } from './actions/actionRunner';
export { Corporation } from './corporation/corporation';
export { type CorporationEffectContext, applyCorporationEffect } from './corporation/corporationEffects';
export { CorporationLevels } from './corporation/corporationLevels';
export { NetworkSystem } from './economy/network';
export { createActionLookup } from './actions/actionLookup';
export { GameEngine } from './engine/engine';
export { SAVE_VERSION, serializeState, deserializeState } from './save/serialization';
export { migrateSave } from './save/migrate';
