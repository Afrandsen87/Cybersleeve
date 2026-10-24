/**
 * @module core
 *
 * The two narrow faces of the game that the outside world (UI, tests, tools) depends on.
 *
 * @remarks
 * {@link GameQueries} changes nothing; {@link GameCommands} is everything a player can do. `GameEngine` implements
 * both, but a view only needs to know these interfaces, so it can be tested against a small fake.
 */
import type { BigNum } from '../numbers';
import type { SleeveStats } from './effects';
import type { PurchaseResult } from './shop';
import type { ActionId, BuyableId, Currency, GameConfig, GameStateView } from './types';

/** What clicking a purchase did: it was bought (or refused), or an owned auto-run was switched. */
export type ActivateResult = PurchaseResult | 'switched-on' | 'switched-off';

/** Read-only questions about the game. Called by: `ui/viewModel.ts`. Implemented by: `GameEngine`. */
export interface GameQueries {
  /** Read-only view of the current state. */
  getState(): GameStateView;
  /** The content and tuning being played. */
  getConfig(): GameConfig;

  /** True when the action's access level and unlock rule are satisfied. */
  isUnlocked(id: ActionId): boolean;
  /** What starting the action costs now, or `null` when free. */
  startCostOf(id: ActionId): BigNum | null;
  /** Current duration of one run, in ms. */
  currentDurationMs(id: ActionId): number;
  /** Current speed multiplier of the action. */
  currentSpeed(id: ActionId): number;
  /** True when the action restarts itself. */
  isAutoRun(id: ActionId): boolean;
  /** Output multiplier from purchases (>= 1). */
  outputMultiplier(id: ActionId): BigNum;
  /** What a completed run adds to the balance now (after the heat tax for credits). */
  payoutPerRun(id: ActionId): BigNum;

  /** Level of an action. */
  actionLevel(id: ActionId): number;
  /** XP at which the action reaches its next level. */
  nextActionLevelXp(id: ActionId): BigNum;
  /** Fraction (0..1) of the way to the next action level. */
  actionLevelProgress(id: ActionId): number;
  /** Sleeve level of an action. */
  sleeveLevel(id: ActionId): number;
  /** Sleeve XP at which the next sleeve level is reached. */
  nextSleeveLevelXp(id: ActionId): BigNum;
  /** Fraction (0..1) of the way to the next sleeve level. */
  sleeveLevelProgress(id: ActionId): number;

  /** The global sleeve stats after sleeve-wide purchases. */
  sleeveStats(): SleeveStats;
  /** Credits per second the network delivers now. */
  passiveCreditsPerSecond(): BigNum;

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
  /** True when no more copies can be bought. */
  isBuyableMaxed(id: BuyableId): boolean;
  /** True when an owned auto-run buyable is switched on. */
  isAutoRunEnabled(id: BuyableId): boolean;

  /** True when the player may re-sleeve right now. */
  canResleeve(): boolean;
}

/** Everything the player can do. Called by: `ui/dom.ts`. Implemented by: `GameEngine`. */
export interface GameCommands {
  /** Starts an action manually. @returns true when it is now running */
  startAction(id: ActionId): boolean;
  /**
   * What a click on a purchase does: an owned auto-run buyable is switched on or off, anything else is bought.
   * Auto-run switches take effect on the next tick.
   */
  activateBuyable(id: BuyableId): ActivateResult;
  /** Re-sleeves if the policy allows it. @returns true when the reset was applied */
  resleeve(): boolean;
  /** Wipes the game, including what a re-sleeve keeps. */
  newGame(): void;
}
