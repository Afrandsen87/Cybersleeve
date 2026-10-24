/**
 * @module core
 *
 * Speed multiplier: a product of independent, pluggable modifiers built from the configuration.
 */
import type { ActionId, GameConfig, LevelScaling } from './types';

/** Inputs a modifier may read. Extend this (not the callers of the modifiers) when new factors appear. */
export interface SpeedContext {
  /** The action being run. */
  readonly actionId: ActionId;
  /** Level of the action being run. */
  readonly actionLevel: number;
  /** Sleeve level of the action being run. */
  readonly sleeveLevel: number;
  /** Interface speed of the sleeve (a plain multiplier, 1 = no change). */
  readonly interfaceSpeed: number;
}

/** One factor of the speed multiplier. */
export interface SpeedModifier {
  /** Stable identifier (used in tests and, later, UI breakdowns). */
  readonly id: string;
  /** Factor contributed to the multiplier; must be > 0. */
  factor(context: SpeedContext): number;
}

/**
 * Multiplier worth of a level under a scaling rule.
 *
 * Called by: the modifiers built in {@link createSpeedModifiers}.
 *
 * @param scaling the scaling rule
 * @param level level (integer >= 1)
 * @returns `1 + (level - 1) * perLevel` (linear) or `base ^ (level - 1)` (exponential)
 */
export function levelFactor(scaling: LevelScaling, level: number): number {
  return scaling.kind === 'linear' ? 1 + (level - 1) * scaling.perLevel : scaling.base ** (level - 1);
}

/**
 * Builds the speed modifiers described by the configuration:
 * action level, sleeve level, interface speed and the global speed lever.
 *
 * Called by: `app/createGame.ts`.
 *
 * @param config game configuration (reads `speed`, `global.speedMultiplier` and per-action overrides)
 * @returns the modifier list to hand to the engine
 */
export function createSpeedModifiers(config: Pick<GameConfig, 'actions' | 'speed' | 'global'>): readonly SpeedModifier[] {
  const overrides = new Map<ActionId, LevelScaling>();
  for (const a of config.actions) if (a.speedScaling) overrides.set(a.id, a.speedScaling);
  return [
    {
      id: 'action-level',
      factor: (c) => levelFactor(overrides.get(c.actionId) ?? config.speed.actionLevel, c.actionLevel),
    },
    { id: 'sleeve-level', factor: (c) => levelFactor(config.speed.sleeveLevel, c.sleeveLevel) },
    { id: 'interface-speed', factor: (c) => c.interfaceSpeed },
    { id: 'global-speed', factor: () => config.global.speedMultiplier },
  ];
}

/**
 * Combines modifiers by multiplication.
 *
 * Called by: `engine.ts`.
 *
 * @param modifiers the factors to combine (empty list gives 1)
 * @param context values the factors depend on
 * @returns the total speed multiplier (> 0)
 */
export function speedMultiplier(modifiers: readonly SpeedModifier[], context: SpeedContext): number {
  return modifiers.reduce((product, m) => product * m.factor(context), 1);
}

/**
 * Duration of one run after applying speed.
 *
 * @param baseDurationMs duration at multiplier 1
 * @param multiplier result of {@link speedMultiplier}
 * @returns effective duration in milliseconds
 */
export function effectiveDurationMs(baseDurationMs: number, multiplier: number): number {
  return baseDurationMs / multiplier;
}
