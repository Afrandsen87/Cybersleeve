/**
 * @module core
 *
 * Auto Burn: the names of its skills and switches and the shape of the state it keeps (settings in the wallet, the running parts per sleeve).
 */
import type { ActionId, BuyableId, GameConfig } from '../types';

/**
 * The switches the player can turn on, one per skill from the second to the seventh of the Auto Burn lane:
 * - `hold`: use just enough leads to hold heat at the lower threshold (instead of one lead a second).
 * - `upper`: switch the Burn lead toggle on when heat reaches the upper threshold.
 * - `offOverclocks`: out of leads while heat is above the lower threshold, switch the heat-making Overclocks off.
 * - `offActions`: the same for the Auto-run of heat-making actions.
 * - `onActions`: heat below the lower threshold and leads available, switch the Auto-runs this automation switched off back on, and the toggle on.
 * - `onOverclocks`: the same for the Overclocks this automation switched off.
 */
export type AutoBurnSwitch = 'hold' | 'upper' | 'offOverclocks' | 'offActions' | 'onActions' | 'onOverclocks';

/**
 * The step of the Auto Burn lane a skill grants (skills 2 to 10; skill 1 is `unlocksAutomation` and gives the Inventory toggle). Six are
 * switches ({@link AutoBurnSwitch}); `choose` lets the four off/on switches act independently, `thresholds` lets the player edit both
 * thresholds, `reserve` lets the player keep a number of leads.
 */
export type AutoBurnStep = AutoBurnSwitch | 'choose' | 'thresholds' | 'reserve';

/** The switches, in the order of the lane's skills. */
export const AUTO_BURN_SWITCHES: readonly AutoBurnSwitch[] = ['hold', 'upper', 'offOverclocks', 'offActions', 'onActions', 'onOverclocks'];

/** Every step of the lane after the first skill, in the order of the lane's skills (skill 2 first). */
export const AUTO_BURN_STEPS: readonly AutoBurnStep[] = [...AUTO_BURN_SWITCHES, 'choose', 'thresholds', 'reserve'];

/** What the player set for Auto Burn. Part of the wallet's automation state. */
export interface AutoBurnSettings {
  /** The lower threshold (>= 0): what "hold" brings heat down to, and the line the off and on rules look at. Editable once `thresholds` is owned. */
  lower: number;
  /** The upper threshold (> lower): heat reaching it switches the toggle on. Editable once `thresholds` is owned. */
  upper: number;
  /** Burn leads always kept (a whole number >= 0); only used once `reserve` is owned. */
  reserve: number;
  /** The switches (a switch only counts once its skill is owned). New switches start off. */
  switches: Record<AutoBurnSwitch, boolean>;
}

/**
 * What Auto Burn keeps for the life being played. Part of the sleeve state; reset by re-sleeving.
 */
export interface AutoBurnLife {
  /** The Burn lead Inventory toggle: while on, a lead is used every second (or as many as the hold rule says). */
  on: boolean;
  /** The part of a second (0..1) that has passed towards the next lead. */
  seconds: number;
  /** Actions whose heat-making Overclock this automation switched off (and not yet back on or touched by hand). */
  overclocksOff: Record<ActionId, true>;
  /** Auto-run buyables of heat-making actions this automation switched off (and not yet back on or touched by hand). */
  autoRunsOff: Record<BuyableId, true>;
}

/**
 * Fresh settings: every switch off, the thresholds at the configured start, no reserve.
 *
 * Called by: `automation.ts` (`createAutomationState`). Calls: nothing.
 *
 * @param config reads `automation.autoBurnCeiling` and `automation.autoBurnUpper`
 */
export function createAutoBurnSettings(config: Pick<GameConfig, 'automation'>): AutoBurnSettings {
  return {
    lower: config.automation?.autoBurnCeiling ?? 0,
    upper: config.automation?.autoBurnUpper ?? 0,
    reserve: 0,
    switches: { hold: false, upper: false, offOverclocks: false, offActions: false, onActions: false, onOverclocks: false },
  };
}

/**
 * A fresh life state: the toggle off, nothing switched off by the automation.
 *
 * Called by: `save/state.ts`, `automationSave.ts`. Calls: nothing.
 */
export function createAutoBurnLife(): AutoBurnLife {
  return { on: false, seconds: 0, overclocksOff: {}, autoRunsOff: {} };
}
