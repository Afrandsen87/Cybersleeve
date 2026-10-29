/**
 * @module core
 *
 * The tuning of the game: everything that decides progression, gathered in GameConfig.
 */
import type { ActionDefinition, CriticalSuccessRule, LevelRuleConfig, LevelScaling } from '../actions/actionTypes';
import type { CorporationConfig } from '../corporation/corporationTypes';
import type { ItemsConfig } from '../items/itemTypes';
import type { BuyableDefinition } from '../effects/buyableTypes';

/** Tuning of experience, levels and sleeve experience. */
export interface ProgressionConfig {
  /** Completed runs of one action that grant it one batch of sleeve XP (integer >= 1). */
  readonly runsPerSleeveXp: number;
  /** Sleeve XP granted per batch of `runsPerSleeveXp` runs (> 0). */
  readonly sleeveXpPerGrant: number;
  /** Default level rule for every action (an action may override it). */
  readonly actionLevels: LevelRuleConfig;
  /** Default level rule of every action's sleeve level (an action may override it). */
  readonly sleeveLevels: LevelRuleConfig;
  /** Credits at the start of a game and after a re-sleeve (>= 0). */
  readonly startingCredits: number;
  /** The most that all sleeve-XP reduction buyables together can cut a sleeve level's XP requirement (a fraction in [0, 1); 0.99 = 99%). */
  readonly maxSleeveXpReduction: number;
}

/** How levels translate into speed. */
export interface SpeedConfig {
  /** Default action-level scaling (an action may override it). */
  readonly actionLevel: LevelScaling;
  /** Sleeve-level scaling. */
  readonly sleeveLevel: LevelScaling;
}

/** Broad levers that scale everything at once, for quick progression tuning. All must be > 0; 1 = no change. */
export interface GlobalTuning {
  /** Multiplies the speed of every action. */
  readonly speedMultiplier: number;
  /** Multiplies the credits earned: run rewards paid in credits and passive network income. No other reward kind is affected. */
  readonly creditMultiplier: number;
  /** Multiplies every XP gain (action XP; sleeve XP follows from runs). */
  readonly xpMultiplier: number;
  /** Multiplies every buyable price. */
  readonly costMultiplier: number;
}

/** Starting values of the global sleeve stats, before any purchase. */
export interface SleeveConfig {
  /** Access level of a new sleeve (integer >= 1). */
  readonly baseAccessLevel: number;
  /** Interface speed of a new sleeve: a plain multiplier on the speed of every action (> 0; 1 = no change). */
  readonly baseInterfaceSpeed: number;
  /** Slope at 0 of the curve that turns the interface speed earned by actions into the bonus applied (> 0; 1 = first runs count in full). */
  readonly earnedSpeedScale: number;
  /** Shape of that curve (<= 1): 1 = straight line, 0 = logarithm, in between = diminishing returns without a ceiling. */
  readonly earnedSpeedExponent: number;
  /** Hacking Proficiency at which the curve changes shape (>= 0). Default: 1. Only matters with `earnedSpeedExponentBeyond`. */
  readonly earnedSpeedKnee?: number;
  /**
   * The shape of the curve past `earnedSpeedKnee` (<= 1, same meaning as `earnedSpeedExponent`). It continues from the value and the
   * slope the curve has at the knee; below `earnedSpeedExponent` it flattens the curve there. Default: the same as `earnedSpeedExponent`
   * (one curve all the way).
   */
  readonly earnedSpeedExponentBeyond?: number;
  /** Heat of a new sleeve (>= 0). */
  readonly baseHeat: number;
  /** Share of the credits network nodes produce that one point of heat takes (0.01 = 1%; >= 0). ICE Rating lowers the effect. */
  readonly heatTaxPerPoint: number;
  /** Time one heat cooldown cycle takes, in ms (> 0). Heat only cools while it is above 0. */
  readonly heatCooldownMs: number;
  /** Heat removed each time a cooldown cycle completes (> 0). */
  readonly heatCooldownAmount: number;
  /** ICE Rating of a new sleeve (>= 1). The stat is multiplied by buyables and raised by actions. */
  readonly baseIceRating: number;
  /** Share of the heat tax removed per order of magnitude of ICE Rating (0.005 = 0.5%; 100% is reached at 1e200). */
  readonly iceRatingReductionPerOrder: number;
  /** Each point of Legend makes heat cool this much faster: the cycle is divided by `1 + this x Legend` (0.1 = 10% faster per point; >= 0). */
  readonly legendHeatSpeedup: number;
  /** Legend falls by exactly 1 each time this many ms have passed (a cycle, like the heat cooldown; > 0). */
  readonly legendDecayPeriodMs: number;
}

/** The passive-income network built by actions paying `networkNodes`. */
export interface NetworkConfig {
  /** Credits each network node produces per second of game time (>= 0). */
  readonly creditsPerNodePerSecond: number;
}

/** Technical limits of the engine. */
export interface EngineConfig {
  /**
   * Safety cap on run batches processed per action per tick (integer >= 1). Runs are computed in closed form: a batch is
   * the stretch of runs between two level changes, so normal play needs only a handful of batches per tick.
   * Time beyond the cap is discarded.
   */
  readonly maxBatchesPerTick: number;
  /**
   * Longest stretch of game time simulated in one go, in ms (> 0). A longer tick is cut into equal slices of at most this
   * length and the slices run one after another, so effects that feed back on themselves (interface speed growing
   * with every run, heat cooling while the network pays, ...) follow the same course however the time is delivered.
   * A normal 50 ms step is one slice.
   */
  readonly maxSliceMs: number;
  /**
   * Most slices one tick is cut into (integer >= 1). Bounds the cost of a very long tick; beyond it the slices simply
   * get longer (and the feedback effects above become approximate again).
   */
  readonly maxSlicesPerTick: number;
  /**
   * Shortest time one run can take, in ms (> 0). However fast an action gets, its run never takes less, so a speed that
   * overflows cannot turn a duration into 0 (and the batch maths into NaN).
   */
  readonly minRunDurationMs: number;
}

/** Timing and test-aid settings used by the browser shell. */
export interface RuntimeConfig {
  /** Interval between game steps, in ms (> 0). */
  readonly stepMs: number;
  /** Shortest interval between screen refreshes, in ms (> 0). The game itself still steps every `stepMs`. */
  readonly renderMs: number;
  /** Largest real-time gap simulated in one step, in ms (> 0). Longer gaps are not simulated (no offline progress yet). */
  readonly maxDeltaMs: number;
  /** Interval between autosaves, in ms (> 0). */
  readonly autosaveMs: number;
  /** Time multiplier of the fast-forward test toggle (> 1). */
  readonly fastForwardFactor: number;
}

/** What Focus does, for every action that has unlocked it. */
export interface FocusConfig {
  /** A focused action runs this much faster (0.25 = 25 percent; > 0). */
  readonly speedBonus: number;
  /** Actions that can be focused at once before any Focus slot is bought (a whole number >= 1). */
  readonly baseSlots: number;
}

/** Tuning of re-sleeving and of the record kept of finished sleeve-runs. */
export interface ResleeveConfig {
  /** Re-sleeve points the player earns for each re-sleeve (a whole number >= 1). */
  readonly pointsPerResleeve: number;
  /** How many of the latest sleeve-runs the Stats tab lists (a whole number >= 1). */
  readonly runsShown: number;
  /**
   * Game time in ms after buying the sleeve-levels unlock during which re-sleeving is refused (>= 0; default 0). Only matters in a
   * game with an `unlockSleeveLevels` buyable.
   */
  readonly lockoutMs?: number;
  /**
   * The total of all actions' sleeve levels the Nth re-sleeve needs: `base + perResleeve x (N - 1)`, where N counts the re-sleeve about to
   * happen (sleeve levels carry over, so the total only grows). Both are numbers >= 0. Leave it out for a game whose re-sleeve needs no levels.
   */
  readonly sleeveLevelsNeeded?: { readonly base: number; readonly perResleeve: number };
}

/** The automation features and their starting values. Leave the section out for a game without automation. */
export interface AutomationConfig {
  /** Where Auto Burn's heat ceiling starts (>= 0): Burn leads are used while heat is above it. */
  readonly autoBurnCeiling: number;
}

/** When a purchase appears in the interface. */
export interface RevealConfig {
  /**
   * A purchase paid in credits or nodes shows once its price is within this many orders of magnitude of the most of that
   * currency held in this life (at least 1) (so spending does not hide it again). `Infinity` shows everything. Purchases already owned,
   * skills and the purchases in an action's square are always shown.
   */
  readonly buyableOrders: number;
}

/** Everything the game needs that is not state: content plus every tuning constant. */
export interface GameConfig {
  /** Re-sleeve points and the history of finished runs. */
  readonly resleeve: ResleeveConfig;
  readonly actions: readonly ActionDefinition[];
  readonly buyables: readonly BuyableDefinition[];
  /** The item entity: kinds and rarity tiers (with their sell values). */
  readonly items: ItemsConfig;
  /** What a critical success does unless the action says otherwise. */
  readonly criticalSuccess: CriticalSuccessRule;
  /** What Focus does and how many actions can be focused at once at the start. */
  readonly focus: FocusConfig;
  /** When purchases appear in the interface; leave out to show them all. */
  readonly reveal?: RevealConfig;
  /** The automation features (unlocked with automation points); leave out for a game without automation. */
  readonly automation?: AutomationConfig;
  /** The actions of the corporation (the Corporation tab, opened by a buyable with the `unlocksCorporation` effect); leave out for a game without one. */
  readonly corporation?: CorporationConfig;
  readonly progression: ProgressionConfig;
  readonly speed: SpeedConfig;
  readonly global: GlobalTuning;
  readonly network: NetworkConfig;
  readonly sleeve: SleeveConfig;
  readonly engine: EngineConfig;
  readonly runtime: RuntimeConfig;
}
