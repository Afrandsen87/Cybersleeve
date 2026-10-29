/**
 * @module core
 *
 * The Corporation: starting its actions and advancing their runs.
 */
import { ownsKind } from '../effects/ownedOfKind';
import { synthBoost } from '../kernel/curves';
import { effectiveDurationMs, levelFactor } from '../actions/speed';
import { applyCorporationEffect, type CorporationEffectContext } from './corporationEffects';
import type { CorporationLevels } from './corporationLevels';
import type { CorporationActionDefinition, CorporationActionId, GameConfig, StateSlice } from '../types';

/**
 * Rounding slack, as a share of one run: progress is a fraction, and `(1 - 0.9999) * 30000` is not exactly `3`. A run counts as
 * complete when the time left is within this share of the time it needs.
 */
const PROGRESS_EPSILON = 1e-9;

/**
 * The corporation's actions.
 *
 * @remarks
 * Unlike a character action, a corporation run takes its `baseDurationMs` sped up by its action level only (`durationMs`): there is
 * no interface speed, no sleeve level, no Focus and no Overclock here, because the corporation scales differently from the character.
 * The effects that owned `addsCorporationEffect` buyables add to an action are applied after the action's own. A run is started by the player and
 * stops when it completes (there is no auto-run yet). Time left over after a run is discarded, as for a manual character action.
 * The corporation can be used only while a purchase with the `unlocksCorporation` effect is owned, and an action needs its `requiredRank`.
 *
 * Called by: `engine.ts`. Calls: `applyCorporationEffect`, `CorporationLevels.award`.
 */
export class Corporation {
  private readonly definitions = new Map<CorporationActionId, CorporationActionDefinition>();

  /**
   * Creates the unit.
   *
   * @param config reads `corporation` (the actions) and `buyables` (which purchase opens the corporation)
   * @param state the live game state (mutated: `corporation`)
   * @param effects what the effects of the actions may use (inventory, randomness)
   * @param levels gets the XP of each completed run (also read by the engine for the levels shown)
   */
  constructor(
    private readonly config: Pick<GameConfig, 'corporation' | 'buyables' | 'speed' | 'engine'>,
    private readonly state: StateSlice<'corporation' | 'purchased' | 'synths'>,
    private readonly effects: CorporationEffectContext,
    readonly levels: CorporationLevels,
  ) {
    for (const a of config.corporation?.actions ?? []) this.definitions.set(a.id, a);
  }

  /** True while the player owns a purchase with the `unlocksCorporation` effect. */
  isUnlocked(): boolean {
    return ownsKind(this.config.buyables, this.state.sleeve.purchased, 'unlocksCorporation');
  }

  /** The corporate rank: `corporation.baseRank` (default 1) plus what the owned `corporateRank` purchases add. */
  rank(): number {
    let rank = this.config.corporation?.baseRank ?? 1;
    for (const b of this.config.buyables) {
      if (b.effect.kind === 'corporateRank') rank += b.effect.amount * (this.state.sleeve.purchased[b.id] ?? 0);
    }
    return rank;
  }

  /**
   * How long one run of an action takes now: its `baseDurationMs` divided by the speed of its action level (`speed.actionLevel`, the
   * same rule as the character's actions), and by the Synthetic Workers skill with the number of synthetic sleeves. Nothing else speeds it
   * up: no interface speed, sleeve level, Focus or Overclock.
   *
   * @param id the action
   * @returns milliseconds (never below `engine.minRunDurationMs`); 0 for an unknown action
   */
  durationMs(id: CorporationActionId): number {
    const def = this.definitions.get(id);
    if (!def) return 0;
    const speed = levelFactor(this.config.speed.actionLevel, this.levels.level(id)) * this.workersFactor();
    return effectiveDurationMs(def.baseDurationMs, speed, this.config.engine.minRunDurationMs);
  }

  /** The speed factor the owned `corporationSpeedPerLnSynths` skills give: `1 + perLn x ln(1 + synthetic sleeves)` for each copy (1 without). */
  workersFactor(): number {
    let factor = 1;
    for (const b of this.config.buyables) {
      const copies = this.state.sleeve.purchased[b.id] ?? 0;
      if (b.effect.kind === 'corporationSpeedPerLnSynths' && copies > 0) {
        factor *= synthBoost(b.effect.perLn, this.state.wallet.synths.length, copies);
      }
    }
    return factor;
  }

  /** True while the player owns a purchase with the `unlocksSynthPurchase` effect (the option to buy synthetic sleeves is open). */
  synthPurchaseUnlocked(): boolean {
    return ownsKind(this.config.buyables, this.state.sleeve.purchased, 'unlocksSynthPurchase');
  }

  /** The corporation's actions, in the order the tab lists them. */
  actions(): readonly CorporationActionDefinition[] {
    return this.config.corporation?.actions ?? [];
  }

  /**
   * True when starting the action now would work: the corporation is open, the action exists and the rank is high enough. A running action counts (starting it
   * again does nothing).
   *
   * @param id the action
   */
  canStart(id: CorporationActionId): boolean {
    const def = this.definitions.get(id);
    return def !== undefined && this.isUnlocked() && this.rank() >= (def.requiredRank ?? 1);
  }

  /**
   * Starts an action. Does nothing when {@link canStart} says no, or it is already running.
   *
   * @param id the action
   * @returns true when the action is now running
   */
  start(id: CorporationActionId): boolean {
    const action = this.state.wallet.corporation.actions[id];
    if (!action || !this.canStart(id)) return false;
    action.running = true;
    return true;
  }

  /**
   * Advances every running action by `deltaMs` of game time.
   *
   * @param deltaMs elapsed game time in milliseconds
   */
  tickAll(deltaMs: number): void {
    for (const def of this.definitions.values()) this.tick(def, deltaMs);
  }

  /** Advances one action; when its run completes the effects are applied once and the action stops. */
  private tick(def: CorporationActionDefinition, deltaMs: number): void {
    const action = this.state.wallet.corporation.actions[def.id];
    if (!action?.running) return;
    const duration = this.durationMs(def.id);
    const needed = (1 - action.progress) * duration;
    if (deltaMs < needed - PROGRESS_EPSILON * duration) {
      action.progress += deltaMs / duration;
      return;
    }
    action.progress = 0;
    action.running = false;
    this.levels.award(def.id, 1);
    for (const effect of def.effects) applyCorporationEffect(effect, 1, this.effects);
    for (const b of this.config.buyables) {
      if (b.corporationActionId === def.id && b.effect.kind === 'addsCorporationEffect' && (this.state.sleeve.purchased[b.id] ?? 0) > 0) {
        applyCorporationEffect(b.effect.effect, 1, this.effects);
      }
    }
  }
}
