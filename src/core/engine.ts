/**
 * @module core
 *
 * The game engine: advances time, completes runs, pays rewards.
 *
 * @remarks
 * No timers, no DOM, no storage: time enters only through {@link GameEngine.tick}'s
 * `deltaMs` argument, which makes the engine fully deterministic and unit-testable.
 */
import type { BigNum, NumberFactory } from '../numbers';
import type { Economy } from './economy';
import { resolveEffects, resolveLevelBonus, resolveNetworkGrowth, resolveSleeveStats, type SleeveStats } from './effects';
import { applyCompletionEffects } from './completion';
import { payReward } from './rewards';
import { coolHeat, heatTaxFactor } from './heat';
import type { OverflowPolicy } from './overflow';
import type { Progression } from './progression';
import type { ResleevePolicy } from './resleeve';
import type { PurchaseResult, Shop } from './shop';
import { effectiveDurationMs, speedMultiplier, type SpeedModifier } from './speed';
import { resetForNewGame, resetForResleeve } from './state';
import type { ActionDefinition, ActionId, BuyableId, Currency, GameConfig, GameState, GameStateView } from './types';

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
 * Called by: `app/loop.ts` (tick), `ui` event handlers (commands), `ui/viewModel.ts` (queries), `app/createGame.ts` (construction).
 * Calls: {@link Progression}, {@link Shop}, {@link Economy}, `resolveEffects`, `speedMultiplier`, `coolHeat`, {@link OverflowPolicy}.
 */
export class GameEngine {
  private readonly actionsById = new Map<ActionId, ActionDefinition>();
  private readonly progression: Progression;
  private readonly shop: Shop;
  private readonly economy: Economy;
  private readonly speedModifiers: readonly SpeedModifier[];
  private readonly resleevePolicy: ResleevePolicy;
  private readonly overflowPolicy: OverflowPolicy;
  private readonly factory: NumberFactory;

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
      speedModifiers: this.speedModifiers,
      resleevePolicy: this.resleevePolicy,
      overflowPolicy: this.overflowPolicy,
      factory: this.factory,
    } = deps);
    for (const a of config.actions) this.actionsById.set(a.id, a);
  }

  /** Read-only view of the current state. */
  getState(): GameStateView {
    return this.state;
  }

  /** The configuration this engine runs. */
  getConfig(): GameConfig {
    return this.config;
  }

  /**
   * Starts an action manually. Does nothing if it is already running. An action with a start cost pays it now; without
   * enough of the currency the action does not start.
   * @returns true when the action is now running
   */
  startAction(id: ActionId): boolean {
    const action = this.state.actions[id];
    if (!action || !this.isUnlocked(id)) return false;
    if (action.running) return true;
    if (!this.payStartCost(this.requireDefinition(id))) return false;
    action.running = true;
    return true;
  }

  /**
   * True when the action can be performed: the sleeve's access level is high enough (`requiredAccessLevel`, default 1) and its
   * `unlock` rule holds (enough nodes reached, which stays true once reached, or the buyable is owned). Locked actions
   * cannot start and do not progress.
   * @throws Error if the action id is unknown
   */
  isUnlocked(id: ActionId): boolean {
    const def = this.requireDefinition(id);
    if (this.sleeveStats().accessLevel < (def.requiredAccessLevel ?? 1)) return false;
    return !def.unlock || this.unlockRuleHolds(def);
  }

  /**
   * The share of earned credits kept after the heat tax (`1 - heat * (1 - circumvention reduction) / 100`, never below 0).
   */
  creditKeepFactor(): number {
    return heatTaxFactor(this.state.heat, this.sleeveStats().heatReduction);
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

  /** True when an owned auto-run buyable is switched on (false when off, not owned or not an auto-run). */
  isAutoRunEnabled(id: BuyableId): boolean {
    return this.ownedCount(id) > 0 && !this.state.autoRunOff[id];
  }

  /** Buys one copy of a buyable. Auto-run takes effect on the next tick. */
  buy(id: BuyableId): PurchaseResult {
    return this.shop.buy(this.state, id);
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

  /** True when the player may re-sleeve right now. */
  canResleeve(): boolean {
    return this.resleevePolicy.canResleeve(this.state);
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

  /** Fraction (0..1) of the way to the action's next sleeve level. @throws Error if unknown */
  sleeveLevelProgress(id: ActionId): number {
    return this.progression.sleeveLevelProgress(this.state, id);
  }

  /** Sleeve level of an action. @throws Error if unknown */
  sleeveLevel(id: ActionId): number {
    return this.progression.sleeveLevel(this.state, id);
  }

  /** Sleeve XP at which the action's next sleeve level is reached. @throws Error if unknown */
  nextSleeveLevelXp(id: ActionId): BigNum {
    return this.progression.nextSleeveLevelXp(this.state, id);
  }

  /**
   * Credits the network delivers per second right now, after the heat tax:
   * `nodes * network.creditsPerNodePerSecond * global.rewardMultiplier * (1 - heat / 100)`.
   */
  passiveCreditsPerSecond(): BigNum {
    const stats = this.sleeveStats();
    return this.economy.passiveCreditsPerSecond(this.state.network, this.state.heat, stats.heatReduction, stats.nodePayoutMultiplier);
  }

  /**
   * Current duration of one run of an action, after speed modifiers.
   * @throws Error if the action id is unknown
   */
  currentDurationMs(id: ActionId): number {
    const def = this.requireDefinition(id);
    return effectiveDurationMs(def.baseDurationMs, this.currentSpeed(id));
  }

  /** Levels added to an action's level for speed by buyables (see `resolveLevelBonus`); its XP progress is not affected. */
  levelBonus(id: ActionId): number {
    return resolveLevelBonus(this.config.buyables, this.state, id, (source) => this.progression.sleeveLevel(this.state, source));
  }

  /** Fraction by which the action's sleeve levels need less XP (0 without reduction buyables, and 0 for the action feeding the reduction). */
  sleeveXpReduction(id: ActionId): number {
    return this.progression.sleeveXpReduction(this.state, id);
  }

  /** Current speed multiplier of an action. */
  currentSpeed(id: ActionId): number {
    return speedMultiplier(this.speedModifiers, {
      actionId: id,
      actionLevel: this.progression.actionLevel(this.state, id) + this.levelBonus(id),
      sleeveLevel: this.progression.sleeveLevel(this.state, id),
      interfaceSpeed: this.sleeveStats().interfaceSpeed,
    });
  }

  /** Output multiplier from purchases for an action (>= 1). */
  outputMultiplier(id: ActionId): BigNum {
    return resolveEffects(this.config.buyables, this.state, id, this.factory).outputMultiplier;
  }

  /** The global sleeve stats (access level, interface speed, heat) after sleeve-wide purchases. */
  sleeveStats(): SleeveStats {
    return resolveSleeveStats(this.config.buyables, this.state, this.config.sleeve, this.factory);
  }

  /** True when the action restarts itself. */
  isAutoRun(id: ActionId): boolean {
    return resolveEffects(this.config.buyables, this.state, id, this.factory).autoRun;
  }

  /**
   * Amount earned per completed run of an action now, BEFORE the heat tax (credits or network nodes, see
   * `ActionDefinition.rewardKind`): `reward * (nodes, if rewardPerNetworkNode) * outputMultiplier * global.rewardMultiplier`.
   * @throws Error if the action id is unknown
   */
  rewardPerRun(id: ActionId): BigNum {
    return this.economy.grossReward(this.requireDefinition(id), this.state.network, this.outputMultiplier(id));
  }

  /**
   * What a completed run actually adds to the balance now: `rewardPerRun`, and for credits also after the heat tax.
   * Network nodes and interface speed are not taxed.
   * @throws Error if the action id is unknown
   */
  payoutPerRun(id: ActionId): BigNum {
    return this.economy.payout(this.requireDefinition(id), this.rewardPerRun(id), this.state.heat, this.sleeveStats().heatReduction);
  }

  /**
   * Action XP gained per completed run now: `xpPerRun * outputMultiplier * global.xpMultiplier`.
   * @throws Error if the action id is unknown
   */
  xpPerRun(id: ActionId): BigNum {
    return this.economy.xpPerRun(this.requireDefinition(id), this.outputMultiplier(id));
  }

  /**
   * Advances the game by `deltaMs` of game time.
   *
   * @remarks
   * First the network pays passive income for the whole `deltaMs` using the nodes owned at the start of the
   * tick (nodes finished during this tick start producing on the next one), then it grows by its own growth rate, and heat cools down; then every action
   * advances. Heat that actions add during the tick only starts cooling on the next tick.
   *
   * A tick longer than `engine.maxSliceMs` is cut into equal slices (at most `engine.maxSlicesPerTick`) that run one after another,
   * so feedback between systems (interface speed rising with each run, heat cooling while the network pays, nodes grown
   * by one action paying for another) follows the same course for one long tick as for many short ones. Beyond the
   * slice cap the slices get longer and those effects become approximate; the cost of a tick is bounded either way.
   *
   * Runs are computed in closed form: all runs between two level changes are applied as one batch, so the cost of a
   * tick does not depend on how many runs it contains. At most `engine.maxBatchesPerTick` batches are processed per
   * action; time beyond that is discarded. When a non-auto action completes, leftover time is discarded and the action
   * waits for the player. Finally the {@link OverflowPolicy} repairs any amount that left the representable range.
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

  /** One slice of a tick: every system advances by `deltaMs`, then overflow is repaired. */
  private advance(deltaMs: number): void {
    this.latchUnlocks();
    this.payPassiveIncome(deltaMs);
    this.growNetwork(deltaMs);
    this.coolDownHeat(deltaMs);
    this.decayInfamy(deltaMs);
    for (const def of this.config.actions) this.tickAction(def, deltaMs);
    this.latchUnlocks();
    this.overflowPolicy.apply(this.state);
  }

  /** True when the action's `unlock` rule is met right now (a reached node count stays met). */
  private unlockRuleHolds(def: ActionDefinition): boolean {
    const rule = def.unlock;
    if (!rule) return true;
    if (rule.kind === 'buyable') return this.ownedCount(rule.buyableId) > 0;
    return this.state.unlockedActions[def.id] === true || this.state.network.gte(this.factory.fromNumber(rule.amount));
  }

  /** Remembers every action whose node-count unlock has been reached, so it stays unlocked if the network shrinks later. */
  private latchUnlocks(): void {
    for (const def of this.config.actions) {
      if (def.unlock?.kind === 'nodes' && !this.state.unlockedActions[def.id] && this.unlockRuleHolds(def)) {
        this.state.unlockedActions[def.id] = true;
      }
    }
  }

  /**
   * What starting the action would cost right now: the fixed amount plus the share of the balance held (network nodes are
   * rounded down to whole nodes).
   * @returns the cost, or `null` when starting is free
   * @throws Error if the action id is unknown
   */
  startCostOf(id: ActionId): BigNum | null {
    const cost = this.requireDefinition(id).startCost;
    if (!cost) return null;
    const balance = cost.currency === 'networkNodes' ? this.state.network : this.state.credits;
    let total = cost.amount ?? this.factory.fromNumber(0);
    if (cost.fractionOfBalance !== undefined) {
      const share = balance.mul(this.factory.fromNumber(cost.fractionOfBalance));
      total = total.add(cost.currency === 'networkNodes' ? share.floor() : share);
    }
    return total;
  }

  /**
   * Pays an action's start cost, if it has one. A share-of-balance cost that comes to 0 cannot be paid (the run would be free).
   * @returns false (and pays nothing) when the player cannot afford it
   */
  private payStartCost(def: ActionDefinition): boolean {
    const cost = def.startCost;
    const price = this.startCostOf(def.id);
    if (!cost || !price) return true;
    const balance = cost.currency === 'networkNodes' ? this.state.network : this.state.credits;
    if (balance.lt(price) || (cost.fractionOfBalance !== undefined && price.isZero())) return false;
    if (cost.currency === 'networkNodes') this.state.network = this.state.network.sub(price);
    else this.state.credits = this.state.credits.sub(price);
    return true;
  }

  private tickAction(def: ActionDefinition, deltaMs: number): void {
    const action = this.state.actions[def.id];
    if (!action || !this.isUnlocked(def.id)) return;
    const auto = this.isAutoRun(def.id);
    if (auto && !action.running) {
      if (!this.payStartCost(def)) return;
      action.running = true;
    }
    if (!action.running) return;

    let remaining = deltaMs;
    for (let batches = 0; action.running && remaining > 0; batches++) {
      if (batches >= this.config.engine.maxBatchesPerTick) {
        action.progressMs = 0;
        return;
      }
      const duration = this.currentDurationMs(def.id);
      const needed = Math.max(0, duration - action.progressMs); // progress can exceed a duration that just got shorter
      if (remaining < needed) {
        action.progressMs += remaining;
        return;
      }
      const runs = auto && !def.startCost ? this.runsInBatch(def, remaining - needed, duration) : 1;
      remaining -= needed + (runs - 1) * duration;
      action.progressMs = 0;
      this.completeRuns(def, runs);
      if (!auto || (def.startCost && !this.payStartCost(def))) action.running = false;
    }
  }

  /**
   * How many runs complete in one batch: as many as fit in the time left (the first run is already paid for by
   * `needed`) but no more than can happen before a level change alters the speed.
   *
   * @param def the action
   * @param spareMs time left after the first run completes
   * @param durationMs duration of one run at the current speed
   */
  private runsInBatch(def: ActionDefinition, spareMs: number, durationMs: number): number {
    const byTime = 1 + Math.floor(spareMs / durationMs);
    const byLevel = this.progression.runsBeforeLevelChange(this.state, def.id, this.xpPerRun(def.id), this.outputMultiplier(def.id));
    return Math.max(1, Math.min(byTime, byLevel, Number.MAX_SAFE_INTEGER));
  }

  /** Cools heat; each point of Infamy makes a cooldown cycle `sleeve.infamyHeatSlowdown` longer (using the Infamy at the start of the tick). */
  private coolDownHeat(deltaMs: number): void {
    const { heatCooldownMs, heatCooldownAmount: amount, infamyHeatSlowdown } = this.config.sleeve;
    const cycleMs = heatCooldownMs * (1 + infamyHeatSlowdown * this.state.infamy);
    const cooled = coolHeat({ heat: this.state.heat, cooldownMs: this.state.heatCooldownMs }, deltaMs, cycleMs, amount);
    this.state.heat = cooled.heat;
    this.state.heatCooldownMs = cooled.cooldownMs;
  }

  /** Infamy falls by exactly 1 each time a `sleeve.infamyDecayPeriodMs` cycle completes (like the heat cooldown). */
  private decayInfamy(deltaMs: number): void {
    const cooled = coolHeat(
      { heat: this.state.infamy, cooldownMs: this.state.infamyCooldownMs },
      deltaMs,
      this.config.sleeve.infamyDecayPeriodMs,
      1,
    );
    this.state.infamy = cooled.heat;
    this.state.infamyCooldownMs = cooled.cooldownMs;
  }

  /**
   * Compounds the network by its growth rate over `deltaMs` (closed form, so tick length does not matter). Nodes are whole:
   * the growth is added to a carried fraction and only complete nodes join the network.
   */
  private growNetwork(deltaMs: number): void {
    const rate = resolveNetworkGrowth(this.config.buyables, this.state);
    if (!(rate > 0) || this.state.network.isZero()) return;
    const factor = Math.expm1(Math.log1p(rate) * (deltaMs / 1000));
    const growth = this.state.network.mul(this.factory.fromNumber(factor)).add(this.factory.fromNumber(this.state.networkRemainder));
    const whole = growth.floor();
    this.state.networkRemainder = growth.sub(whole).toNumber();
    this.state.network = this.state.network.add(whole);
  }

  private payPassiveIncome(deltaMs: number): void {
    if (this.state.network.isZero()) return;
    const income = this.passiveCreditsPerSecond().mul(this.factory.fromNumber(deltaMs / 1000));
    this.state.credits = this.state.credits.add(income);
  }

  /**
   * Applies `runs` completed runs of an action at once. Rewards are computed before heat and XP change; runs of an
   * action that adds heat pay a falling amount because each run raises the tax on the next ({@link Economy.creditsForRuns}).
   */
  private completeRuns(def: ActionDefinition, runs: number): void {
    const count = this.factory.fromNumber(runs);
    const multiplier = this.outputMultiplier(def.id);
    const gross = this.economy.grossReward(def, this.state.network, multiplier);
    const heatPerRun = def.heatPerRun ?? 0;
    if (def.rewardKind === undefined || def.rewardKind === 'credits') {
      this.state.credits = this.state.credits.add(
        this.economy.creditsForRuns(gross, runs, this.state.heat, heatPerRun, this.sleeveStats().heatReduction),
      );
    } else {
      payReward(this.state, def.rewardKind, gross, count);
    }
    this.state.heat += runs * heatPerRun;
    this.latchUnlocks(); // before completion effects can shrink the network
    applyCompletionEffects(def.completionEffects, this.state, runs, this.factory);
    this.progression.recordRuns(this.state, def.id, this.economy.xpPerRun(def, multiplier).mul(count), multiplier.mul(count));
  }

  private requireDefinition(id: ActionId): ActionDefinition {
    const def = this.actionsById.get(id);
    if (!def) throw new Error(`Unknown action: ${id}`);
    return def;
  }
}
