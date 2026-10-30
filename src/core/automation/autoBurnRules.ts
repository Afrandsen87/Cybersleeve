/**
 * @module core
 *
 * Auto Burn: which of its skills are owned and, from that and the player's settings, the rules that apply now. The one owner of "is step X owned"
 * and of "what threshold / reserve / switch counts now".
 */
import type { BuyableDefinition, BuyableId, GameConfig } from '../types';
import type { AutoBurnSettings, AutoBurnStep, AutoBurnSwitch } from './autoBurnTypes';

/**
 * True when the Auto Burn skill that grants the step is owned (the buyable with the effect `autoBurnStep` for it).
 *
 * Called by: {@link autoBurnRules}, `AutoBurn.stepOwned`, `testing/invariants.ts`.
 *
 * @param buyables all buyable definitions
 * @param purchased copies owned, by id
 * @param step the step
 */
export function ownsAutoBurnStep(
  buyables: readonly BuyableDefinition[],
  purchased: Readonly<Record<BuyableId, number>>,
  step: AutoBurnStep,
): boolean {
  return buyables.some((b) => b.effect.kind === 'autoBurnStep' && b.effect.step === step && (purchased[b.id] ?? 0) > 0);
}

/** What applies now: the switches that are owned and on, and the numbers in force. */
export interface AutoBurnRules {
  /** The Inventory toggle exists (the lane's first skill is owned). */
  readonly toggle: boolean;
  /** Use just enough leads to hold heat at `lower`, instead of one a second. */
  readonly hold: boolean;
  /** Heat reaching `upper` switches the toggle on. */
  readonly upper: boolean;
  /** Out of leads above `lower`: switch heat-making Overclocks off. */
  readonly offOverclocks: boolean;
  /** Out of leads above `lower`: switch the Auto-run of heat-making actions off. */
  readonly offActions: boolean;
  /** Below `lower` with leads: switch the Auto-runs this automation switched off back on (and the toggle on). */
  readonly onActions: boolean;
  /** Below `lower` with leads: switch the Overclocks this automation switched off back on (and the toggle on). */
  readonly onOverclocks: boolean;
  /** The lower threshold in force: the setting once `thresholds` is owned, else the configured start. */
  readonly lower: number;
  /** The upper threshold in force. */
  readonly upperAt: number;
  /** Leads always kept: the setting once `reserve` is owned, else 0. */
  readonly reserve: number;
}

/**
 * The rules that apply now.
 *
 * Called by: `AutoBurn` (every slice and for the screen). Calls: {@link ownsAutoBurnStep}.
 *
 * @param config reads `buyables` and the configured start of the thresholds
 * @param purchased copies owned, by id
 * @param settings what the player set
 * @param toggleOwned whether the lane's first skill is owned
 */
export function autoBurnRules(
  config: Pick<GameConfig, 'buyables' | 'automation'>,
  purchased: Readonly<Record<BuyableId, number>>,
  settings: AutoBurnSettings,
  toggleOwned: boolean,
): AutoBurnRules {
  const owns = (step: AutoBurnStep): boolean => toggleOwned && ownsAutoBurnStep(config.buyables, purchased, step);
  const on = (s: AutoBurnSwitch): boolean => owns(s) && settings.switches[s];
  const editable = owns('thresholds');
  return {
    toggle: toggleOwned,
    hold: on('hold'),
    upper: on('upper'),
    offOverclocks: on('offOverclocks'),
    offActions: on('offActions'),
    onActions: on('onActions'),
    onOverclocks: on('onOverclocks'),
    lower: editable ? settings.lower : (config.automation?.autoBurnCeiling ?? 0),
    upperAt: editable ? settings.upper : (config.automation?.autoBurnUpper ?? 0),
    reserve: owns('reserve') ? settings.reserve : 0,
  };
}
