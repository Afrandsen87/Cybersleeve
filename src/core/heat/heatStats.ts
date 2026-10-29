/**
 * @module core
 *
 * Whether heat can cool now and at which pace class: blocked by an Overclock, or idle (Quiet Hours). Read only.
 */
import type { ActionId, GameConfig, GameState } from '../types';

/** Where heat asks what an action's active Overclock does (satisfied by `ToggleStats`). */
export interface OverclockHeatRules {
  /** The action's Overclock while switched on, or `null`; heat reads only whether it stops cooling. */
  activeOverclock(id: ActionId): { readonly blocksHeatCooling: boolean } | null;
}

/**
 * Answers the questions about the heat cooldown. Holds no state; reads the `GameState` it was given every time.
 *
 * Called by: `DerivedStats` (the facade). Calls: {@link OverclockHeatRules}.
 */
export class HeatStats {
  /**
   * Creates the unit.
   *
   * @param config reads `actions`
   * @param state the live game state (read only)
   * @param overclocks the active Overclock of an action
   * @param idleActions the actions whose running still counts as idle (an owned `idleHeatCooldownAction` buyable names them)
   */
  constructor(
    private readonly config: Pick<GameConfig, 'actions'>,
    private readonly state: GameState,
    private readonly overclocks: OverclockHeatRules,
    private readonly idleActions: () => readonly ActionId[],
  ) {}

  /**
   * True while an action is running overclocked with an Overclock that stops heat from cooling. Then the cooldown stands still and Burn
   * leads cannot be used.
   */
  heatCoolingBlocked(): boolean {
    return this.config.actions.some(
      (a) => this.state.sleeve.actions[a.id]?.running === true && this.overclocks.activeOverclock(a.id)?.blocksHeatCooling === true,
    );
  }

  /**
   * True while no action is in progress, so heat cools at the idle pace (Quiet Hours). An action that is running without Overclock
   * still counts as idle when an `idleHeatCooldownAction` buyable names it (Undercover). A manual action that has finished its run and
   * waits is not running.
   */
  heatIsIdle(): boolean {
    const allowed = this.idleActions();
    return !this.config.actions.some(
      (a) =>
        this.state.sleeve.actions[a.id]?.running === true && !(allowed.includes(a.id) && this.overclocks.activeOverclock(a.id) === null),
    );
  }
}
