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
import { resolveEffects, resolveSleeveStats, type SleeveStats } from './effects';
import { coolHeat, heatTaxFactor } from './heat';
import type { OverflowPolicy } from './overflow';
import type { Progression } from './progression';
import type { ResleevePolicy } from './resleeve';
import type { PurchaseResult, Shop } from './shop';
import { effectiveDurationMs, speedMultiplier, type SpeedModifier } from './speed';
import { resetForNewGame, resetForResleeve } from './state';
import type { ActionDefinition, ActionId, BuyableId, GameConfig, GameState, GameStateView } from './types';

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
   * Starts an action manually. Does nothing if it is already running.
   * @returns true when the action is now running
   */
  startAction(id: ActionId): boolean {
    const action = this.state.actions[id];
    if (!action || !this.isUnlocked(id)) return false;
    action.running = true;
    return true;
  }

  /**
   * True when the sleeve's access level is high enough to perform the action
   * (`ActionDefinition.requiredAccessLevel`, default 1). Locked actions cannot start and do not progress.
   * @throws Error if the action id is unknown
   */
  isUnlocked(id: ActionId): boolean {
    const def = this.requireDefinition(id);
    return this.sleeveStats().accessLevel >= (def.requiredAccessLevel ?? 1);
  }

  /**
   * The share of earned credits kept after the heat tax (`1 - heat / 100`, never below 0).
   */
  creditKeepFactor(): number {
    return heatTaxFactor(this.state.heat);
  }

  /** Buys one copy of a buyable. Auto-run takes effect on the next tick. */
  buy(id: BuyableId): PurchaseResult {
    return this.shop.buy(this.state, id);
  }

  /** Price of the next copy of a buyable, including the global cost lever. @throws Error if unknown */
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
    return this.economy.passiveCreditsPerSecond(this.state.network, this.state.heat);
  }

  /**
   * Current duration of one run of an action, after speed modifiers.
   * @throws Error if the action id is unknown
   */
  currentDurationMs(id: ActionId): number {
    const def = this.requireDefinition(id);
    return effectiveDurationMs(def.baseDurationMs, this.currentSpeed(id));
  }

  /** Current speed multiplier of an action. */
  currentSpeed(id: ActionId): number {
    return speedMultiplier(this.speedModifiers, {
      actionId: id,
      actionLevel: this.progression.actionLevel(this.state, id),
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
    return resolveSleeveStats(this.config.buyables, this.state, this.config.sleeve);
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
   * Network nodes are not taxed.
   * @throws Error if the action id is unknown
   */
  payoutPerRun(id: ActionId): BigNum {
    return this.economy.payout(this.requireDefinition(id), this.rewardPerRun(id), this.state.heat);
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
   * tick (nodes finished during this tick start producing on the next one), and heat cools down; then every action
   * advances. Heat that actions add during the tick only starts cooling on the next tick.
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
    this.payPassiveIncome(deltaMs);
    this.coolDownHeat(deltaMs);
    for (const def of this.config.actions) this.tickAction(def, deltaMs);
    this.overflowPolicy.apply(this.state);
  }

  private tickAction(def: ActionDefinition, deltaMs: number): void {
    const action = this.state.actions[def.id];
    if (!action || !this.isUnlocked(def.id)) return;
    const auto = this.isAutoRun(def.id);
    if (auto) action.running = true;
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
      const runs = auto ? this.runsInBatch(def, remaining - needed, duration) : 1;
      remaining -= needed + (runs - 1) * duration;
      action.progressMs = 0;
      this.completeRuns(def, runs);
      if (!auto) action.running = false;
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

  private coolDownHeat(deltaMs: number): void {
    const { heatCooldownMs: cycleMs, heatCooldownAmount: amount } = this.config.sleeve;
    const cooled = coolHeat({ heat: this.state.heat, cooldownMs: this.state.heatCooldownMs }, deltaMs, cycleMs, amount);
    this.state.heat = cooled.heat;
    this.state.heatCooldownMs = cooled.cooldownMs;
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
    if (def.rewardKind === 'networkNodes') this.state.network = this.state.network.add(gross.mul(count));
    else this.state.credits = this.state.credits.add(this.economy.creditsForRuns(gross, runs, this.state.heat, heatPerRun));
    this.state.heat += runs * heatPerRun;
    this.progression.recordRuns(this.state, def.id, this.economy.xpPerRun(def, multiplier).mul(count), multiplier.mul(count));
  }

  private requireDefinition(id: ActionId): ActionDefinition {
    const def = this.actionsById.get(id);
    if (!def) throw new Error(`Unknown action: ${id}`);
    return def;
  }
}
