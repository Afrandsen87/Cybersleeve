/**
 * @module core
 *
 * Running actions: unlock rules, start costs, run progress and the closed-form completion of runs.
 */
import type { BigNum, NumberFactory } from '../numbers';
import type { ActionLookup } from './actionLookup';
import { applyCompletionEffects } from './completion';
import type { Economy } from './economy';
import type { Progression } from './progression';
import { payReward } from './rewards';
import type { Shop } from './shop';
import type { DerivedStats } from './stats';
import type { ActionDefinition, ActionId, GameConfig, GameState } from './types';

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
 * `payReward`, `applyCompletionEffects`.
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
        action.progressMs = 0;
        return;
      }
      const duration = this.stats.currentDurationMs(def.id);
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
    const byLevel = this.progression.runsBeforeLevelChange(
      this.state,
      def.id,
      this.stats.xpPerRun(def.id),
      this.stats.outputMultiplier(def.id),
    );
    return Math.max(1, Math.min(byTime, byLevel, Number.MAX_SAFE_INTEGER));
  }

  /**
   * Applies `runs` completed runs of an action at once. Rewards are computed before heat and XP change; runs of an
   * action that adds heat pay a falling amount because each run raises the tax on the next ({@link Economy.creditsForRuns}).
   */
  private completeRuns(def: ActionDefinition, runs: number): void {
    const count = this.factory.fromNumber(runs);
    const multiplier = this.stats.outputMultiplier(def.id);
    const gross = this.economy.grossReward(def, this.state.network, multiplier);
    const heatPerRun = def.heatPerRun ?? 0;
    if (def.rewardKind === undefined || def.rewardKind === 'credits') {
      this.state.credits = this.state.credits.add(
        this.economy.creditsForRuns(gross, runs, this.state.heat, heatPerRun, this.stats.sleeveStats().heatReduction),
      );
    } else {
      payReward(this.state, def.rewardKind, gross, count);
    }
    this.state.heat += runs * heatPerRun;
    this.latchUnlocks(); // before completion effects can shrink the network
    applyCompletionEffects(def.completionEffects, this.state, runs, this.factory);
    this.progression.recordRuns(this.state, def.id, this.economy.xpPerRun(def, multiplier).mul(count), multiplier.mul(count));
  }
}
