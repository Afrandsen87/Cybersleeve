/** Public surface of the core module. */
export * from './types';
export { type ConfigOverrides, createConfig, validateConfig } from './config';
export { LevelRule } from './level';
export {
  type SpeedContext,
  type SpeedModifier,
  createSpeedModifiers,
  levelFactor,
  speedMultiplier,
  effectiveDurationMs,
} from './speed';
export {
  type ActionEffects,
  type SleeveStats,
  resolveEffects,
  resolveLevelBonus,
  resolveNetworkGrowth,
  resolveSleeveStats,
} from './effects';
export { type HeatCooldownState, coolHeat, heatTaxFactor } from './heat';
export { applyCompletionEffects } from './completion';
export { Economy } from './economy';
export { type OverflowPolicy, createClampOverflowPolicy } from './overflow';
export { Progression } from './progression';
export { Shop, type PurchaseResult } from './shop';
export { type ResleevePolicy, alwaysAllowResleeve } from './resleeve';
export { createInitialState, resetForNewGame, resetForResleeve } from './state';
export { GameEngine, type EngineDependencies } from './engine';
export { SAVE_VERSION, serializeState, deserializeState } from './serialization';
