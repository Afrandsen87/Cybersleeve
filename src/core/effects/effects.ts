/**
 * @module core
 *
 * Facade over the effect resolvers, so imports of `effects/effects` stay stable.
 *
 * Called by: `engine/*`, `core/index.ts`. Calls: nothing (re-exports `actionResolver`, `sleeveResolver`, `queries`, `sleeveStatsTypes`).
 */
export { type ActionEffects, resolveEffects } from './actionResolver';
export { earnedSpeedBeyond, resolveSleeveStats } from './sleeveResolver';
export type { FactorTerm, SleeveStats } from './sleeveStatsTypes';
export { resolveDropChanceFactor, resolveLevelBonus, resolveNetworkGrowth } from './queries';
