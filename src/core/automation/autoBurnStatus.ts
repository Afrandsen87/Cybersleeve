/**
 * @module core
 *
 * Auto Burn: what it is doing now and which of its rules fire. The one owner of the off and on conditions (`AutoBurn.step` uses them) and of the
 * status the screen shows, so the screen never re-derives a condition or subtracts the reserve itself.
 */
import { heatHoldTarget, heatNeedsCooling } from '../heat/heat';
import type { AutoBurnRules } from './autoBurnRules';

/** The live numbers the conditions look at. */
export interface AutoBurnSnapshot {
  /** Current heat (>= 0). */
  readonly heat: number;
  /** True when the Burn lead Inventory toggle is on. */
  readonly toggleOn: boolean;
  /** Burn leads held (the reserve included). */
  readonly held: number;
  /** False while leads cannot be used (an Overclock that stops heat cooling is running). */
  readonly usable: boolean;
}

/**
 * What Auto Burn is doing now, first match wins:
 * - `standby`: the toggle is off.
 * - `idle`: no heat to cool (below one whole point).
 * - `blocked`: leads cannot be used now (an Overclock holds heat in place).
 * - `dry`: no leads available (held minus reserve is 0).
 * - `holding`: "hold" is on and heat is at or under its target.
 * - `burning`: using leads.
 */
export type AutoBurnActivity = 'standby' | 'idle' | 'blocked' | 'dry' | 'holding' | 'burning';

/** Which rules fire now (each only when its switch is owned and on). */
export interface AutoBurnFiring {
  /** "upper": heat is at or above the upper threshold. */
  readonly trigger: boolean;
  /** "hold": leads are being used just to bring heat down to the lower threshold. */
  readonly throttle: boolean;
  /** An off rule: out of leads with the toggle on and heat above the lower threshold. */
  readonly failsafe: boolean;
  /** An on rule: leads available with heat below the lower threshold. */
  readonly restart: boolean;
}

/** Auto Burn's status for the screen. */
export interface AutoBurnStatus {
  readonly activity: AutoBurnActivity;
  readonly firing: AutoBurnFiring;
  /** Burn leads held (the reserve included). */
  readonly held: number;
  /** Leads that may be used: held minus the reserve, 0 when leads cannot be used now. */
  readonly available: number;
  /** Heat (NaN and negatives read as 0). */
  readonly heat: number;
  readonly toggleOn: boolean;
}

/**
 * Leads that may be used: held minus the reserve, never below 0, and 0 while leads cannot be used.
 *
 * Called by: `AutoBurn` (private `available`), {@link autoBurnStatus}. Calls: nothing.
 */
export function availableLeads(rules: Pick<AutoBurnRules, 'reserve'>, s: Pick<AutoBurnSnapshot, 'held' | 'usable'>): number {
  if (!s.usable) return 0;
  return Math.max(0, s.held - rules.reserve);
}

/**
 * The condition of the off rules: the toggle on, no leads available and heat above the lower threshold (the switches are checked by
 * `AutoBurnSwitcher.switchOff`).
 *
 * Called by: `AutoBurn.step`, {@link autoBurnStatus}. Calls: {@link availableLeads}.
 */
export function shouldSwitchOff(rules: AutoBurnRules, s: AutoBurnSnapshot): boolean {
  return s.toggleOn && availableLeads(rules, s) <= 0 && s.heat > rules.lower;
}

/**
 * The condition of the on rules: leads available and heat below the lower threshold (the switches are checked by `AutoBurnSwitcher.switchOn`).
 *
 * Called by: `AutoBurn.step`, {@link autoBurnStatus}. Calls: {@link availableLeads}.
 */
export function shouldSwitchOn(rules: AutoBurnRules, s: AutoBurnSnapshot): boolean {
  return availableLeads(rules, s) > 0 && s.heat < rules.lower;
}

/** What Auto Burn is doing, see {@link AutoBurnActivity}. */
function activityOf(rules: AutoBurnRules, s: AutoBurnSnapshot, available: number): AutoBurnActivity {
  if (!s.toggleOn) return 'standby';
  if (!heatNeedsCooling(s.heat)) return 'idle';
  if (!s.usable) return 'blocked';
  if (available <= 0) return 'dry';
  if (rules.hold && s.heat <= heatHoldTarget(rules.lower)) return 'holding';
  return 'burning';
}

/**
 * Auto Burn's status now: its activity, which rules fire, and the lead counts. Pure and never throws. The firing flags read the raw heat,
 * exactly as `AutoBurn.step` does (so NaN heat fires nothing, as in the step); the activity and the shown heat read NaN or negative heat as 0.
 *
 * Called by: `AutoBurn.status`. Calls: {@link availableLeads}, {@link shouldSwitchOff}, {@link shouldSwitchOn}, `heatNeedsCooling`, `heatHoldTarget`.
 *
 * @param rules the rules in force
 * @param snapshot the live heat, toggle and leads
 */
export function autoBurnStatus(rules: AutoBurnRules, snapshot: AutoBurnSnapshot): AutoBurnStatus {
  const heat = Number.isNaN(snapshot.heat) ? 0 : Math.max(0, snapshot.heat);
  const available = availableLeads(rules, snapshot);
  const activity = activityOf(rules, { ...snapshot, heat }, available);
  return {
    activity,
    firing: {
      trigger: rules.upper && snapshot.heat >= rules.upperAt,
      throttle: rules.hold && activity === 'burning',
      failsafe: shouldSwitchOff(rules, snapshot) && (rules.offOverclocks || rules.offActions),
      restart: shouldSwitchOn(rules, snapshot) && (rules.onActions || rules.onOverclocks),
    },
    held: snapshot.held,
    available,
    heat,
    toggleOn: snapshot.toggleOn,
  };
}
