/**
 * @module core
 *
 * Auto Burn: the Burn lead Inventory toggle, and the rules that grow with the ten skills of its lane.
 */
import type { Inventory } from '../items/inventory';
import type { BurnLeads } from '../items/burnLeads';
import type { ActionId, BuyableId, GameConfig, GameState } from '../types';
import { isFeatureUnlocked } from './automation';
import { type AutoBurnRules, autoBurnRules, ownsAutoBurnStep } from './autoBurnRules';
import type { AutoBurnStep, AutoBurnSwitch } from './autoBurnTypes';

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
  /** Sets a switch; only works once its skill is owned. Before `choose` is owned, the "also" switches follow the ones before them. @returns the switch's state now */
  setSwitch(name: AutoBurnSwitch, on: boolean): boolean;
  /** Sets both thresholds (finite, 0 <= lower < upper); only works once `thresholds` is owned. @returns true when they were set */
  setThresholds(lower: number, upper: number): boolean;
  /** Sets the number of leads always kept (a whole number >= 0, fractions are cut off); only works once `reserve` is owned. @returns true when it was set */
  setReserve(count: number): boolean;
}

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

/** Floating-point slack when counting whole seconds out of many slices. */
const SECOND_EPSILON = 1e-9;

/**
 * Auto Burn: uses Burn leads for the player while the Inventory toggle is on, and switches heat-making Overclocks and Auto-runs off and on.
 *
 * @remarks
 * Context: automation. Per slice (closed form, so one long slice equals many short ones) and in this order:
 * 1. With the "upper" switch and heat at or above the upper threshold, the toggle is switched on.
 * 2. With the toggle on and heat above 0: one lead a second (a fractional-second accumulator in the sleeve state), or with "hold" just
 *    enough leads to bring heat down to the lower threshold (`BurnLeads.leadsNeeded`), none at or below it. Never below the reserve.
 * 3. Out of leads (held minus reserve is 0) with heat above the lower threshold: the off rules switch heat-making Overclocks and/or the
 *    Auto-run of heat-making actions off, and record what they switched.
 * 4. Heat below the lower threshold with leads available: the on rules switch back on only what was recorded, and switch the toggle on.
 * Switching goes through the toggle owners (`AutoBurnSwitches`); a player's own press on an item forgets its record (`playerSwitched*`).
 *
 * Called by: `Automation.step`, `engine.ts` (the screen uses {@link AutoBurnControls}).
 * Calls: {@link BurnLeads}, {@link Inventory}, {@link AutoBurnSwitches}, {@link autoBurnRules}.
 */
export class AutoBurn implements AutoBurnControls {
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
  ) {}

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
    if (!this.stepOwned('choose')) {
      // before the player can choose, the "also" switch implies the one before it (5 implies 4, 7 implies 6)
      if (name === 'offActions' && on) sw.offOverclocks = true;
      if (name === 'offOverclocks' && !on) sw.offActions = false;
      if (name === 'onOverclocks' && on) sw.onActions = true;
      if (name === 'onActions' && !on) sw.onOverclocks = false;
    }
    return on;
  }

  /** See {@link AutoBurnControls.setThresholds}. Mutates `wallet.automation.autoBurn`. */
  setThresholds(lower: number, upper: number): boolean {
    if (!this.stepOwned('thresholds') || !Number.isFinite(lower) || !Number.isFinite(upper) || !(lower >= 0) || !(lower < upper)) return false;
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
    delete this.state.sleeve.autoBurn.overclocksOff[id];
  }

  /**
   * The player switched an Auto-run by hand: the automation forgets that it had switched it off.
   *
   * Called by: `Automation.playerSwitchedAutoRun`.
   */
  playerSwitchedAutoRun(id: BuyableId): void {
    delete this.state.sleeve.autoBurn.autoRunsOff[id];
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
    if (rules.upper && this.state.sleeve.heat >= rules.upperAt) life.on = true;
    this.burn(rules, deltaMs, stack.id);
    this.switchOff(rules);
    this.switchOn(rules);
  }

  /** Leads that may be used: the leads held minus the reserve. */
  private available(rules: AutoBurnRules): number {
    return Math.max(0, this.held() - rules.reserve);
  }

  /** Uses the leads of this slice: one a second, or with "hold" just enough to reach the lower threshold. */
  private burn(rules: AutoBurnRules, deltaMs: number, rarityId: string): void {
    const life = this.state.sleeve.autoBurn;
    const { heat } = this.state.sleeve;
    if (!life.on || !(heat > 0)) {
      life.seconds = 0;
      return;
    }
    let wanted: number;
    if (rules.hold) {
      life.seconds = 0;
      wanted = this.burnLeads.leadsNeeded(rules.lower);
    } else {
      life.seconds += Math.max(0, deltaMs) / 1000;
      wanted = Math.floor(life.seconds + SECOND_EPSILON);
      life.seconds = Math.max(0, life.seconds - wanted);
    }
    const count = Math.min(wanted, this.available(rules));
    if (count >= 1) this.burnLeads.useMany(rarityId, count);
  }

  /** The off rules: out of leads while heat is above the lower threshold, switch the heat-making things off and record them. */
  private switchOff(rules: AutoBurnRules): void {
    if (!(rules.offOverclocks || rules.offActions) || this.available(rules) > 0 || !(this.state.sleeve.heat > rules.lower)) return;
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

  /** The on rules: heat below the lower threshold with leads available, switch back on what was recorded, and the toggle on. */
  private switchOn(rules: AutoBurnRules): void {
    if (!(rules.onOverclocks || rules.onActions) || this.available(rules) <= 0 || !(this.state.sleeve.heat < rules.lower)) return;
    const life = this.state.sleeve.autoBurn;
    let restored = false;
    if (rules.onOverclocks) {
      for (const id of Object.keys(life.overclocksOff)) {
        delete life.overclocksOff[id];
        this.switches.setOverclock(id, true);
        restored = true;
      }
    }
    if (rules.onActions) {
      for (const id of Object.keys(life.autoRunsOff)) {
        delete life.autoRunsOff[id];
        this.switches.setAutoRun(id, true);
        restored = true;
      }
    }
    if (restored) life.on = true;
  }

  /** True when the Auto-run is owned and not switched off. */
  private autoRunIsOn(id: BuyableId): boolean {
    return (this.state.sleeve.purchased[id] ?? 0) > 0 && this.state.sleeve.autoRunOff[id] !== true;
  }
}
