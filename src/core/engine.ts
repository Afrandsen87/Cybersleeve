/**
 * @module core
 *
 * The game engine: the facade that ties the subsystems together and advances time.
 *
 * @remarks
 * No timers, no DOM, no storage: time enters only through {@link GameEngine.tick}'s
 * `deltaMs` argument, which makes the engine fully deterministic and unit-testable.
 * The rules themselves live in small units: `DerivedStats` (calculations), `ActionRunner` (actions and runs),
 * `NetworkSystem` (passive income and growth), `cooldowns.ts` (heat and Legend decay), `Shop` and `Progression`. The engine
 * builds none of them: they arrive through {@link EngineDependencies} (see `app/createGame.ts`).
 */
import type { BigNum, NumberFactory } from '../numbers';
import type { ActionRunner } from './actionRunner';
import type { ActionToggles, FocusStatus, OverclockStatus } from './actionToggles';
import type { ActivateResult, GameCommands, GameQueries } from './api';
import { coolDownHeat, decayLegend } from './cooldowns';
import type { SleeveStats } from './effects';
import { coolingPace } from './heatPace';
import type { BackChannelRule } from './leverageEffects';
import type { Augments } from './augments';
import type { Corporation } from './corporation';
import type { Automation, AutomationControls } from './automation';
import type { BackChannel } from './backChannel';
import type { BurnLeads } from './burnLeads';
import type { CritFeed, RecentCrits } from './critFeed';
import type { SkillShards } from './skillShards';
import type { ZeroDays } from './zeroDays';
import type { ItemDrops } from './drops';
import type { Inventory } from './inventory';
import type { NetworkSystem } from './network';
import type { OverflowPolicy } from './overflow';
import { notePeaks } from './reveal';
import type { Progression } from './progression';
import type { ResleevePolicy } from './resleeve';
import type { ResleeveGate } from './resleeveGate';
import type { Resleever } from './resleever';
import type { PurchaseResult, Shop } from './shop';
import type { Snapshot } from './snapshot';
import type { SpeedFactor } from './speed';
import { resetForNewGame } from './state';
import type { SynthSleeves } from './synthSleeves';
import type { DerivedStats } from './stats';
import type {
  ActionId,
  BuyableId,
  CorporationActionDefinition,
  CorporationActionId,
  Currency,
  GameConfig,
  GameState,
  GameStateView,
  ItemId,
  RarityId,
} from './types';

/** The collaborators a {@link GameEngine} is built from (all injected; see `app/createGame.ts`). */
export interface EngineDependencies {
  /** XP/level service. */
  readonly progression: Progression;
  /** Purchase service. */
  readonly shop: Shop;
  /** Read-only calculations over the state (built on the same state the engine owns). */
  readonly stats: DerivedStats;
  /** Starts actions and advances their runs (built on the same state the engine owns). */
  readonly runner: ActionRunner;
  /** Passive income and network growth (built on the same state the engine owns). */
  readonly network: NetworkSystem;
  /** Applies Augment schematics to actions. */
  readonly augments: Augments;
  /** The corporation's actions (built on the same state the engine owns). */
  readonly corporation: Corporation;
  /** Rolls item drops (also used by the drop test aid). */
  readonly drops: ItemDrops;
  /** Items held and their sale (built on the same state the engine owns). */
  readonly inventory: Inventory;
  /** Gives up items for Moles (built on the same state the engine owns). */
  readonly backChannel: BackChannel;
  /** Uses Burn leads to take heat away (built on the same state the engine owns). */
  readonly burnLeads: BurnLeads;
  /** The Zero-day toggle and the Zero-days critical runs use up (built on the same state the engine owns). */
  readonly zeroDays: ZeroDays;
  /** The Admin key toggle and the Admin keys critical runs use up (built on the same state the engine owns). */
  readonly adminKeys: ZeroDays;
  /** Uses Skill shards on random unlocked actions (built on the same state the engine owns). */
  readonly skillShards: SkillShards;
  /** Switches the Overclock and Focus toggles of actions (built on the same state the engine owns). */
  readonly toggles: ActionToggles;
  /** Remembers recent critical successes for the display (the same feed the runner records into). */
  readonly critFeed: CritFeed;
  /** The automation features and their points (built on the same state the engine owns). */
  readonly automation: Automation;
  /** Decides when re-sleeving is allowed. */
  readonly resleevePolicy: ResleevePolicy;
  /** Counts the re-sleeve lockout down as game time passes (the same gate as `resleevePolicy`, in the real game). */
  readonly resleeveLockout: Pick<ResleeveGate, 'advance'>;
  /** Performs a re-sleeve (writes the run down, resets, gives the synthetic sleeve). */
  readonly resleever: Resleever;
  /** The synthetic sleeves (built on the same state the engine owns). */
  readonly synths: SynthSleeves;
  /** Reaction to numbers leaving the representable range. */
  readonly overflowPolicy: OverflowPolicy;
  /** Number factory. */
  readonly factory: NumberFactory;
  /** The scope that `stats` and `shop` memoise in (the same object they were built with). */
  readonly snapshot: Snapshot;
}

/**
 * Orchestrates the core game rules. Depends on collaborators passed to the
 * constructor (dependency inversion); owns the single mutable {@link GameState}, which the injected units share.
 *
 * Called by: `app/loop.ts` (tick), `ui` event handlers ({@link GameCommands}), `ui/viewModel.ts` ({@link GameQueries}),
 * `app/createGame.ts` (construction).
 * Calls: the injected {@link DerivedStats}, {@link ActionRunner}, {@link NetworkSystem}, {@link Progression}, {@link Shop},
 * `coolDownHeat`, `decayLegend`, {@link OverflowPolicy}.
 */
export class GameEngine implements GameQueries, GameCommands {
  private readonly progression: Progression;
  private readonly shop: Shop;
  private readonly resleevePolicy: ResleevePolicy;
  private readonly resleeveLockout: Pick<ResleeveGate, 'advance'>;
  private readonly resleever: Resleever;
  private readonly synths: SynthSleeves;
  private readonly overflowPolicy: OverflowPolicy;
  private readonly factory: NumberFactory;
  private readonly stats: DerivedStats;
  private readonly runner: ActionRunner;
  private readonly network: NetworkSystem;
  private readonly inventory: Inventory;
  private readonly backChannelDeals: BackChannel;
  private readonly burnLeads: BurnLeads;
  private readonly zeroDays: ZeroDays;
  private readonly adminKeys: ZeroDays;
  private readonly skillShards: SkillShards;
  private readonly toggles: ActionToggles;
  private readonly critFeed: CritFeed;
  private readonly automationUnit: Automation;
  private readonly drops: ItemDrops;
  private readonly augments: Augments;
  private readonly corporationUnit: Corporation;
  private readonly scope: Snapshot;

  /**
   * Creates an engine. Construct through `app/createGame.ts` rather than directly.
   *
   * @param config content and tuning
   * @param state initial state (owned by the engine from now on; `deps.stats`, `deps.runner` and `deps.network` must be built on this same object)
   * @param deps collaborators
   */
  constructor(
    private readonly config: GameConfig,
    private readonly state: GameState,
    deps: EngineDependencies,
  ) {
    ({
      progression: this.progression,
      shop: this.shop,
      stats: this.stats,
      runner: this.runner,
      network: this.network,
      inventory: this.inventory,
      backChannel: this.backChannelDeals,
      burnLeads: this.burnLeads,
      zeroDays: this.zeroDays,
      adminKeys: this.adminKeys,
      skillShards: this.skillShards,
      toggles: this.toggles,
      critFeed: this.critFeed,
      automation: this.automationUnit,
      drops: this.drops,
      augments: this.augments,
      corporation: this.corporationUnit,
      resleevePolicy: this.resleevePolicy,
      resleeveLockout: this.resleeveLockout,
      resleever: this.resleever,
      synths: this.synths,
      overflowPolicy: this.overflowPolicy,
      factory: this.factory,
      snapshot: this.scope,
    } = deps);
  }

  /** Read-only view of the current state. */
  getState(): GameStateView {
    return this.state;
  }

  /**
   * Runs read-only work in which the sleeve stats and the skill points are computed once. For building a screen, which asks for them
   * from many places. The work must not change the game (no commands, no ticks).
   *
   * @param read the work
   * @returns whatever `read` returns
   */
  snapshot<T>(read: () => T): T {
    return this.scope.run(read);
  }

  /** The configuration this engine runs. */
  getConfig(): GameConfig {
    return this.config;
  }

  // ---- commands -----------------------------------------------------------------------------------------------

  /**
   * Starts an action manually. Does nothing if it is already running. An action with a start cost pays it now; without
   * enough of the currency the action does not start.
   * @returns true when the action is now running
   */
  startAction(id: ActionId): boolean {
    const started = this.runner.start(id);
    notePeaks(this.state); // Credit Siphon pays at the start
    return started;
  }

  /**
   * Switches an owned toggleable buyable (an auto-run) on or off.
   * @param id the toggleable buyable
   * @returns true when auto-run is now on; false when it is now off or the buyable is not owned (nothing changes then)
   */
  toggleAutoRun(id: BuyableId): boolean {
    return this.shop.toggle(this.state, id);
  }

  /** Buys one copy of a buyable. Auto-run takes effect on the next tick. */
  buy(id: BuyableId): PurchaseResult {
    return this.shop.buy(this.state, id);
  }

  /**
   * What a click on a purchase does: an owned auto-run buyable is switched on or off, anything else is bought.
   * @returns what happened
   */
  activateBuyable(id: BuyableId): ActivateResult {
    if (this.shop.isToggleable(id) && this.ownedCount(id) > 0) return this.toggleAutoRun(id) ? 'switched-on' : 'switched-off';
    return this.buy(id);
  }

  /**
   * Test aid: drops one item now, with the rarity drawn by the current drop weights (the chance of a drop at all is skipped).
   * See `ItemDrops.forceDrop`.
   */
  dropTestItem(): void {
    this.drops.forceDrop();
  }

  /**
   * Test aid: doubles the credits held now (the overflow policy then clamps them at infinity).
   * Called by: `ui/dom.ts` (the "Double credits" debug button). Calls: {@link OverflowPolicy}.
   */
  doubleCredits(): void {
    this.state.credits = this.state.credits.add(this.state.credits);
    this.overflowPolicy.apply(this.state);
    notePeaks(this.state);
  }

  /**
   * Sells items from the inventory for credits (the rarity's sell value each).
   * @param itemId the item
   * @param rarityId the rarity
   * @param amount how many to sell, or `'all'`; more than held sells what is held
   * @returns how many were sold
   */
  sellItems(itemId: ItemId, rarityId: RarityId, amount: number | 'all'): number {
    const sold = this.inventory.sell(itemId, rarityId, amount);
    notePeaks(this.state);
    return sold;
  }

  /**
   * Applies one Augment schematic to an action: its action XP per run goes up by the schematic's bonus (additively) for the rest of
   * this life. Uses up one schematic of the chosen rarity. Sleeve XP is not affected.
   *
   * @param id the action to augment
   * @param rarityId the rarity of the schematic to use up
   * @returns true when a schematic was applied; false when none of that rarity is held, the game has none, or the action or rarity is unknown
   */
  augmentAction(id: ActionId, rarityId: RarityId): boolean {
    return this.augments.apply(id, rarityId);
  }

  /**
   * Gives up items for Moles through the unlocked back channel: each item taken adds `molesPerItem` Moles, which make heat cool faster.
   * Does nothing without the Back Channel Deals skill, or for any other item or rarity than the one it names.
   *
   * @param itemId the item
   * @param rarityId the rarity
   * @param amount how many to give up, or `'all'`; more than held gives up what is held
   * @returns how many were given up
   */
  giveUpForMoles(itemId: ItemId, rarityId: RarityId, amount: number | 'all'): number {
    return this.backChannelDeals.giveUp(itemId, rarityId, amount);
  }

  /**
   * Uses one Burn lead of a rarity: it is used up and takes its share of the current heat away. See `BurnLeads.use`.
   *
   * @param rarityId the rarity of the stack to use a lead from
   * @returns true when a lead was used (none is held, or there is no heat: nothing happens)
   */
  useBurnLead(rarityId: RarityId): boolean {
    return this.burnLeads.use(rarityId);
  }

  /**
   * Switches the Zero-day toggle. While it is on, every completed run of the Zero-day's action uses one Zero-day up and is a
   * critical success; the toggle switches itself off when none is left. Switching on needs a Zero-day in the Inventory. See `ZeroDays`.
   *
   * @returns true when the toggle is now on
   */
  toggleZeroDays(): boolean {
    return this.zeroDays.toggle();
  }

  /**
   * Switches the Admin key toggle. While it is on, every completed run of the Admin key's action uses one key up and is a critical
   * success (and may drop a Skill shard); the toggle switches itself off when none is left. See `ZeroDays`.
   *
   * @returns true when the toggle is now on
   */
  toggleAdminKeys(): boolean {
    return this.adminKeys.toggle();
  }

  /**
   * Uses one Skill shard: it is used up and lands on a random unlocked action, delaying that action's XP scaling. See `SkillShards`.
   *
   * @returns the action it landed on, or `null` when nothing happened
   */
  useSkillShard(): ActionId | null {
    return this.skillShards.use();
  }

  /**
   * Switches Overclock on or off for an action. Does nothing without the Overclock buyable or for an action that has no Overclock rule.
   * @returns true when it is now on
   */
  toggleOverclock(id: ActionId): boolean {
    return this.toggles.toggleOverclock(id);
  }

  /**
   * Switches Focus on or off for an action. Switching on needs a free Focus slot; switching off always works.
   * @returns true when it is now on
   */
  toggleFocus(id: ActionId): boolean {
    return this.toggles.toggleFocus(id);
  }

  /** Puts one more Focus slot on an action; several slots on one action need the Overdrive Cap skill. @returns true when one was added */
  addFocus(id: ActionId): boolean {
    return this.toggles.addFocus(id);
  }

  /** Takes one Focus slot off an action. @returns true when one was removed */
  removeFocus(id: ActionId): boolean {
    return this.toggles.removeFocus(id);
  }

  /**
   * Re-sleeves if the policy allows it.
   * @returns true when the reset was applied
   */
  resleeve(): boolean {
    if (!this.canResleeve()) return false;
    this.resleever.resleeve();
    this.critFeed.clear();
    return true;
  }

  /**
   * Wipes the game and starts over: everything is reset, including the sleeve XP that a re-sleeve keeps.
   * Not subject to the re-sleeve policy. The caller is responsible for the stored save (see `SaveGame.clear`).
   */
  newGame(): void {
    resetForNewGame(this.state, this.config, this.factory);
    this.critFeed.clear();
  }

  // ---- queries about actions ------------------------------------------------------------------------------------

  /**
   * True when the action can be performed (access level). Locked actions cannot start and do not progress.
   * @throws Error if the action id is unknown
   */
  isUnlocked(id: ActionId): boolean {
    return this.runner.isUnlocked(id);
  }

  /** True when starting the action now would work (unlocked, and the start cost can be paid). @throws Error if the action id is unknown */
  canStart(id: ActionId): boolean {
    return this.runner.canStart(id);
  }

  /**
   * What starting the action would cost right now (network nodes rounded down to whole nodes), or `null` when free.
   * @throws Error if the action id is unknown
   */
  startCostOf(id: ActionId): BigNum | null {
    return this.runner.startCostOf(id);
  }

  /** Current duration of one run of an action, after speed modifiers. @throws Error if the action id is unknown */
  currentDurationMs(id: ActionId): number {
    return this.stats.currentDurationMs(id);
  }

  /** Current speed multiplier of an action. */
  currentSpeed(id: ActionId): number {
    return this.stats.currentSpeed(id);
  }

  /** The factors the current speed of an action is made of. */
  speedFactors(id: ActionId): readonly SpeedFactor[] {
    return this.stats.speedFactors(id);
  }

  /** Overclock for an action (its speed bonus, heat cost and whether it is on), or `null` when there is no toggle to show. */
  overclockStatus(id: ActionId): OverclockStatus | null {
    return this.stats.overclockStatus(id);
  }

  /** Focus for an action (its speed bonus, the slots and whether it is on), or `null` when there is no toggle to show. */
  focusStatus(id: ActionId): FocusStatus | null {
    return this.stats.focusStatus(id);
  }

  /** Levels added to an action's level for speed by buyables; its XP progress is not affected. */
  levelBonus(id: ActionId): number {
    return this.stats.levelBonus(id);
  }

  /** The actions that can drop one stack of items now, with the chance that one completed run of each drops it. See `DerivedStats.dropSources`. */
  dropSources(itemId: ItemId, rarityId: RarityId): readonly { readonly actionId: ActionId; readonly chance: number }[] {
    return this.stats.dropSources(itemId, rarityId);
  }

  /** Multiplier on the action's own reward per run, from purchases (>= 1). It scales that reward only. */
  rewardMultiplier(id: ActionId): BigNum {
    return this.stats.rewardMultiplier(id);
  }

  /** True when the action restarts itself. */
  isAutoRun(id: ActionId): boolean {
    return this.stats.isAutoRun(id);
  }

  /** Amount earned per completed run (credits, nodes, ...; see `ActionDefinition.rewardKind`). @throws Error if unknown */
  rewardPerRun(id: ActionId): BigNum {
    return this.stats.rewardPerRun(id);
  }

  /** What a completed run actually adds to the balance now (heat does not tax it). @throws Error if unknown */
  payoutPerRun(id: ActionId): BigNum {
    return this.stats.payoutPerRun(id);
  }

  /** Action XP gained per completed run now. @throws Error if unknown */
  xpPerRun(id: ActionId): BigNum {
    return this.stats.xpPerRun(id);
  }

  // ---- queries about levels -------------------------------------------------------------------------------------

  /** Level of an action. @throws Error if unknown */
  actionLevel(id: ActionId): number {
    return this.progression.actionLevel(this.state, id);
  }

  /** XP gathered inside the action's current level. @throws Error if unknown */
  actionXpIntoLevel(id: ActionId): BigNum {
    return this.progression.actionXpIntoLevel(this.state, id);
  }

  /** XP that leaving the action's current level costs on its own. @throws Error if unknown */
  actionXpForLevel(id: ActionId): BigNum {
    return this.progression.actionXpForLevel(this.state, id);
  }

  /** Sleeve XP gathered inside the action's current sleeve level. @throws Error if unknown */
  sleeveXpIntoLevel(id: ActionId): BigNum {
    return this.progression.sleeveXpIntoLevel(this.state, id);
  }

  /** Sleeve XP that leaving the action's current sleeve level costs on its own, after any reduction. @throws Error if unknown */
  sleeveXpForLevel(id: ActionId): BigNum {
    return this.progression.sleeveXpForLevel(this.state, id);
  }

  /** Total XP at which the action reaches its next level. @throws Error if unknown */
  nextActionLevelXp(id: ActionId): BigNum {
    return this.progression.nextActionLevelXp(this.state, id);
  }

  /** Fraction (0..1) of the way to the action's next level. @throws Error if unknown */
  actionLevelProgress(id: ActionId): number {
    return this.progression.actionLevelProgress(this.state, id);
  }

  /** Sleeve level of an action. @throws Error if unknown */
  sleeveLevel(id: ActionId): number {
    return this.progression.sleeveLevel(this.state, id);
  }

  /** Total sleeve XP at which the action's next sleeve level is reached. @throws Error if unknown */
  nextSleeveLevelXp(id: ActionId): BigNum {
    return this.progression.nextSleeveLevelXp(this.state, id);
  }

  /** Fraction (0..1) of the way to the action's next sleeve level. @throws Error if unknown */
  sleeveLevelProgress(id: ActionId): number {
    return this.progression.sleeveLevelProgress(this.state, id);
  }

  /** Completed runs one batch of sleeve XP takes right now (lowered by `runsPerSleeveXpReduction` buyables). */
  runsPerSleeveXp(): number {
    return this.progression.runsPerSleeveXp(this.state);
  }

  /** Fraction by which the action's sleeve levels need less XP (0 without reduction buyables). */
  sleeveXpReduction(id: ActionId): number {
    return this.progression.sleeveXpReduction(this.state, id);
  }

  // ---- queries about the sleeve and the shop -------------------------------------------------------------------

  /** The global sleeve stats (access level, interface speed, heat, ...) after sleeve-wide purchases. */
  sleeveStats(): SleeveStats {
    return this.stats.sleeveStats();
  }

  /** True when using a Burn lead of this rarity would do something (one is held and there is heat). */
  canUseBurnLead(rarityId: RarityId): boolean {
    return this.burnLeads.canUse(rarityId);
  }

  /** True when pressing the Zero-day toggle would do something (it is on, or a Zero-day is held). */
  canToggleZeroDays(): boolean {
    return this.zeroDays.canToggle();
  }

  /** True when pressing the Admin key toggle would do something (it is on, or an Admin key is held). */
  canToggleAdminKeys(): boolean {
    return this.adminKeys.canToggle();
  }

  /** True when using a Skill shard would do something (one is held and some action is unlocked). */
  canUseSkillShard(): boolean {
    return this.skillShards.canUse();
  }

  /** True while heat cannot cool or be reduced at all (an action is running with an Overclock that stops heat cooling). */
  heatCoolingBlocked(): boolean {
    return this.stats.heatCoolingBlocked();
  }

  /** The back channel unlocked by a skill (which item and rarity can be given up, and for how many Moles each), or `null`. */
  backChannel(): BackChannelRule | null {
    return this.stats.backChannel();
  }

  /** Skill points the player can still spend (earned from the action levels, minus what the owned skills cost). */
  skillPointsEarned(): number {
    return this.shop.skillPointsEarned(this.state);
  }

  /** Skill points the player can still spend. */
  skillPoints(): number {
    return this.shop.pointsAvailable(this.state, 'skillPoints');
  }

  /** Re-sleeve points the player can still spend (earned by re-sleeving, minus what the owned re-sleeve skills cost). */
  resleevePoints(): number {
    return this.shop.pointsAvailable(this.state, 'resleevePoints');
  }

  /** True while the Corporation tab is open (a purchase with the `unlocksCorporation` effect is owned). */
  isCorporationUnlocked(): boolean {
    return this.corporationUnit.isUnlocked();
  }

  /** The corporate rank (what gates the corporation's actions). */
  corporateRank(): number {
    return this.corporationUnit.rank();
  }

  /** How long one run of a corporation action takes now, in milliseconds (its action level speeds it up). */
  corporationRunMs(id: CorporationActionId): number {
    return this.corporationUnit.durationMs(id);
  }

  /** Stocks of competitors the corporation holds. */
  corporationStocks(): number {
    return this.state.corporation.stocks;
  }

  /** The action level of a corporation action. */
  corporationLevel(id: CorporationActionId): number {
    return this.corporationUnit.levels.level(id);
  }

  /** Action XP gathered inside the current level of a corporation action. */
  corporationXpIntoLevel(id: CorporationActionId): BigNum {
    return this.corporationUnit.levels.xpIntoLevel(id);
  }

  /** Action XP the current level of a corporation action costs on its own. */
  corporationXpForLevel(id: CorporationActionId): BigNum {
    return this.corporationUnit.levels.xpForLevel(id);
  }

  /** How far through its current level a corporation action is, from 0 to 1. */
  corporationLevelProgress(id: CorporationActionId): number {
    return this.corporationUnit.levels.progress(id);
  }

  /** The corporation's actions, in the order the tab lists them. */
  corporationActions(): readonly CorporationActionDefinition[] {
    return this.corporationUnit.actions();
  }

  /** True when starting the corporation action now would work (the corporation is open and the action exists). */
  canStartCorporationAction(id: CorporationActionId): boolean {
    return this.corporationUnit.canStart(id);
  }

  /**
   * Starts a corporation action. Its run takes the action's own duration; interface speed does not apply.
   *
   * @param id the corporation action
   * @returns true when it is now running
   */
  startCorporationAction(id: CorporationActionId): boolean {
    return this.corporationUnit.start(id);
  }

  /** True when the player owns the skill that gives synthetic sleeves. */
  synthSleevesUnlocked(): boolean {
    return this.synths.isUnlocked();
  }

  /** How many synthetic sleeves the player has. */
  synthCount(): number {
    return this.synths.count();
  }

  /** Credits per second all synthetic sleeves earn together (not taxed by heat). */
  synthCreditsPerSecond(): BigNum {
    return this.synths.creditsPerSecond();
  }

  /** The share of earned credits kept after the heat tax (`1 - heat * (1 - iceRating reduction) / 100`, never below 0). */
  creditKeepFactor(): number {
    return this.stats.creditKeepFactor();
  }

  /** Credits one network node delivers per second right now, after the heat tax and the node payout multiplier. */
  passiveCreditsPerNode(): BigNum {
    return this.stats.passiveCreditsPerNode();
  }

  /** Credits the network delivers per second right now, after the heat tax and the node payout multiplier. */
  passiveCreditsPerSecond(): BigNum {
    return this.stats.passiveCreditsPerSecond();
  }

  /** What a buyable is paid in. @throws Error if unknown */
  currencyOf(id: BuyableId): Currency {
    return this.shop.currencyOf(id);
  }

  /** Price of the next copy of a buyable (in its currency), including the global cost lever. @throws Error if unknown */
  costOf(id: BuyableId): BigNum {
    return this.shop.costOf(this.state, id);
  }

  /** Copies of a buyable owned. */
  ownedCount(id: BuyableId): number {
    return this.shop.owned(this.state, id);
  }

  /** True when the buyable's requirements are met. */
  isBuyableAvailable(id: BuyableId): boolean {
    return this.shop.isAvailable(this.state, id);
  }

  /** The automation features: points, unlocks and settings. */
  automation(): AutomationControls {
    return this.automationUnit;
  }

  /** Critical successes of an action in the last second of game time, for highlighting it (not saved). */
  recentCrits(id: ActionId): RecentCrits {
    return this.critFeed.recent(id);
  }

  /** True when the buyable is available and close enough to the player's means to be shown (see `reveal.buyableOrders`). */
  isBuyableRevealed(id: BuyableId): boolean {
    return this.shop.isRevealed(this.state, id);
  }

  /** True when no more copies can be bought. */
  isBuyableMaxed(id: BuyableId): boolean {
    return this.shop.isMaxed(this.state, id);
  }

  /** True when the buyable can be bought right now. */
  canBuy(id: BuyableId): boolean {
    return this.shop.canBuy(this.state, id);
  }

  /** True when an owned auto-run buyable is switched on (false when off, not owned or not an auto-run). */
  isAutoRunEnabled(id: BuyableId): boolean {
    return this.ownedCount(id) > 0 && !this.state.autoRunOff[id];
  }

  /** True when the player may re-sleeve right now. */
  canResleeve(): boolean {
    return this.resleevePolicy.canResleeve(this.state);
  }

  // ---- time ----------------------------------------------------------------------------------------------------

  /**
   * Advances the game by `deltaMs` of game time.
   *
   * @remarks
   * A tick longer than `engine.maxSliceMs` is cut into equal slices (at most `engine.maxSlicesPerTick`) that run one after another,
   * so feedback between systems (interface speed rising with each run, heat cooling while the network pays, nodes grown
   * by one action paying for another) follows the same course for one long tick as for many short ones. Beyond the
   * slice cap the slices get longer and those effects become approximate; the cost of a tick is bounded either way.
   * See {@link GameEngine.advance} for what one slice does.
   *
   * @param deltaMs elapsed game time in milliseconds (>= 0; zero, negative, NaN and infinite values are ignored)
   */
  tick(deltaMs: number): void {
    if (!(deltaMs > 0) || !Number.isFinite(deltaMs)) return;
    const { maxSliceMs, maxSlicesPerTick } = this.config.engine;
    const wanted = Math.ceil(deltaMs / maxSliceMs);
    if (wanted > maxSlicesPerTick) {
      for (let i = 0; i < maxSlicesPerTick; i++) this.advance(deltaMs / maxSlicesPerTick);
      return;
    }
    // Whole slices of maxSliceMs and a shorter last one: for whole milliseconds the split is exact, so no rounding error
    // creeps into the cooldown timers.
    for (let i = 0; i < wanted - 1; i++) this.advance(maxSliceMs);
    this.advance(deltaMs - (wanted - 1) * maxSliceMs);
  }

  /**
   * One slice of a tick. First the network pays passive income for the whole slice using the nodes owned at the start of
   * it (nodes finished during the slice start producing in the next one), then it grows by its own growth rate, and heat
   * and Legend decay; then every action advances. Heat that actions add during the slice only starts cooling in the
   * next one. Finally the {@link OverflowPolicy} repairs any amount that left the representable range.
   */
  private advance(deltaMs: number): void {
    this.critFeed.advance(deltaMs);
    this.network.payPassiveIncome(deltaMs);
    this.network.grow(deltaMs);
    const sleeve = this.stats.sleeveStats();
    // An Overclock that stops heat cooling holds the cooldown in place while its action runs.
    if (!this.stats.heatCoolingBlocked()) {
      const pace = coolingPace({
        speed: sleeve.heatCooldownSpeed,
        boost: sleeve.heatCooldownBoost,
        moles: this.state.moles,
        idle: this.stats.heatIsIdle(),
        idleFactor: sleeve.idleHeatCooldown,
        moleAggregation: sleeve.moleAggregation,
      });
      coolDownHeat(this.state, this.config.sleeve, deltaMs, pace.speed, pace.boost, sleeve.heatCooldownAmount);
    }
    decayLegend(this.state, this.config.sleeve, deltaMs);
    this.resleeveLockout.advance(deltaMs);
    this.runner.tickAll(deltaMs);
    this.corporationUnit.tickAll(deltaMs);
    this.automationUnit.step();
    this.overflowPolicy.apply(this.state);
    notePeaks(this.state);
  }
}
