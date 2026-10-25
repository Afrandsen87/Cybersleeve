/**
 * @module core
 *
 * The per-action switches that Overclock and Focus give: what they are right now, and switching them.
 */
import type { ActionId, CompletionEffect, GameState } from './types';

/** The chain of an action's Overclock (see `ChainRule`) as it stands now. */
export interface ChainStatus {
  /** Links held now (0 while the chain is broken or Overclock is off). */
  readonly links: number;
  /** The most links the chain can hold. */
  readonly maxLinks: number;
  /** What each link adds to the reward bonus of a run: the rule's value times the strength of Overclock. */
  readonly rewardPerLink: number;
  /** What each link adds to the share of the balance the start cost takes (fixed: the strength does not scale it). */
  readonly nodesPerLink: number;
}

/** What Overclock is for one action. */
export interface OverclockStatus {
  /** While the action runs overclocked, heat does not cool down at all. */
  readonly blocksHeatCooling: boolean;
  /** The chain of consecutive runs, or `null` when the rule has none. */
  readonly chain: ChainStatus | null;
  /** The toggle is switched on. */
  readonly on: boolean;
  /** The speed bonus the action gets while it is on: the rule's bonus times the strength (0.5 = 50 percent faster; 0 when the rule has none). */
  readonly speedBonus: number;
  /** The bonus on the reward the action pays per run while it is on: the rule's bonus times the strength (2 = 200 percent more; 0 when the rule has none). */
  readonly rewardBonus: number;
  /** Heat the action adds per minute of game time while it is running overclocked (0 when the rule has none). */
  readonly heatPerMinute: number;
  /** What the heat of each completed run is multiplied by while it is on (1 when the rule has no such cost). */
  readonly heatPerRunFactor: number;
  /** Effects applied for each completed run while it is on, after the ordinary completion effects. */
  readonly completionEffects: readonly CompletionEffect[];
  /** The other action whose reward each completed run also pays while it is on, or `null`. */
  readonly alsoPays: ActionId | null;
  /** How strong Overclock is: 1 with the first copy, plus the buyable's `strengthPerCopy` for each further copy. */
  readonly strength: number;
}

/** What Focus is for one action. */
export interface FocusStatus {
  /** The action is focused. */
  readonly on: boolean;
  /** The speed bonus a focused action gets (0.25 = 25 percent faster). */
  readonly speedBonus: number;
  /** How many actions can be focused at once. */
  readonly slots: number;
  /** How many actions are focused now. */
  readonly used: number;
  /** The toggle can be switched on (a slot is free) or off (it is on). False for an action that is off while every slot is taken. */
  readonly canSwitchOn: boolean;
}

/** Where the statuses come from (satisfied by `DerivedStats`). */
export interface ModeStatuses {
  /** Overclock for an action; `null` while Overclock is not owned or the action has no rule for it (no toggle is shown). */
  overclockStatus(id: ActionId): OverclockStatus | null;
  /** Focus for an action; `null` while no Focus slot is owned (no toggle is shown). */
  focusStatus(id: ActionId): FocusStatus | null;
}

/**
 * Switches the Overclock and Focus toggles of actions.
 *
 * @remarks
 * Overclock can be switched on for any action that has an Overclock rule once the buyable is owned. Focus can be switched on for as
 * many actions as there are Focus slots; switching it off always works. Both reset with a re-sleeve (they live in the game state).
 * What the switches DO (speed, heat) is worked out elsewhere: `DerivedStats` for the speed, `ActionRunner` for the heat.
 *
 * Called by: `engine.ts` (`GameEngine.toggleOverclock`, `GameEngine.toggleFocus`). Calls: {@link ModeStatuses}.
 */
export class ActionToggles {
  /**
   * Creates the unit.
   *
   * @param state the live game state (mutated: `overclocked`, `focused`)
   * @param modes where the current statuses come from
   */
  constructor(
    private readonly state: GameState,
    private readonly modes: ModeStatuses,
  ) {}

  /**
   * Switches Overclock on or off for an action.
   *
   * @param id the action
   * @returns true when it is now on; false when it is now off, or when nothing could change (not owned, no rule, unknown action)
   */
  toggleOverclock(id: ActionId): boolean {
    const status = this.modes.overclockStatus(id);
    if (!status || !this.state.actions[id]) return false;
    if (status.on) delete this.state.overclocked[id];
    else this.state.overclocked[id] = true;
    return !status.on;
  }

  /**
   * Switches Focus on or off for an action. Switching on needs a free slot.
   *
   * @param id the action
   * @returns true when it is now on; false when it is now off, or when nothing could change (no slot owned or free, unknown action)
   */
  toggleFocus(id: ActionId): boolean {
    const status = this.modes.focusStatus(id);
    if (!status?.canSwitchOn || !this.state.actions[id]) return false;
    if (status.on) delete this.state.focused[id];
    else this.state.focused[id] = true;
    return !status.on;
  }
}
