/**
 * @module core
 *
 * The game engine: the facade that ties the subsystems together and advances time.
 *
 * @remarks
 * No timers, no DOM, no storage: time enters only through {@link GameEngine.tick}'s
 * `deltaMs` argument, which makes the engine fully deterministic and unit-testable.
 * The rules themselves live in small units: `DerivedStats` (calculations), `ActionRunner` (actions and runs),
 * `NetworkSystem` (passive income and growth), `cooldowns.ts` (heat and Infamy decay), `Shop` and `Progression`.
 */
import type { BigNum, NumberFactory } from '../numbers';
import { createActionLookup } from './actionLookup';
import { ActionRunner } from './actionRunner';
import type { ActivateResult, GameCommands, GameQueries } from './api';
import { coolDownHeat, decayInfamy } from './cooldowns';
import type { Economy } from './economy';
import type { SleeveStats } from './effects';
import { NetworkSystem } from './network';
import type { OverflowPolicy } from './overflow';
import type { Progression } from './progression';
import type { ResleevePolicy } from './resleeve';
import type { PurchaseResult, Shop } from './shop';
import type { SpeedModifier } from './speed';
import { resetForNewGame, resetForResleeve } from './state';
import { DerivedStats } from './stats';
import type { ActionId, BuyableId, Currency, GameConfig, GameState, GameStateView } from './types';

/** The collaborators a {@link GameEngine} is built from (all injected; see `app/createGame.ts`). */
export interface EngineDependencies {
  /** XP/level service. */
  readonly progression: Progression;
  /** Purchase service. */
  readonly shop: Shop;
  /** Reward, XP and passive-income formulas. */
  readonly economy: Economy;
  /** Factors of the speed multiplier. */
  readonly speedModifiers: readonly SpeedModifier[];
  /** Decides when re-sleeving is allowed. */
  readonly resleevePolicy: ResleevePolicy;
  /** Reaction to numbers leaving the representable range. */
  readonly overflowPolicy: OverflowPolicy;
  /** Number factory. */
  readonly factory: NumberFactory;
}

/**
 * Orchestrates the core game rules. Depends on collaborators passed to the
 * constructor (dependency inversion); owns the single mutable {@link GameState}.
 *
 * Called by: `app/loop.ts` (tick), `ui` event handlers ({@link GameCommands}), `ui/viewModel.ts` ({@link GameQueries}),
 * `app/createGame.ts` (construction).
 * Calls: {@link DerivedStats}, {@link ActionRunner}, {@link NetworkSystem}, {@link Progression}, {@link Shop},
 * `coolDownHeat`, `decayInfamy`, {@link OverflowPolicy}.
 */
export class GameEngine implements GameQueries, GameCommands {
  private readonly progression: Progression;
  private readonly shop: Shop;
  private readonly economy: Economy;
  private readonly resleevePolicy: ResleevePolicy;
  private readonly overflowPolicy: OverflowPolicy;
  private readonly factory: NumberFactory;
  private readonly stats: DerivedStats;
  private readonly runner: ActionRunner;
  private readonly network: NetworkSystem;

  /**
   * Creates an engine. Construct through `app/createGame.ts` rather than directly.
   *
   * @param config content and tuning
   * @param state initial state (owned by the engine from now on)
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
      economy: this.economy,
      resleevePolicy: this.resleevePolicy,
      overflowPolicy: this.overflowPolicy,
      factory: this.factory,
    } = deps);
    const definition = createActionLookup(config.actions);
    this.stats = new DerivedStats(config, state, this.progression, this.economy, deps.speedModifiers, this.factory, definition);
    this.runner = new ActionRunner(config, state, this.stats, this.progression, this.economy, this.shop, this.factory, definition);
    this.network = new NetworkSystem(config, state, this.stats, this.factory);
  }

  /** Read-only view of the current state. */
  getState(): GameStateView {
    return this.state;
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
    return this.runner.start(id);
  }

  /**
   * Switches an owned auto-run buyable on or off.
   * @param id the auto-run buyable
   * @returns true when auto-run is now on; false when it is now off or the buyable is not owned (nothing changes then)
   */
  toggleAutoRun(id: BuyableId): boolean {
    const owned = this.ownedCount(id) > 0 && this.config.buyables.some((b) => b.id === id && b.effect.kind === 'autoRun');
    if (!owned) return false;
    if (this.state.autoRunOff[id]) delete this.state.autoRunOff[id];
    else this.state.autoRunOff[id] = true;
    return !this.state.autoRunOff[id];
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
    const isAutoRun = this.config.buyables.some((b) => b.id === id && b.effect.kind === 'autoRun');
    if (isAutoRun && this.ownedCount(id) > 0) return this.toggleAutoRun(id) ? 'switched-on' : 'switched-off';
    return this.buy(id);
  }

  /**
   * Re-sleeves if the policy allows it.
   * @returns true when the reset was applied
   */
  resleeve(): boolean {
    if (!this.canResleeve()) return false;
    resetForResleeve(this.state, this.config, this.factory);
    return true;
  }

  /**
   * Wipes the game and starts over: everything is reset, including the sleeve XP that a re-sleeve keeps.
   * Not subject to the re-sleeve policy. The caller is responsible for the stored save (see `SaveGame.clear`).
   */
  newGame(): void {
    resetForNewGame(this.state, this.config, this.factory);
  }

  // ---- queries about actions ------------------------------------------------------------------------------------

  /**
   * True when the action can be performed (access level and `unlock` rule). Locked actions cannot start and do not progress.
   * @throws Error if the action id is unknown
   */
  isUnlocked(id: ActionId): boolean {
    return this.runner.isUnlocked(id);
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

  /** Levels added to an action's level for speed by buyables; its XP progress is not affected. */
  levelBonus(id: ActionId): number {
    return this.stats.levelBonus(id);
  }

  /** Output multiplier from purchases for an action (>= 1). */
  outputMultiplier(id: ActionId): BigNum {
    return this.stats.outputMultiplier(id);
  }

  /** True when the action restarts itself. */
  isAutoRun(id: ActionId): boolean {
    return this.stats.isAutoRun(id);
  }

  /** Amount earned per completed run BEFORE the heat tax (credits, nodes, ...; see `ActionDefinition.rewardKind`). @throws Error if unknown */
  rewardPerRun(id: ActionId): BigNum {
    return this.stats.rewardPerRun(id);
  }

  /** What a completed run actually adds to the balance now (credits after the heat tax). @throws Error if unknown */
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

  /** XP at which the action reaches its next level. @throws Error if unknown */
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

  /** Sleeve XP at which the action's next sleeve level is reached. @throws Error if unknown */
  nextSleeveLevelXp(id: ActionId): BigNum {
    return this.progression.nextSleeveLevelXp(this.state, id);
  }

  /** Fraction (0..1) of the way to the action's next sleeve level. @throws Error if unknown */
  sleeveLevelProgress(id: ActionId): number {
    return this.progression.sleeveLevelProgress(this.state, id);
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

  /** The share of earned credits kept after the heat tax (`1 - heat * (1 - circumvention reduction) / 100`, never below 0). */
  creditKeepFactor(): number {
    return this.stats.creditKeepFactor();
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
   * @param deltaMs elapsed game time in milliseconds (>= 0)
   */
  tick(deltaMs: number): void {
    if (!(deltaMs > 0)) return;
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
   * and Infamy decay; then every action advances. Heat that actions add during the slice only starts cooling in the
   * next one. Finally the {@link OverflowPolicy} repairs any amount that left the representable range.
   */
  private advance(deltaMs: number): void {
    this.runner.latchUnlocks();
    this.network.payPassiveIncome(deltaMs);
    this.network.grow(deltaMs);
    coolDownHeat(this.state, this.config.sleeve, deltaMs);
    decayInfamy(this.state, this.config.sleeve, deltaMs);
    this.runner.tickAll(deltaMs);
    this.runner.latchUnlocks();
    this.overflowPolicy.apply(this.state);
  }
}
