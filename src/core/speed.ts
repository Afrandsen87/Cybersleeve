/**
 * @module core
 *
 * Speed multiplier: a product of independent, pluggable modifiers built from the configuration.
 */
import { saturate } from './infinity';
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
  /** The speed bonus Overclock gives this action right now (0.5 = 50 percent faster; 0 while it is off or not owned). Default 0. */
  readonly overclockBonus?: number;
  /** The speed bonus Focus gives this action right now (0.25 = 25 percent faster; 0 while it is not focused). Default 0. */
  readonly focusBonus?: number;
}

/** Identifiers of the factors built by {@link createSpeedModifiers}. */
export const SPEED_FACTOR_IDS = {
  actionLevel: 'action-level',
  sleeveLevel: 'sleeve-level',
  interfaceSpeed: 'interface-speed',
  globalSpeed: 'global-speed',
  overclock: 'overclock',
  focus: 'focus',
} as const;

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
 * @param level level (integer >= 0; levels start at 0)
 * @returns `1 + level * perLevel` (linear) or `base ^ level` (exponential): level 0 is worth exactly 1
 */
export function levelFactor(scaling: LevelScaling, level: number): number {
  return scaling.kind === 'linear' ? 1 + level * scaling.perLevel : scaling.base ** level;
}

/**
 * Builds the speed modifiers described by the configuration:
 * action level, sleeve level, interface speed, the global speed lever, and the Overclock and Focus bonuses (1 while off).
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
      id: SPEED_FACTOR_IDS.actionLevel,
      factor: (c) => levelFactor(overrides.get(c.actionId) ?? config.speed.actionLevel, c.actionLevel),
    },
    { id: SPEED_FACTOR_IDS.sleeveLevel, factor: (c) => levelFactor(config.speed.sleeveLevel, c.sleeveLevel) },
    { id: SPEED_FACTOR_IDS.interfaceSpeed, factor: (c) => c.interfaceSpeed },
    { id: SPEED_FACTOR_IDS.globalSpeed, factor: () => config.global.speedMultiplier },
    { id: SPEED_FACTOR_IDS.overclock, factor: (c) => 1 + (c.overclockBonus ?? 0) },
    { id: SPEED_FACTOR_IDS.focus, factor: (c) => 1 + (c.focusBonus ?? 0) },
  ];
}

/**
 * Combines modifiers by multiplication.
 *
 * Called by: `engine.ts`.
 *
 * @param modifiers the factors to combine (empty list gives 1)
 * @param context values the factors depend on
 * @returns the total speed multiplier (> 0): overflow saturates at the game's infinity (1e308), NaN counts as 1
 */
export function speedMultiplier(modifiers: readonly SpeedModifier[], context: SpeedContext): number {
  const product = modifiers.reduce((p, m) => p * m.factor(context), 1);
  return saturate(product);
}

/** The value one modifier contributed to the speed multiplier. */
export interface SpeedFactor {
  /** The modifier's identifier (see {@link SPEED_FACTOR_IDS}). */
  readonly id: string;
  /** Its factor, sanitised like in {@link speedMultiplier}: NaN counts as 1, overflow saturates at the game's infinity (1e308). */
  readonly factor: number;
}

/**
 * The factors that {@link speedMultiplier} multiplies together, one per modifier, in order. Lets the interface explain a speed.
 *
 * Called by: `stats.ts` (`ActionStats.speedFactors`).
 *
 * @param modifiers the factors to evaluate (empty list gives an empty list)
 * @param context values the factors depend on
 * @returns one entry per modifier
 */
export function speedFactors(modifiers: readonly SpeedModifier[], context: SpeedContext): readonly SpeedFactor[] {
  return modifiers.map((m) => {
    const factor = m.factor(context);
    return { id: m.id, factor: saturate(factor) };
  });
}

/**
 * Duration of one run after applying speed.
 *
 * @param baseDurationMs duration at multiplier 1
 * @param multiplier result of {@link speedMultiplier}
 * @param minDurationMs shortest duration a run may have (`engine.minRunDurationMs`, > 0); keeps the duration above 0 however
 *   large the multiplier gets
 * @returns effective duration in milliseconds, never below `minDurationMs`
 */
export function effectiveDurationMs(baseDurationMs: number, multiplier: number, minDurationMs: number): number {
  return Math.max(minDurationMs, baseDurationMs / multiplier);
}
