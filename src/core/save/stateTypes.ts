/**
 * @module core
 *
 * The state of a running game: what changes while playing, and its read-only view.
 */
import type { AutomationState } from '../automation/automation';
import type { BigNum } from '../../numbers';
import type { ActionId } from '../actions/actionTypes';
import type { CorporationState } from '../corporation/corporationTypes';
import type { ItemId, RarityId } from '../items/itemTypes';
import type { BuyableId } from '../effects/buyableTypes';

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
  /** The action level each action had reached at that moment (absent in records written before levels were kept). */
  readonly actionLevels?: Readonly<Record<ActionId, number>>;
}

/** One synthetic sleeve: it belongs to the finished run `runs[runIndex]` and uses that run's numbers. */
export interface SynthSleeve {
  /** Index into `GameState.runs`. */
  readonly runIndex: number;
}

/**
 * What is shared by every sleeve and survives a sleeve: the wallet. Some of it still resets with a re-sleeve (credits, inventory, automation unless a
 * retention skill keeps it); the carry-over lists in `state.ts` decide, and everything not listed resets.
 */
export interface Wallet {
  credits: BigNum;
  /** The most credits ever held, over all lives. Statistics only: never reset (not even by re-sleeving) and nothing reads it for gameplay. */
  allTimePeakCredits: BigNum;
  /** The most network nodes ever held, over all lives. Statistics only: never reset and nothing reads it for gameplay. */
  allTimePeakNetwork: BigNum;
  /** Every finished sleeve-run, oldest first (one per re-sleeve, whatever skills were owned). Survives re-sleeving; only a new game clears it. */
  runs: SleeveRunRecord[];
  /** The synthetic sleeves, in the order they were gained. Survives re-sleeving; only a new game clears it. */
  synths: SynthSleeve[];
  /**
   * Copies of each purchase on an action's card that were owned when the last life ended (absent: 0), so Reflex Archive can buy them back. Written
   * at every re-sleeve whatever skills are owned; empty in a new game. Whole counts.
   */
  lastLifePurchases: Record<BuyableId, number>;
  /** What the player unlocked and set in the Automation tab. Reset by re-sleeving unless a retention skill keeps it. */
  automation: AutomationState;
  /** Progress of the corporation's actions. Survives re-sleeving: the corporation is not the character. (The save keeps corporations as a map keyed by id, with one entry.) */
  corporation: CorporationState;
  /** Items held: whole counts per item id and rarity id (absent means 0). Reset by re-sleeving. */
  inventory: Record<ItemId, Record<RarityId, number>>;
}

/** The state of one sleeve: everything that belongs to the life being played and resets with it (but for the carry-over lists in `state.ts`). */
export interface SleeveState {
  /** Copies owned per buyable id. Absent means 0. The re-sleeve carry-over list copies the carried ones across. */
  purchased: Record<BuyableId, number>;
  actions: Record<ActionId, ActionState>;
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
  /** Hacking Proficiency: gained from actions paying `hackingProficiency`; the hacking multiplier on interface speed is a concave function of it. Reset by re-sleeving. */
  hackingProficiency: BigNum;
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
  /**
   * The key toggles in the Inventory, by key kind (`zeroDay`, `adminKey`; absent or false: off): while one is on, completed runs of its action use the
   * key item up and are critical. A toggle switches itself off when none is left. Reset by re-sleeving.
   */
  keyToggles: Record<string, boolean>;
  /** Links of each action's Overclock chain (absent: 0). Only counts while the action is overclocked and running. Reset by re-sleeving. */
  chains: Record<ActionId, number>;
}

/**
 * The part of {@link GameState} a function needs, named by field: `StateSlice<'credits' | 'heat'>` is `{ wallet: { credits }; sleeve: { heat } }`.
 * Callers pass the whole state; the field names decide which of the two parts each one is read from.
 */
export type StateSlice<K extends keyof Wallet | keyof SleeveState> = {
  wallet: Pick<Wallet, Extract<K, keyof Wallet>>;
  sleeve: Pick<SleeveState, Extract<K, keyof SleeveState>>;
};

/** Id of a sleeve in the save's `sleeves` map. */
export type SleeveId = string;

/** Complete mutable game state: the shared {@link Wallet} and the one live sleeve. Serialised by `serialization.ts` (nested, as `wallet` and `sleeves`). */
export interface GameState {
  wallet: Wallet;
  /** The live sleeve. (The save keeps sleeves in a map keyed by id with this one as the only entry; the map comes with the second sleeve.) */
  sleeve: SleeveState;
}

/** `T` with every property read-only, recursively. `BigNum` values are immutable already and stay as they are. */
export type DeepReadonly<T> = T extends BigNum ? T : T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } : T;

/**
 * Read-only view of {@link GameState}, handed out by the engine so callers cannot mutate it.
 * Derived from `GameState`, so a new field never has to be added twice.
 */
export type GameStateView = DeepReadonly<GameState>;

/** Read-only view of a {@link StateSlice}. */
export type StateSliceView<K extends keyof Wallet | keyof SleeveState> = DeepReadonly<StateSlice<K>>;
