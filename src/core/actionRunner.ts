/**
 * @module core
 *
 * Running actions: access gating, start costs, run progress and the closed-form completion of runs.
 */
import type { BigNum, NumberFactory } from '../numbers';
import type { ActionLookup } from './actionLookup';
import { applyCompletionEffects } from './completion';
import type { CriticalSuccesses } from './critical';
import type { CritFeed } from './critFeed';
import { type Diagnostics, silentDiagnostics } from './diagnostics';
import type { ItemDrops } from './drops';
import type { Economy } from './economy';
import type { Progression } from './progression';
import { payReward } from './rewards';
import type { DerivedStats } from './stats';
import type { CriticalLinks } from './criticalLinks';
import type { ZeroDays } from './zeroDays';
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
 * Calls: {@link DerivedStats}, {@link Progression}, {@link Economy},
 * `payReward`, `applyCompletionEffects`, {@link ItemDrops}, {@link CriticalSuccesses}, {@link ZeroDays}, {@link CriticalLinks}.
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
   * @param factory number factory
   * @param definition action lookup
   * @param drops rolls the items completed runs drop
   * @param criticals draws which completed runs are critical successes
   * @param zeroDays uses up the Zero-days that make runs critical for sure
   * @param adminKeys uses up the Admin keys that make runs critical for sure (and may drop Skill shards)
   * @param links spends and banks the guaranteed critical successes of critical links
   * @param feed told about the critical successes of every batch (for the highlight on the action card)
   * @param diagnostics receives a warning when game time has to be dropped (default: ignored)
   */
  constructor(
    private readonly config: GameConfig,
    private readonly state: GameState,
    private readonly stats: DerivedStats,
    private readonly progression: Progression,
    private readonly economy: Economy,
    private readonly factory: NumberFactory,
    private readonly definition: ActionLookup,
    private readonly drops: ItemDrops,
    private readonly criticals: CriticalSuccesses,
    private readonly zeroDays: ZeroDays,
    private readonly adminKeys: ZeroDays,
    private readonly links: CriticalLinks,
    private readonly feed: CritFeed,
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
   * True when the action can be performed: the sleeve's access level is high enough (`requiredAccessLevel`, default 1).
   * Locked actions cannot start and do not progress.
   * @throws Error if the action id is unknown
   */
  isUnlocked(id: ActionId): boolean {
    return this.stats.sleeveStats().accessLevel >= (this.definition(id).requiredAccessLevel ?? 1);
  }

  /**
   * True when starting the action now would work: it is unlocked and its start cost (if any) can be paid. A running action counts
   * as startable (starting it again does nothing).
   * @throws Error if the action id is unknown
   */
  canStart(id: ActionId): boolean {
    if (!this.isUnlocked(id)) return false;
    if (this.state.actions[id]?.running) return true;
    return this.canPayStartCost(this.definition(id));
  }

  /**
   * What starting the action would cost right now: the fixed amount plus the share of the balance held (network nodes are
   * rounded down to whole nodes). The share is scaled by `DerivedStats.startCostScale`: lowered by Decommission protocol, raised by the
   * links of an Overclock chain, never above the whole balance. With a reduction owned, a node cost that rounds down to 0 is 1 node.
   * @returns the cost, or `null` when starting is free
   * @throws Error if the action id is unknown
   */
  startCostOf(id: ActionId): BigNum | null {
    const cost = this.definition(id).startCost;
    if (!cost) return null;
    const balance = cost.currency === 'networkNodes' ? this.state.network : this.state.credits;
    let total = cost.amount ?? this.factory.fromNumber(0);
    if (cost.fractionOfBalance !== undefined) {
      const scale = this.stats.startCostScale(id);
      const share = balance.mul(this.factory.fromNumber(Math.min(1, cost.fractionOfBalance * scale.factor)));
      let part = cost.currency === 'networkNodes' ? share.floor() : share;
      // A reduction never lets the price vanish: one node is the least a network can be made to give up.
      if (scale.atLeastOne && cost.currency === 'networkNodes' && part.isZero() && balance.gte(this.factory.fromNumber(1))) {
        part = this.factory.fromNumber(1);
      }
      total = total.add(part);
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

  /**
   * Pays an action's start cost, if it has one. A share-of-balance cost that comes to 0 cannot be paid (the run would be free).
   * @returns false (and pays nothing) when the player cannot afford it
   */
  private payStartCost(def: ActionDefinition): boolean {
    const cost = def.startCost;
    const price = this.startCostOf(def.id);
    if (!cost || !price) return true;
    if (!this.canPayStartCost(def)) return false;
    if (cost.currency === 'networkNodes') {
      this.state.network = this.state.network.sub(price);
      this.paySiphon(def.id, price);
    } else this.state.credits = this.state.credits.sub(price);
    return true;
  }

  /**
   * Pays the Credit Siphon of an action for the nodes its start cost just destroyed: `siphonSeconds` seconds of what one node
   * produces now (after the node payout multiplier and the heat tax) for each node. Nothing without a Credit Siphon.
   */
  private paySiphon(id: ActionId, destroyed: BigNum): void {
    const seconds = this.stats.siphonSeconds(id);
    if (!(seconds > 0)) return;
    const perNode = this.stats.taxedCreditsPerNode();
    this.state.credits = this.state.credits.add(destroyed.mul(perNode).mul(this.factory.fromNumber(seconds)));
  }

  /** True when the start cost (if any) can be paid now; a share-of-balance cost that comes to 0 cannot (the run would be free). */
  private canPayStartCost(def: ActionDefinition): boolean {
    const cost = def.startCost;
    const price = this.startCostOf(def.id);
    if (!cost || !price) return true;
    const balance = cost.currency === 'networkNodes' ? this.state.network : this.state.credits;
    return !(balance.lt(price) || (cost.fractionOfBalance !== undefined && price.isZero()));
  }

  /**
   * Advances one action by `deltaMs`, then charges the heat that accrues over time for the time the action actually ran.
   *
   * @remarks
   * The action's own `heatPerSecond` is charged for every second it runs. Overclock adds `heatPerMinute` of heat for every minute the action is running overclocked. Heat is a fraction of a point here,
   * and it only starts to cool when it reaches a whole point (see `coolHeat`). Time that a manual action spent idle after its run
   * completed, or while it could not pay its start cost, is not charged.
   */
  private tick(def: ActionDefinition, deltaMs: number): void {
    const ranMs = this.advance(def, deltaMs);
    if (!(ranMs > 0)) return;
    this.state.heat += ((def.heatPerSecond ?? 0) * ranMs) / 1000;
    if (this.state.overclocked[def.id] !== true) return;
    const overclock = this.stats.overclockStatus(def.id);
    if (overclock?.on) this.state.heat += (overclock.heatPerMinute * ranMs) / 60_000;
  }

  /**
   * Starts an auto-run when due and completes the runs that fit in `deltaMs`.
   * @returns how much of `deltaMs` the action was running (the rest was idle or discarded after a manual run completed)
   */
  private advance(def: ActionDefinition, deltaMs: number): number {
    const action = this.state.actions[def.id];
    if (!action || !this.isUnlocked(def.id)) return 0;
    const auto = this.stats.isAutoRun(def.id);
    if (auto && !action.running) {
      if (!this.payStartCost(def)) return 0;
      action.running = true;
    }
    if (!action.running) return 0;

    let remaining = deltaMs;
    for (let batches = 0; action.running && remaining > 0; batches++) {
      if (batches >= this.config.engine.maxBatchesPerTick) {
        this.diagnostics.warn(`${def.id}: dropped ${Math.round(remaining)} ms of game time after ${batches} run batches in one slice`);
        action.progress = 0;
        return deltaMs;
      }
      const duration = this.stats.currentDurationMs(def.id);
      // Progress is the share of the run done, so a change of speed only changes how long the rest of the run takes.
      const needed = (1 - action.progress) * duration;
      if (remaining < needed - PROGRESS_EPSILON * duration) {
        action.progress += remaining / duration;
        return deltaMs;
      }
      const runs = auto && !def.startCost ? this.runsInBatch(def, remaining - needed, duration) : 1;
      remaining = Math.max(0, remaining - (needed + (runs - 1) * duration));
      action.progress = 0;
      this.completeRuns(def, runs);
      if (!auto || (def.startCost && !this.payStartCost(def))) {
        action.running = false;
        delete this.state.chains[def.id]; // a stopped action breaks its Overclock chain
      }
    }
    return deltaMs - remaining;
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
    const byLevel = this.progression.runsBeforeLevelChange(this.state, def.id, this.stats.maxXpPerRun(def.id));
    return Math.max(1, Math.min(byTime, byLevel, Number.MAX_SAFE_INTEGER));
  }

  /**
   * Adds the completed runs to the Overclock chain of the action, up to the rule's most links; breaks the chain when the action is
   * not overclocked or its Overclock has no chain. Called after the runs were paid, so they were paid at the links held before them.
   */
  private extendChain(id: ActionId, runs: number): void {
    const chain = this.stats.activeOverclock(id)?.chain;
    if (!chain) delete this.state.chains[id];
    else this.state.chains[id] = Math.min(chain.maxLinks, (this.state.chains[id] ?? 0) + runs);
  }

  /**
   * Pays the reward of another action for `runs` runs, as if that action had completed them (Overclock's `alsoPays`): its reward,
   * its own reward multipliers and its reward kind. Its XP, heat, drops and critical successes are not part of it.
   */
  private payAlso(otherId: ActionId, runs: BigNum): void {
    const other = this.definition(otherId);
    const gross = this.economy.grossReward(other, this.state.network, this.stats.rewardMultiplier(otherId));
    payReward(this.state, other.rewardKind ?? 'credits', gross, runs);
  }

  /**
   * Applies `runs` completed runs of an action at once. Every reward is paid in full: heat taxes only the credits that
   * network nodes produce, never what a run pays (see `Economy.passiveCreditsPerNode`).
   *
   * @remarks
   * The critical successes of the batch are settled once (see `CriticalSuccesses.settle`): a run can have several, the chance may exceed 100%, and a banked
   * success, Zero-day or Admin key adds +100% to one run each. Each critical success then banks what the action's critical links give. Runs without one pay and
   * teach as usual; every critical success pays `rewardMultiplier` times the reward and gives `xpMultiplier` times the action XP, and applies the rule's own
   * completion effects once. Heat, drops and the runs counted towards sleeve XP do not depend on it.
   */
  private completeRuns(def: ActionDefinition, runs: number): void {
    const count = this.factory.fromNumber(runs);
    // A banked success, a Zero-day or an Admin key adds +100% critical chance to one run each (distinct runs); the chance itself may exceed 100%.
    const banked = this.links.claim(def.id, runs);
    const zeroDayRuns = this.zeroDays.claim(def.id, runs - banked);
    const covered = banked + zeroDayRuns + this.adminKeys.claim(def.id, runs - banked - zeroDayRuns);
    const { crits: critical, plainRuns } = this.criticals.settle(runs, covered);
    this.links.bank(def.id, critical);
    this.feed.record(def.id, critical);
    const rule = this.stats.criticalRule(def.id);
    const multiplier = this.stats.rewardMultiplier(def.id);
    const gross = this.economy.grossReward(def, this.state.network, multiplier);
    const kind = def.rewardKind ?? 'credits';
    payReward(this.state, kind, gross, this.factory.fromNumber(plainRuns));
    if (critical > 0)
      payReward(this.state, kind, gross.mul(this.factory.fromNumber(rule.rewardMultiplier)), this.factory.fromNumber(critical));
    const overclock = this.stats.activeOverclock(def.id);
    if (overclock?.alsoPays) this.payAlso(overclock.alsoPays, count);
    this.state.heat += runs * (def.heatPerRun ?? 0) * (overclock?.heatPerRunFactor ?? 1);
    this.drops.roll(def.id, runs);
    this.extendChain(def.id, runs);
    applyCompletionEffects(def.completionEffects, this.state, runs, this.factory);
    if (critical > 0) applyCompletionEffects(rule.completionEffects, this.state, critical, this.factory);
    if (overclock) applyCompletionEffects(overclock.completionEffects, this.state, runs, this.factory);
    const xpRuns = this.factory.fromNumber(plainRuns + critical * rule.xpMultiplier);
    this.progression.recordRuns(this.state, def.id, this.stats.xpPerRun(def.id).mul(xpRuns), count);
  }
}
