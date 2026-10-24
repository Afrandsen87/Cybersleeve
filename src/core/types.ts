/**
 * @module core
 *
 * Shared data shapes for the game: configuration, definitions and state.
 * Pure data, no behaviour, no DOM, no timers.
 *
 * @remarks
 * Everything that tunes progression lives in {@link GameConfig}. Definitions (static content)
 * are separate from state (what changes while playing), so content and tuning can change
 * without touching engine code (open/closed).
 */
import type { BigNum } from '../numbers';

/** Identifier of an action (e.g. `"earn-credits"`). Never shown to the player. */
export type ActionId = string;
/** Identifier of a buyable (e.g. `"auto-run"`). Never shown to the player. */
export type BuyableId = string;

/**
 * How experience maps to levels.
 *
 * @remarks
 * Level 1 is held below `firstLevelXp`. Reaching `firstLevelXp` gives level 2, and every further level
 * needs `growthFactor` times the previous threshold: `threshold(level n+1) = firstLevelXp * growthFactor^(n-1)`.
 * With the defaults (10 and 10): level 2 at 10 XP, 3 at 100, 4 at 1000, and so on.
 */
export interface LevelRuleConfig {
  /** XP at which level 2 is reached (> 0). */
  readonly firstLevelXp: number;
  /** Ratio between consecutive level thresholds (> 1). */
  readonly growthFactor: number;
}

/**
 * How much a level is worth as a multiplier.
 *
 * - `linear`: `1 + (level - 1) * perLevel` (perLevel 1 gives "multiplier = level").
 * - `exponential`: `base ^ (level - 1)`.
 */
export type LevelScaling = { readonly kind: 'linear'; readonly perLevel: number } | { readonly kind: 'exponential'; readonly base: number };

/** What a completed run pays out: `credits` go to the credit balance, `networkNodes` grow the network. */
export type RewardKind = 'credits' | 'networkNodes';

/** Static description of an action the character can perform. */
export interface ActionDefinition {
  readonly id: ActionId;
  /** Display name (placeholder, may be renamed freely). */
  readonly name: string;
  /** Duration of one run at speed multiplier 1, in milliseconds. */
  readonly baseDurationMs: number;
  /** Amount paid per completed run, in units of `rewardKind` (before output multipliers). */
  readonly reward: BigNum;
  /** What `reward` is paid as. Default: `'credits'`. */
  readonly rewardKind?: RewardKind;
  /** When true, `reward` is paid once per network node owned (so the payout is `reward * nodes`). Default: false. */
  readonly rewardPerNetworkNode?: boolean;
  /** Heat added to the sleeve by each completed run (>= 0). Default: 0. */
  readonly heatPerRun?: number;
  /** Access level the sleeve needs before this action can be performed (integer >= 1). Default: 1. */
  readonly requiredAccessLevel?: number;
  /** Action experience gained per completed run (before output multipliers). */
  readonly xpPerRun: BigNum;
  /** Overrides `progression.actionLevels` for this action. */
  readonly levels?: LevelRuleConfig;
  /** Overrides `progression.sleeveLevels` for this action's sleeve level. */
  readonly sleeveLevels?: LevelRuleConfig;
  /** Overrides `speed.actionLevel` for this action. */
  readonly speedScaling?: LevelScaling;
}

/**
 * What a purchase does. Add a new `kind` here and in `effects.ts` to add a new effect type.
 * An effect applies once per copy owned (see `BuyableDefinition.maxPurchases`).
 *
 * - Action effects (`autoRun`, `outputMultiplier`) change the action the buyable belongs to.
 * - Sleeve effects (`interfaceSpeed`, `accessLevel`) change the global sleeve stats; the buyable has no action.
 */
export type BuyableEffect =
  | { readonly kind: 'autoRun' }
  | { readonly kind: 'outputMultiplier'; readonly factor: number }
  | { readonly kind: 'interfaceSpeed'; readonly amount: number }
  | { readonly kind: 'accessLevel'; readonly level: number };

/** Kinds of {@link BuyableEffect} that belong to an action (all others are sleeve-wide). */
export const ACTION_EFFECT_KINDS: readonly BuyableEffect['kind'][] = ['autoRun', 'outputMultiplier'];

/** Static description of a purchase (one-time or repeatable). It belongs to one action, or to the sleeve when it has no action. */
export interface BuyableDefinition {
  readonly id: BuyableId;
  /** The action this purchase belongs to and whose behaviour its effect changes. Absent for sleeve-wide (global) purchases. */
  readonly actionId?: ActionId;
  readonly name: string;
  readonly description: string;
  /** Short text shown on the purchase's square button (default: initials of `name`). */
  readonly symbol?: string;
  /** Price in credits of the first copy (before `global.costMultiplier`). */
  readonly cost: BigNum;
  readonly effect: BuyableEffect;
  /** Buyables that must be owned before this one becomes available. Default: none. */
  readonly requires?: readonly BuyableId[];
  /** How many copies can be bought; `Infinity` for unlimited. Default: 1. */
  readonly maxPurchases?: number;
  /** Price multiplier per copy already owned (>= 1). Default: 1 (constant price). */
  readonly costGrowth?: number;
}

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
  /** Multiplies every credit reward. */
  readonly rewardMultiplier: number;
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
  /** Heat of a new sleeve (>= 0). One point of heat is one percent of tax on all credits earned. */
  readonly baseHeat: number;
  /** Time one heat cooldown cycle takes, in ms (> 0). Heat only cools while it is above 0. */
  readonly heatCooldownMs: number;
  /** Heat removed each time a cooldown cycle completes (> 0). */
  readonly heatCooldownAmount: number;
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
}

/** Timing and test-aid settings used by the browser shell. */
export interface RuntimeConfig {
  /** Interval between game steps, in ms (> 0). */
  readonly stepMs: number;
  /** Largest real-time gap simulated in one step, in ms (> 0). Longer gaps are not simulated (no offline progress yet). */
  readonly maxDeltaMs: number;
  /** Interval between autosaves, in ms (> 0). */
  readonly autosaveMs: number;
  /** Time multiplier of the fast-forward test toggle (> 1). */
  readonly fastForwardFactor: number;
}

/** Everything the game needs that is not state: content plus every tuning constant. */
export interface GameConfig {
  readonly actions: readonly ActionDefinition[];
  readonly buyables: readonly BuyableDefinition[];
  readonly progression: ProgressionConfig;
  readonly speed: SpeedConfig;
  readonly global: GlobalTuning;
  readonly network: NetworkConfig;
  readonly sleeve: SleeveConfig;
  readonly engine: EngineConfig;
  readonly runtime: RuntimeConfig;
}

/** Mutable per-action progress. */
export interface ActionState {
  /** Total action experience since the last re-sleeve. */
  xp: BigNum;
  /** Total sleeve experience of this action. Survives re-sleeving. */
  sleeveXp: BigNum;
  /** Completed runs of this action since its last sleeve-XP batch (0..runsPerSleeveXp-1). Survives re-sleeving. */
  runsTowardSleeveXp: number;
  /** True while the progress bar is filling. */
  running: boolean;
  /** Time spent on the current run, in milliseconds (0 when idle). */
  progressMs: number;
}

/** Complete mutable game state. Serialised by `serialization.ts`. */
export interface GameState {
  credits: BigNum;
  /** Network nodes built so far; each produces passive credits. Reset by re-sleeving. */
  network: BigNum;
  /** Current heat: starts at `sleeve.baseHeat`, raised by actions, lowered by the cooldown. Reset by re-sleeving. */
  heat: number;
  /** Time spent on the current heat cooldown cycle, in ms. Only advances while heat > 0. Reset by re-sleeving. */
  heatCooldownMs: number;
  actions: Record<ActionId, ActionState>;
  /** Copies owned per buyable id. Absent means 0. */
  purchased: Record<BuyableId, number>;
}

/**
 * Read-only view of {@link GameState}, handed out by the engine so callers cannot mutate it.
 * (`BigNum` values are immutable, so one level of `readonly` per object is enough.)
 */
export interface GameStateView {
  readonly credits: BigNum;
  readonly network: BigNum;
  readonly heat: number;
  readonly heatCooldownMs: number;
  readonly actions: Readonly<Record<ActionId, Readonly<ActionState>>>;
  readonly purchased: Readonly<Record<BuyableId, number>>;
}
