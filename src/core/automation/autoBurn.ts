/**
 * @module core
 *
 * Auto Burn: the Burn lead Inventory toggle, and the rules that grow with the ten skills of its lane.
 */
import { heatHoldTarget, heatNeedsCooling } from '../heat/heat';
import type { Inventory } from '../items/inventory';
import type { BurnLeads } from '../items/burnLeads';
import type { ActionId, BuyableId, GameConfig, GameState } from '../types';
import { isFeatureUnlocked } from './automation';
import { type AutoBurnRules, autoBurnRules, ownsAutoBurnStep } from './autoBurnRules';
import { AutoBurnSwitcher, type AutoBurnSwitches } from './autoBurnSwitcher';
import type { AutoBurnStep, AutoBurnSwitch } from './autoBurnTypes';

export type { AutoBurnSwitches } from './autoBurnSwitcher';

/** What the screen and the commands use of Auto Burn (satisfied by {@link AutoBurn}). */
export interface AutoBurnControls {
  /** The rules in force now (what is owned and on, the thresholds and the reserve). */
  rules(): AutoBurnRules;
  /** True when the Burn lead Inventory toggle is on. */
  isOn(): boolean;
  /** Switches the Burn lead toggle; only works once the lane's first skill is owned. @returns true when it is now on */
  toggle(): boolean;
  /** True when the skill that grants the step is owned. */
  stepOwned(step: AutoBurnStep): boolean;
  /** Burn leads held (all of them, the reserve included). */
  held(): number;
  /** Sets a switch; only works once its skill is owned. @returns the switch's state now */
  setSwitch(name: AutoBurnSwitch, on: boolean): boolean;
  /** Ticks or unticks an Overclock for the resume switch; only works once `onOverclocks` is owned and for an Overclock that makes heat. @returns true when it is ticked now */
  setResumeOverclock(id: ActionId, on: boolean): boolean;
  /** Ticks or unticks an Auto-run for the resume switch; only works once `onActions` is owned and for an Auto-run of an action that makes heat. @returns true when it is ticked now */
  setResumeAutoRun(id: BuyableId, on: boolean): boolean;
  /** Sets both thresholds (finite, 0 <= lower < upper); only works once `thresholds` is owned. @returns true when they were set */
  setThresholds(lower: number, upper: number): boolean;
  /** Sets the number of leads always kept (a whole number >= 0, fractions are cut off); only works once `reserve` is owned. @returns true when it was set */
  setReserve(count: number): boolean;
}

/** Floating-point slack when counting whole seconds out of many slices. */
const SECOND_EPSILON = 1e-9;

/**
 * Auto Burn: uses Burn leads for the player while the Inventory toggle is on, and switches heat-making Overclocks and Auto-runs off and on.
 *
 * @remarks
 * Context: automation. Per slice (closed form, so one long slice equals many short ones) and in this order:
 * 1. With the "upper" switch and heat REACHING the upper threshold (rising to it from below: `sleeve.autoBurn.upperArmed`, re-armed when heat
 *    falls below it), the toggle is switched on once. Heat is looked at per slice like everything here, so a long slice sees only where heat
 *    ends up, and a rise and fall inside one slice is missed; a player who switches the toggle off while heat stays up is left alone.
 * 2. With the toggle on and heat that still needs cooling (at least 1 point, `heatNeedsCooling`: the cooldown removes whole points only, so
 *    a fraction below 1 counts as cooled): one lead a second (a fractional-second accumulator in the sleeve state), or with "hold" just
 *    enough leads to bring heat down to the lower threshold, or below 1 when that is lower (`BurnLeads.leadsNeeded`, `heatHoldTarget`).
 *    Never below the reserve.
 * 3. With the toggle on, out of leads (held minus reserve is 0, or leads cannot be used now: an Overclock that stops heat cooling is running) with heat above
 *    the lower threshold: the off rules switch heat-making Overclocks and/or the Auto-run of heat-making actions off, and record what they switched.
 * 4. Heat below the lower threshold with leads available: the on rules switch on every ticked (resume checklist) owned Overclock and Auto-run
 *    that is off, even one the player switched off by hand, and when one changed, the toggle on. Every switch is independent of the others.
 * Switching goes through {@link AutoBurnSwitcher} and the toggle owners (`AutoBurnSwitches`); a player's own press on an item forgets its record (`playerSwitched*`).
 *
 * Called by: `Automation.step`, `engine.ts` (the screen uses {@link AutoBurnControls}).
 * Calls: {@link BurnLeads}, {@link Inventory}, {@link AutoBurnSwitches}, {@link autoBurnRules}.
 */
export class AutoBurn implements AutoBurnControls {
  /** Switches the heat-making Overclocks and Auto-runs off and on. */
  private readonly switcher: AutoBurnSwitcher;

  /**
   * Creates the unit.
   *
   * @param config reads the buyables (the lane's skills), `automation` (threshold starts) and `items.burnLead`
   * @param state the live game state (mutated: `wallet.automation.autoBurn`, `sleeve.autoBurn`, and through the others heat and the inventory)
   * @param inventory where the held leads are counted
   * @param burnLeads uses the leads
   * @param switches the heat-making Overclocks and Auto-runs and the owners that set them
   */
  constructor(
    private readonly config: Pick<GameConfig, 'buyables' | 'automation' | 'items'>,
    private readonly state: GameState,
    private readonly inventory: Inventory,
    private readonly burnLeads: BurnLeads,
    private readonly switches: AutoBurnSwitches,
  ) {
    this.switcher = new AutoBurnSwitcher(state, switches);
  }

  /** See {@link AutoBurnControls.rules}. */
  rules(): AutoBurnRules {
    const unlocked = isFeatureUnlocked(this.config.buyables, this.state.sleeve.purchased, 'autoBurn');
    return autoBurnRules(this.config, this.state.sleeve.purchased, this.state.wallet.automation.autoBurn, unlocked);
  }

  /** See {@link AutoBurnControls.isOn}. */
  isOn(): boolean {
    return this.state.sleeve.autoBurn.on;
  }

  /** See {@link AutoBurnControls.toggle}. Mutates `sleeve.autoBurn.on`. */
  toggle(): boolean {
    if (this.rules().toggle) this.state.sleeve.autoBurn.on = !this.state.sleeve.autoBurn.on;
    return this.state.sleeve.autoBurn.on;
  }

  /** See {@link AutoBurnControls.stepOwned}. */
  stepOwned(step: AutoBurnStep): boolean {
    return this.rules().toggle && ownsAutoBurnStep(this.config.buyables, this.state.sleeve.purchased, step);
  }

  /** See {@link AutoBurnControls.held}. */
  held(): number {
    const lead = this.config.items.burnLead;
    return lead ? this.inventory.heldFirst(lead.itemId) : 0;
  }

  /** See {@link AutoBurnControls.setSwitch}. Mutates `wallet.automation.autoBurn.switches`. */
  setSwitch(name: AutoBurnSwitch, on: boolean): boolean {
    const sw = this.state.wallet.automation.autoBurn.switches;
    if (!this.stepOwned(name)) return sw[name];
    sw[name] = on;
    return on;
  }

  /** See {@link AutoBurnControls.setResumeOverclock}. Mutates `wallet.automation.autoBurn.resumeOverclocks`. */
  setResumeOverclock(id: ActionId, on: boolean): boolean {
    const ticked = this.state.wallet.automation.autoBurn.resumeOverclocks;
    if (!this.stepOwned('onOverclocks') || !this.switches.overclockActions.includes(id)) return ticked[id] === true;
    if (on) ticked[id] = true;
    else delete ticked[id];
    return on;
  }

  /** See {@link AutoBurnControls.setResumeAutoRun}. Mutates `wallet.automation.autoBurn.resumeAutoRuns`. */
  setResumeAutoRun(id: BuyableId, on: boolean): boolean {
    const ticked = this.state.wallet.automation.autoBurn.resumeAutoRuns;
    if (!this.stepOwned('onActions') || !this.switches.autoRuns.includes(id)) return ticked[id] === true;
    if (on) ticked[id] = true;
    else delete ticked[id];
    return on;
  }

  /** See {@link AutoBurnControls.setThresholds}. Mutates `wallet.automation.autoBurn`. */
  setThresholds(lower: number, upper: number): boolean {
    if (!this.stepOwned('thresholds') || !Number.isFinite(lower) || !Number.isFinite(upper) || !(lower >= 0) || !(lower < upper))
      return false;
    const settings = this.state.wallet.automation.autoBurn;
    settings.lower = lower;
    settings.upper = upper;
    return true;
  }

  /** See {@link AutoBurnControls.setReserve}. Mutates `wallet.automation.autoBurn.reserve`. */
  setReserve(count: number): boolean {
    if (!this.stepOwned('reserve') || !Number.isFinite(count) || count < 0) return false;
    this.state.wallet.automation.autoBurn.reserve = Math.floor(count);
    return true;
  }

  /**
   * The player switched an action's Overclock by hand: the automation forgets that it had switched it off.
   *
   * Called by: `Automation.playerSwitchedOverclock`.
   */
  playerSwitchedOverclock(id: ActionId): void {
    this.switcher.forgetOverclock(id);
  }

  /**
   * The player switched an Auto-run by hand: the automation forgets that it had switched it off.
   *
   * Called by: `Automation.playerSwitchedAutoRun`.
   */
  playerSwitchedAutoRun(id: BuyableId): void {
    this.switcher.forgetAutoRun(id);
  }

  /**
   * Runs one slice of game time (see the class remarks for the order).
   *
   * Called by: `Automation.step`.
   *
   * @param deltaMs the length of the slice in milliseconds
   */
  step(deltaMs: number): void {
    const rules = this.rules();
    const stack = this.config.items.rarities[0];
    if (!rules.toggle || !this.config.items.burnLead || !stack) return;
    const life = this.state.sleeve.autoBurn;
    if (this.state.sleeve.heat >= rules.upperAt) {
      if (life.upperArmed && rules.upper) life.on = true;
      life.upperArmed = false;
    } else life.upperArmed = true;
    this.burn(rules, deltaMs, stack.id);
    this.switchOff(rules);
    this.switchOn(rules);
  }

  /** Leads that may be used: the leads held minus the reserve, none while leads cannot be used (heat cooling is held in place). */
  private available(rules: AutoBurnRules): number {
    if (!this.burnLeads.usable()) return 0;
    return Math.max(0, this.held() - rules.reserve);
  }

  /** Uses the leads of this slice: one a second, or with "hold" just enough to reach the lower threshold. */
  private burn(rules: AutoBurnRules, deltaMs: number, rarityId: string): void {
    const life = this.state.sleeve.autoBurn;
    const { heat } = this.state.sleeve;
    if (!life.on || !heatNeedsCooling(heat)) {
      life.seconds = 0;
      return;
    }
    let wanted: number;
    if (rules.hold) {
      life.seconds = 0;
      wanted = this.burnLeads.leadsNeeded(heatHoldTarget(rules.lower));
    } else {
      life.seconds += Math.max(0, deltaMs) / 1000;
      wanted = Math.floor(life.seconds + SECOND_EPSILON);
      life.seconds = Math.max(0, life.seconds - wanted);
    }
    const count = Math.min(wanted, this.available(rules));
    if (count >= 1) this.burnLeads.useMany(rarityId, count);
  }

  /** The off rules (only while the Burn lead toggle is on): out of leads while heat is above the lower threshold, see {@link AutoBurnSwitcher.switchOff}. */
  private switchOff(rules: AutoBurnRules): void {
    if (this.state.sleeve.autoBurn.on && this.available(rules) <= 0 && this.state.sleeve.heat > rules.lower) this.switcher.switchOff(rules);
  }

  /** The on rules: heat below the lower threshold with leads available, see {@link AutoBurnSwitcher.switchOn}; a change also switches the toggle on. */
  private switchOn(rules: AutoBurnRules): void {
    if (this.available(rules) > 0 && this.state.sleeve.heat < rules.lower && this.switcher.switchOn(rules)) this.state.sleeve.autoBurn.on = true;
  }
}
