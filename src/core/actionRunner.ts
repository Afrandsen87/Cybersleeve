/**
 * @module core
 *
 * Running actions: unlock rules, start costs, run progress and the closed-form completion of runs.
 */
import type { BigNum, NumberFactory } from '../numbers';
import type { ActionLookup } from './actionLookup';
import { applyCompletionEffects } from './completion';
import { type Diagnostics, silentDiagnostics } from './diagnostics';
import type { ItemDrops } from './drops';
import type { Economy } from './economy';
import type { Progression } from './progression';
import { payReward } from './rewards';
import type { Shop } from './shop';
import type { DerivedStats } from './stats';
import type { ActionDefinition, ActionId, GameConfig, GameState } from './types';

/**
 * Rounding slack, as a share of one run: progress is a fraction, and `(1 - 0.9999) * 10000` is not exactly `1`. A run counts as
 * complete when the time left is within this share of the time it needs, so rounding can never keep a finished run waiting; and a
 * run that is not complete is always below `1 - PROGRESS_EPSILON`, so progress stays below 1.
 */
const PROGRESS_EPSILON = 1e-9;

/**
 * Starts actions and advances their runs.
 *
 * @remarks
 * Runs are computed in closed form: all runs between two level changes are applied as one batch, so the cost of a slice
 * does not depend on how many runs it contains. At most `engine.maxBatchesPerTick` batches are processed per action per
 * slice; time beyond that is discarded. When a non-auto action completes, leftover time is discarded and the action
 * waits for the player.
 *
 * Called by: `engine.ts`.
 * Calls: {@link DerivedStats}, {@link Progression}, {@link Economy}, {@link Shop} (ownership for unlock rules),
 * `payReward`, `applyCompletionEffects`, {@link ItemDrops}.
 */
export class ActionRunner {
  /**
   * Creates the unit.
   *
   * @param config content and tuning
   * @param state the live game state (mutated)
   * @param stats derived values
   * @param progression XP/level service
   * @param economy reward formulas
   * @param shop ownership of buyables (for `unlock: { kind: 'buyable' }` rules)
   * @param factory number factory
   * @param definition action lookup
   * @param drops rolls the items completed runs drop
   * @param diagnostics receives a warning when game time has to be dropped (default: ignored)
   */
  constructor(
    private readonly config: GameConfig,
    private readonly state: GameState,
    private readonly stats: DerivedStats,
    private readonly progression: Progression,
    private readonly economy: Economy,
    private readonly shop: Shop,
    private readonly factory: NumberFactory,
    private readonly definition: ActionLookup,
    private readonly drops: ItemDrops,
    private readonly diagnostics: Diagnostics = silentDiagnostics,
  ) {}

  /**
   * Starts an action manually. Does nothing if it is already running. An action with a start cost pays it now; without
   * enough of the currency the action does not start.
   * @returns true when the action is now running
   */
  start(id: ActionId): boolean {
    const action = this.state.actions[id];
    if (!action || !this.isUnlocked(id)) return false;
    if (action.running) return true;
    if (!this.payStartCost(this.definition(id))) return false;
    action.running = true;
    return true;
  }

  /**
   * True when the action can be performed: the sleeve's access level is high enough (`requiredAccessLevel`, default 1)
   * and its `unlock` rule holds. Locked actions cannot start and do not progress.
   * @throws Error if the action id is unknown
   */
  isUnlocked(id: ActionId): boolean {
    const def = this.definition(id);
    if (this.stats.sleeveStats().accessLevel < (def.requiredAccessLevel ?? 1)) return false;
    return !def.unlock || this.unlockRuleHolds(def);
  }

  /** Remembers every action whose node-count unlock has been reached, so it stays unlocked if the network shrinks later. */
  latchUnlocks(): void {
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
    const cost = this.definition(id).startCost;
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
   * Advances every action by `deltaMs` of game time.
   * @param deltaMs elapsed game time in milliseconds
   */
  tickAll(deltaMs: number): void {
    for (const def of this.config.actions) this.tick(def, deltaMs);
  }

  /** True when the action's `unlock` rule is met right now (a reached node count stays met). */
  private unlockRuleHolds(def: ActionDefinition): boolean {
    const rule = def.unlock;
    if (!rule) return true;
    if (rule.kind === 'buyable') return this.shop.owned(this.state, rule.buyableId) > 0;
    return this.state.unlockedActions[def.id] === true || this.state.network.gte(this.factory.fromNumber(rule.amount));
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

  private tick(def: ActionDefinition, deltaMs: number): void {
    const action = this.state.actions[def.id];
    if (!action || !this.isUnlocked(def.id)) return;
    const auto = this.stats.isAutoRun(def.id);
    if (auto && !action.running) {
      if (!this.payStartCost(def)) return;
      action.running = true;
    }
    if (!action.running) return;

    let remaining = deltaMs;
    for (let batches = 0; action.running && remaining > 0; batches++) {
      if (batches >= this.config.engine.maxBatchesPerTick) {
        this.diagnostics.warn(`${def.id}: dropped ${Math.round(remaining)} ms of game time after ${batches} run batches in one slice`);
        action.progress = 0;
        return;
      }
      const duration = this.stats.currentDurationMs(def.id);
      // Progress is the share of the run done, so a change of speed only changes how long the rest of the run takes.
      const needed = (1 - action.progress) * duration;
      if (remaining < needed - PROGRESS_EPSILON * duration) {
        action.progress += remaining / duration;
        return;
      }
      const runs = auto && !def.startCost ? this.runsInBatch(def, remaining - needed, duration) : 1;
      remaining = Math.max(0, remaining - (needed + (runs - 1) * duration));
      action.progress = 0;
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
    const byLevel = this.progression.runsBeforeLevelChange(this.state, def.id, this.stats.xpPerRun(def.id));
    return Math.max(1, Math.min(byTime, byLevel, Number.MAX_SAFE_INTEGER));
  }

  /**
   * Applies `runs` completed runs of an action at once. Every reward is paid in full: heat taxes only the credits that
   * network nodes produce, never what a run pays (see `Economy.passiveCreditsPerNode`).
   */
  private completeRuns(def: ActionDefinition, runs: number): void {
    const count = this.factory.fromNumber(runs);
    const multiplier = this.stats.rewardMultiplier(def.id);
    const gross = this.economy.grossReward(def, this.state.network, multiplier);
    const heatPerRun = def.heatPerRun ?? 0;
    payReward(this.state, def.rewardKind ?? 'credits', gross, count);
    this.state.heat += runs * heatPerRun;
    this.drops.roll(def.id, runs);
    this.latchUnlocks(); // before completion effects can shrink the network
    applyCompletionEffects(def.completionEffects, this.state, runs, this.factory);
    this.progression.recordRuns(this.state, def.id, this.stats.xpPerRun(def.id).mul(count), count);
  }
}
