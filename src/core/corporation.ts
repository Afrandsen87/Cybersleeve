/**
 * @module core
 *
 * The Corporation: starting its actions and advancing their runs.
 */
import { applyCorporationEffect, type CorporationEffectContext } from './corporationEffects';
import type { CorporationActionDefinition, CorporationActionId, GameConfig, GameState } from './types';

/**
 * Rounding slack, as a share of one run: progress is a fraction, and `(1 - 0.9999) * 30000` is not exactly `3`. A run counts as
 * complete when the time left is within this share of the time it needs.
 */
const PROGRESS_EPSILON = 1e-9;

/**
 * The corporation's actions.
 *
 * @remarks
 * Unlike a character action, a corporation run always takes its `baseDurationMs`: there is no interface speed, no level speed, no
 * Focus and no Overclock here, because the corporation scales differently from the character. A run is started by the player and
 * stops when it completes (there is no auto-run yet). Time left over after a run is discarded, as for a manual character action.
 * The corporation can be used only while a purchase with the `unlocksCorporation` effect is owned, and an action needs its `requiredRank`.
 *
 * Called by: `engine.ts`. Calls: `applyCorporationEffect`.
 */
export class Corporation {
  private readonly definitions = new Map<CorporationActionId, CorporationActionDefinition>();

  /**
   * Creates the unit.
   *
   * @param config reads `corporation` (the actions) and `buyables` (which purchase opens the corporation)
   * @param state the live game state (mutated: `corporation`)
   * @param effects what the effects of the actions may use (inventory, randomness)
   */
  constructor(
    private readonly config: Pick<GameConfig, 'corporation' | 'buyables'>,
    private readonly state: Pick<GameState, 'corporation' | 'purchased'>,
    private readonly effects: CorporationEffectContext,
  ) {
    for (const a of config.corporation?.actions ?? []) this.definitions.set(a.id, a);
  }

  /** True while the player owns a purchase with the `unlocksCorporation` effect. */
  isUnlocked(): boolean {
    return this.config.buyables.some((b) => b.effect.kind === 'unlocksCorporation' && (this.state.purchased[b.id] ?? 0) > 0);
  }

  /** The corporate rank: `corporation.baseRank` (default 1) plus what the owned `corporateRank` purchases add. */
  rank(): number {
    let rank = this.config.corporation?.baseRank ?? 1;
    for (const b of this.config.buyables) {
      if (b.effect.kind === 'corporateRank') rank += b.effect.amount * (this.state.purchased[b.id] ?? 0);
    }
    return rank;
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
    const action = this.state.corporation.actions[id];
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
    const action = this.state.corporation.actions[def.id];
    if (!action?.running) return;
    const needed = (1 - action.progress) * def.baseDurationMs;
    if (deltaMs < needed - PROGRESS_EPSILON * def.baseDurationMs) {
      action.progress += deltaMs / def.baseDurationMs;
      return;
    }
    action.progress = 0;
    action.running = false;
    for (const effect of def.effects) applyCorporationEffect(effect, 1, this.effects);
  }
}
