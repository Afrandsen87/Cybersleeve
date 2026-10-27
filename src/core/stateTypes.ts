/**
 * @module core
 *
 * The state of a running game: what changes while playing, and its read-only view.
 */
import type { AutomationState } from './automation';
import type { BigNum } from '../numbers';
import type { ActionId } from './actionTypes';
import type { CorporationState } from './corporationTypes';
import type { ItemId, RarityId } from './itemTypes';
import type { BuyableId } from './buyableTypes';

/** Mutable per-action progress. */
export interface ActionState {
  /** Total action experience since the last re-sleeve. */
  xp: BigNum;
  /** Total sleeve experience of this action. Survives re-sleeving. */
  sleeveXp: BigNum;
  /** Completed runs of this action since its last sleeve-XP batch (0..runsPerSleeveXp-1). Survives re-sleeving. */
  runsTowardSleeveXp: number;
  /** Augment schematics applied to this action, per rarity id: each raises the action XP its runs give (see `items.augment`). Reset by re-sleeving. */
  augments: Record<RarityId, number>;
  /** Skill shards used on this action: each delays its action XP scaling by `items.skillShard.levelsDelayed` levels. Reset by re-sleeving. */
  skillShards: number;
  /** True while the progress bar is filling. */
  running: boolean;
  /** The share of the current run that is done: from 0 up to (not including) 1 (0 when idle). A change of speed does not change it. */
  progress: number;
}

/**
 * What is kept of one finished sleeve-run (the life that ended with a re-sleeve). Synthetic sleeves are copies of such a run.
 */
export interface SleeveRunRecord {
  /** The credits per second the sleeve's own network was producing when it was re-sleeved (after the heat tax; synthetic income is not part of it). */
  readonly creditsPerSecond: BigNum;
  /** The total of all action levels the sleeve had reached at that moment (a whole number >= 0). */
  readonly actionLevelsTotal: number;
}

/** One synthetic sleeve: it belongs to the finished run `runs[runIndex]` and uses that run's numbers. */
export interface SynthSleeve {
  /** Index into `GameState.runs`. */
  readonly runIndex: number;
}

/** Complete mutable game state. Serialised by `serialization.ts`. */
export interface GameState {
  /** Every finished sleeve-run, oldest first (one per re-sleeve, whatever skills were owned). Survives re-sleeving; only a new game clears it. */
  runs: SleeveRunRecord[];
  /** The synthetic sleeves, in the order they were gained. Survives re-sleeving; only a new game clears it. */
  synths: SynthSleeve[];
  credits: BigNum;
  /** The most credits held at any moment of this life (see `RevealConfig`); never below what is held. Reset by re-sleeving. */
  peakCredits: BigNum;
  /** Network nodes built so far; each produces passive credits. Reset by re-sleeving. */
  network: BigNum;
  /** The most nodes held at any moment of this life (see `RevealConfig`). Reset by re-sleeving. */
  peakNetwork: BigNum;
  /**
   * Current heat: starts at `sleeve.baseHeat`, raised by actions, lowered by the cooldown and by Burn leads. Reset by re-sleeving.
   * It may hold fractions of a point (Overclock adds heat continuously), but the cooldown only ever removes whole points: it waits
   * until there is at least one.
   */
  heat: number;
  /** Time spent on the current heat cooldown cycle, in ms. Only advances while heat > 0. Reset by re-sleeving. */
  heatCooldownMs: number;
  /** ICE Rating earned so far, starting at `sleeve.baseIceRating`; buyable multipliers come on top. Reset by re-sleeving. */
  iceRating: BigNum;
  /** Legend: speeds up heat cooldown, decays over time. Reset by re-sleeving. */
  legend: number;
  /** Time spent on the current Legend decay cycle, in ms. Only advances while Legend > 0. Reset by re-sleeving. */
  legendCooldownMs: number;
  /** Game time left, in ms, before the player may re-sleeve after buying the sleeve-levels unlock (stops a double click). Reset by re-sleeving. */
  resleeveLockoutMs: number;
  /** Moles: points of heat that still cool down faster, bought by giving up items (Back Channel Deals). Reset by re-sleeving. */
  moles: number;
  /** Fraction of a node (0..1) the network has grown by itself but not yet completed; carried between ticks. Reset by re-sleeving. */
  networkRemainder: number;
  /** Gained from actions paying `nodePayout`: credits per second added to the BASE value of what each node produces (`network.creditsPerNodePerSecond + this`; buyables multiply the sum). Reset by re-sleeving. */
  nodePayoutBonus: BigNum;
  /** Auto-run buyables the player has switched off (absent or false: running). Reset by re-sleeving. */
  autoRunOff: Record<BuyableId, boolean>;
  /** Actions whose Overclock toggle is switched on (absent or false: off). Reset by re-sleeving. */
  overclocked: Record<ActionId, boolean>;
  /** Actions that are focused (absent or false: not); at most as many as there are Focus slots. Reset by re-sleeving. */
  focused: Record<ActionId, boolean>;
  /** Focus slots on an action BEYOND its first (absent: 0); only with a `focusStacking` buyable. Whole counts. Reset by re-sleeving. */
  focusStacks: Record<ActionId, number>;
  /** Guaranteed critical successes banked for an action by `criticalLink` buyables (absent: 0): its next completed runs use them up. Whole counts. Reset by re-sleeving. */
  bankedCriticals: Record<ActionId, number>;
  /** The Zero-day toggle in the Inventory is on: completed runs of its action use Zero-days up and are critical. Switches itself off when none are left. Reset by re-sleeving. */
  zeroDaysOn: boolean;
  /** The Admin key toggle in the Inventory is on: completed runs of its action use Admin keys up and are critical. Switches itself off when none is left. Reset by re-sleeving. */
  adminKeysOn: boolean;
  /** Links of each action's Overclock chain (absent: 0). Only counts while the action is overclocked and running. Reset by re-sleeving. */
  chains: Record<ActionId, number>;
  /** Hacking Proficiency: gained from actions paying `hackingProficiency`; the hacking multiplier on interface speed is a concave function of it. Reset by re-sleeving. */
  hackingProficiency: BigNum;
  /** What the player unlocked and set in the Automation tab. Reset by re-sleeving. */
  automation: AutomationState;
  /** Progress of the corporation's actions. Survives re-sleeving: the corporation is not the character. */
  corporation: CorporationState;
  actions: Record<ActionId, ActionState>;
  /** Copies owned per buyable id. Absent means 0. */
  purchased: Record<BuyableId, number>;
  /** Items held: whole counts per item id and rarity id (absent means 0). Reset by re-sleeving. */
  inventory: Record<ItemId, Record<RarityId, number>>;
}

/** `T` with every property read-only, recursively. `BigNum` values are immutable already and stay as they are. */
export type DeepReadonly<T> = T extends BigNum ? T : T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } : T;

/**
 * Read-only view of {@link GameState}, handed out by the engine so callers cannot mutate it.
 * Derived from `GameState`, so a new field never has to be added twice.
 */
export type GameStateView = DeepReadonly<GameState>;
