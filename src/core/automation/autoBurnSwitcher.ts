/**
 * @module core
 *
 * Auto Burn: switching the heat-making Overclocks and Auto-runs off (out of leads) and on (the resume checklists). The one owner of that switching.
 */
import type { ActionId, BuyableId, GameState } from '../types';
import type { AutoBurnRules } from './autoBurnRules';

/** What Auto Burn switches, injected so it never writes toggle state itself: the heat-making things and the owners that set them. */
export interface AutoBurnSwitches {
  /** Actions whose Overclock makes heat (`overclockMakesHeat`). */
  readonly overclockActions: readonly ActionId[];
  /** The Auto-run buyables of the actions that make heat (`actionMakesHeat`). */
  readonly autoRuns: readonly BuyableId[];
  /** Sets an action's Overclock explicitly (`ActionToggles.setOverclock`). */
  setOverclock(id: ActionId, on: boolean): boolean;
  /** Sets an Auto-run explicitly (`Shop.setOn`). */
  setAutoRun(id: BuyableId, on: boolean): boolean;
}

/**
 * Switches heat-making Overclocks and Auto-runs for Auto Burn.
 *
 * @remarks
 * Context: automation. Off: every running heat-making Overclock and/or Auto-run is switched off and recorded (`sleeve.autoBurn.overclocksOff` /
 * `autoRunsOff`, which the re-sleeve carry also reads). On: every TICKED (`wallet.automation.autoBurn.resumeOverclocks` / `resumeAutoRuns`)
 * owned item that is off is switched on, even one the player switched off by hand; its record is cleared.
 *
 * Called by: `AutoBurn`. Calls: {@link AutoBurnSwitches}.
 */
export class AutoBurnSwitcher {
  /**
   * Creates the unit.
   *
   * @param state the live game state (mutated: the records in `sleeve.autoBurn`; reads the ticked lists, `overclocked`, `autoRunOff`, `purchased`)
   * @param switches the heat-making things and the owners that set them
   */
  constructor(
    private readonly state: GameState,
    private readonly switches: AutoBurnSwitches,
  ) {}

  /**
   * Switches off what the rules say and records it. The caller checked the conditions (toggle on, no leads, heat above the lower threshold).
   *
   * Called by: `AutoBurn.step`.
   *
   * @param rules the rules in force (`offOverclocks`, `offActions`)
   */
  switchOff(rules: AutoBurnRules): void {
    const life = this.state.sleeve.autoBurn;
    if (rules.offOverclocks) {
      for (const id of this.switches.overclockActions) {
        if (this.state.sleeve.overclocked[id] !== true) continue;
        this.switches.setOverclock(id, false);
        if (this.state.sleeve.overclocked[id] !== true) life.overclocksOff[id] = true;
      }
    }
    if (rules.offActions) {
      for (const id of this.switches.autoRuns) {
        if (!this.autoRunIsOn(id)) continue;
        this.switches.setAutoRun(id, false);
        if (!this.autoRunIsOn(id)) life.autoRunsOff[id] = true;
      }
    }
  }

  /**
   * Switches on every ticked, owned Overclock / Auto-run that is off. The caller checked the conditions (heat below the lower threshold, leads available).
   *
   * Called by: `AutoBurn.step`.
   *
   * @param rules the rules in force (`onOverclocks`, `onActions`)
   * @returns true when at least one thing was switched on
   */
  switchOn(rules: AutoBurnRules): boolean {
    const { resumeOverclocks, resumeAutoRuns } = this.state.wallet.automation.autoBurn;
    const life = this.state.sleeve.autoBurn;
    let changed = false;
    if (rules.onOverclocks) {
      for (const id of this.switches.overclockActions) {
        if (resumeOverclocks[id] !== true || this.state.sleeve.overclocked[id] === true) continue;
        this.switches.setOverclock(id, true);
        if (this.state.sleeve.overclocked[id] === true) {
          delete life.overclocksOff[id];
          changed = true;
        }
      }
    }
    if (rules.onActions) {
      for (const id of this.switches.autoRuns) {
        if (resumeAutoRuns[id] !== true || !this.autoRunIsOff(id)) continue;
        this.switches.setAutoRun(id, true);
        if (this.autoRunIsOn(id)) {
          delete life.autoRunsOff[id];
          changed = true;
        }
      }
    }
    return changed;
  }

  /** The player switched an Overclock by hand: forget that the automation had switched it off. Called by: `AutoBurn.playerSwitchedOverclock`. */
  forgetOverclock(id: ActionId): void {
    delete this.state.sleeve.autoBurn.overclocksOff[id];
  }

  /** The player switched an Auto-run by hand: forget that the automation had switched it off. Called by: `AutoBurn.playerSwitchedAutoRun`. */
  forgetAutoRun(id: BuyableId): void {
    delete this.state.sleeve.autoBurn.autoRunsOff[id];
  }

  /** True when the Auto-run is owned and not switched off. */
  private autoRunIsOn(id: BuyableId): boolean {
    return (this.state.sleeve.purchased[id] ?? 0) > 0 && this.state.sleeve.autoRunOff[id] !== true;
  }

  /** True when the Auto-run is owned and switched off. */
  private autoRunIsOff(id: BuyableId): boolean {
    return (this.state.sleeve.purchased[id] ?? 0) > 0 && this.state.sleeve.autoRunOff[id] === true;
  }
}
