/**
 * @module core
 *
 * The two narrow faces of the game that the outside world (UI, tests, tools) depends on.
 *
 * @remarks
 * {@link GameQueries} changes nothing and is the union of small interfaces by area ({@link StateQueries}, {@link ActionQueries},
 * {@link LevelQueries}, {@link SleeveQueries}, {@link ItemQueries}, {@link ShopQueries}, {@link SkillQueries}); {@link GameCommands}
 * is everything a player can do, likewise the union of {@link ActionCommands}, {@link ShopCommands}, {@link ItemCommands},
 * {@link SleeveCommands} and {@link TestAidCommands}. `GameEngine` implements all of them, but a view only needs the part it
 * uses, so it can be tested against a small fake. A new question or command goes into the interface of its area.
 */
import type { BigNum } from '../numbers';
import type { FocusStatus, OverclockStatus } from './actionToggles';
import type { AutomationControls } from './automation';
import type { BackChannelRule, SleeveStats } from './effects';
import type { RecentCrits } from './critFeed';
import type { PurchaseResult } from './shop';
import type { SpeedFactor } from './speed';
import type { ActionId, BuyableId, Currency, GameConfig, GameStateView, ItemId, RarityId } from './types';

/** What clicking a purchase did: it was bought (or refused), or an owned auto-run was switched. */
export type ActivateResult = PurchaseResult | 'switched-on' | 'switched-off';

/** Read-only access to the raw state and the content being played. */
export interface StateQueries {
  /** Read-only view of the current state. */
  getState(): GameStateView;
  /** The content and tuning being played. */
  getConfig(): GameConfig;
}

/** Read-only questions about actions: whether they can run, how fast and what they pay. */
export interface ActionQueries {
  /** True when the action's access level is high enough. */
  isUnlocked(id: ActionId): boolean;
  /** True when starting the action now would work: it is unlocked and its start cost can be paid. */
  canStart(id: ActionId): boolean;
  /** What starting the action costs now, or `null` when free. */
  startCostOf(id: ActionId): BigNum | null;
  /** Current duration of one run, in ms. */
  currentDurationMs(id: ActionId): number;
  /** Current speed multiplier of the action. */
  currentSpeed(id: ActionId): number;
  /** The factors that multiply into the action's speed: action level, sleeve level, interface speed and the global lever. */
  speedFactors(id: ActionId): readonly SpeedFactor[];
  /** Levels added to the action's level for speed by purchases (its XP progress is not affected). */
  levelBonus(id: ActionId): number;
  /** True when the action restarts itself. */
  isAutoRun(id: ActionId): boolean;
  /** Overclock for the action (speed bonus, heat cost, on or off), or `null` while there is no toggle to show. */
  overclockStatus(id: ActionId): OverclockStatus | null;
  /** Focus for the action (speed bonus, slots, on or off), or `null` while there is no toggle to show. */
  focusStatus(id: ActionId): FocusStatus | null;
  /** Multiplier on the action's own reward per run, from purchases (>= 1). It scales that reward only. */
  rewardMultiplier(id: ActionId): BigNum;
  /** What a completed run adds to the balance now (heat does not tax it). */
  payoutPerRun(id: ActionId): BigNum;
  /** Action XP one completed run gives now (after any Augment schematics applied to the action). */
  xpPerRun(id: ActionId): BigNum;
  /** Critical successes of an action in the last second of game time (the count and the average per second). */
  recentCrits(id: ActionId): RecentCrits;
}

/** Read-only questions about the levels and XP of actions (action levels and sleeve levels). */
export interface LevelQueries {
  /** Level of an action. */
  actionLevel(id: ActionId): number;
  /** XP gathered inside the action's current level (the running total resets, as far as the player sees, at each level-up). */
  actionXpIntoLevel(id: ActionId): BigNum;
  /** XP that leaving the action's current level costs on its own. */
  actionXpForLevel(id: ActionId): BigNum;
  /** Total XP at which the action reaches its next level (all earlier levels included). */
  nextActionLevelXp(id: ActionId): BigNum;
  /** Fraction (0..1) of the way to the next action level. */
  actionLevelProgress(id: ActionId): number;
  /** Sleeve level of an action. */
  sleeveLevel(id: ActionId): number;
  /** Sleeve XP gathered inside the action's current sleeve level. */
  sleeveXpIntoLevel(id: ActionId): BigNum;
  /** Sleeve XP that leaving the action's current sleeve level costs on its own, after any reduction. */
  sleeveXpForLevel(id: ActionId): BigNum;
  /** Total sleeve XP at which the next sleeve level is reached (all earlier levels included). */
  nextSleeveLevelXp(id: ActionId): BigNum;
  /** Fraction (0..1) of the way to the next sleeve level. */
  sleeveLevelProgress(id: ActionId): number;
  /** Completed runs one batch of sleeve XP takes right now. */
  runsPerSleeveXp(): number;
}

/** Read-only questions about the sleeve as a whole and the network it carries. */
export interface SleeveQueries {
  /** The global sleeve stats after sleeve-wide purchases. */
  sleeveStats(): SleeveStats;
  /** The share (0..1) of the network's credits per second kept after the heat tax, with the current ICE Rating. */
  creditKeepFactor(): number;
  /** Credits one network node delivers per second now (after the node payout multiplier; the heat tax is taken from the income). */
  passiveCreditsPerNode(): BigNum;
  /** Credits per second the network delivers now. */
  passiveCreditsPerSecond(): BigNum;
  /** True when the player owns the skill that gives synthetic sleeves. */
  synthSleevesUnlocked(): boolean;
  /** How many synthetic sleeves the player has. */
  synthCount(): number;
  /** Credits per second all synthetic sleeves earn together (not taxed by heat). */
  synthCreditsPerSecond(): BigNum;
  /** True when the player may re-sleeve right now. */
  canResleeve(): boolean;
  /** True while heat cannot cool or be reduced at all (an action is running with an Overclock that stops heat cooling). */
  heatCoolingBlocked(): boolean;
}

/** Read-only questions about items: where they drop from, and whether the tiles of the inventory can be used. */
export interface ItemQueries {
  /** The actions that can drop one stack of items now, with the chance that one completed run of each drops it (0..1). */
  dropSources(itemId: ItemId, rarityId: RarityId): readonly { readonly actionId: ActionId; readonly chance: number }[];
  /** The back channel unlocked by a skill, or `null`. */
  backChannel(): BackChannelRule | null;
  /** True when using a Burn lead of this rarity would do something (one is held and there is heat). */
  canUseBurnLead(rarityId: RarityId): boolean;
  /** True when pressing the Zero-day toggle would do something (it is on, or a Zero-day is held). */
  canToggleZeroDays(): boolean;
  /** True when pressing the Admin key toggle would do something (it is on, or an Admin key is held). */
  canToggleAdminKeys(): boolean;
  /** True when using a Skill shard would do something (one is held and some action is unlocked). */
  canUseSkillShard(): boolean;
}

/** Read-only questions about buyables: ownership, price and availability. */
export interface ShopQueries {
  /** Copies of a buyable owned. */
  ownedCount(id: BuyableId): number;
  /** Price of the next copy. */
  costOf(id: BuyableId): BigNum;
  /** What a buyable is paid in. */
  currencyOf(id: BuyableId): Currency;
  /** True when the buyable can be bought right now. */
  canBuy(id: BuyableId): boolean;
  /** True when the buyable's requirements are met. */
  isBuyableAvailable(id: BuyableId): boolean;
  /** True when the buyable is available and its price is close enough to what the player has held to be shown. */
  isBuyableRevealed(id: BuyableId): boolean;
  /** True when no more copies can be bought. */
  isBuyableMaxed(id: BuyableId): boolean;
  /** True when an owned auto-run buyable is switched on. */
  isAutoRunEnabled(id: BuyableId): boolean;
}

/** Read-only questions about points: skill points, re-sleeve points and the automation features. */
export interface SkillQueries {
  /** Skill points the player can still spend. */
  skillPoints(): number;
  /** Re-sleeve points the player can still spend. */
  resleevePoints(): number;
  /** Skill points earned in total, spent or not: 0 until an action first reaches level 1. */
  skillPointsEarned(): number;
  /** The automation features: points, what is unlocked and the settings (the commands are on the same object). */
  automation(): AutomationControls;
}

/**
 * Everything that can be asked of the game without changing it. Each part is a narrow interface of its own, so a piece of
 * UI (or a test fake) can depend on just the part it reads.
 * Called by: `ui/viewModel.ts`. Implemented by: `GameEngine`.
 */
export interface GameQueries extends StateQueries, ActionQueries, LevelQueries, SleeveQueries, ItemQueries, ShopQueries, SkillQueries {
  /**
   * Runs read-only work in which the sleeve stats and the skill points are computed once instead of on every question.
   * For building a screen. The work must not change the game.
   *
   * @param read the work
   * @returns whatever `read` returns
   */
  snapshot<T>(read: () => T): T;
}

/** Commands on actions: starting a run and the buttons of the action card. Called by: `ui/widgets/actionCards.ts`. */
export interface ActionCommands {
  /** Starts an action manually. @returns true when it is now running */
  startAction(id: ActionId): boolean;
  /** Applies one Augment schematic to an action (raises its action XP per run). @returns true when one was applied */
  augmentAction(id: ActionId): boolean;
  /** Switches Overclock on or off for an action. @returns true when it is now on */
  toggleOverclock(id: ActionId): boolean;
  /** Switches Focus on or off for an action (switching on needs a free slot). @returns true when it is now on */
  toggleFocus(id: ActionId): boolean;
}

/** Commands on purchases. Called by: `ui/widgets/`. */
export interface ShopCommands {
  /**
   * What a click on a purchase does: an owned auto-run buyable is switched on or off, anything else is bought.
   * Auto-run switches take effect on the next tick.
   */
  activateBuyable(id: BuyableId): ActivateResult;
}

/** Commands on items: using, toggling, selling and giving them up. Called by: `ui/widgets/inventoryWidget.ts`. */
export interface ItemCommands {
  /** Uses one Burn lead of a rarity: it is used up and takes a share of the current heat away. @returns true when one was used */
  useBurnLead(rarityId: RarityId): boolean;
  /** Switches the Zero-day toggle (needs a Zero-day to switch on; switches itself off at 0). @returns true when it is now on */
  toggleZeroDays(): boolean;
  /** Switches the Admin key toggle (needs an Admin key to switch on; switches itself off at 0). @returns true when it is now on */
  toggleAdminKeys(): boolean;
  /** Uses one Skill shard: it lands on a random unlocked action and delays its action XP scaling. @returns the action it landed on, or `null` when nothing happened */
  useSkillShard(): ActionId | null;
  /** Gives up items for Moles through the unlocked back channel. @param amount how many, or `'all'` @returns how many were given up */
  giveUpForMoles(itemId: ItemId, rarityId: RarityId, amount: number | 'all'): number;
  /** Sells items from the inventory for credits. @param amount how many, or `'all'` @returns how many were sold */
  sellItems(itemId: ItemId, rarityId: RarityId, amount: number | 'all'): number;
}

/** Commands on the whole sleeve: re-sleeving and starting over. */
export interface SleeveCommands {
  /** Re-sleeves if the policy allows it. @returns true when the reset was applied */
  resleeve(): boolean;
  /** Wipes the game, including what a re-sleeve keeps. */
  newGame(): void;
}

/** Test aids shown in the corner of development builds. */
export interface TestAidCommands {
  /** Test aid: drops one item now by the current drop weights, whatever the chance. */
  dropTestItem(): void;
  /** Test aid: doubles the credits held now. */
  doubleCredits(): void;
}

/** Everything the player can do: the union of the commands by area. Implemented by: `GameEngine`. */
export interface GameCommands extends ActionCommands, ShopCommands, ItemCommands, SleeveCommands, TestAidCommands {}
