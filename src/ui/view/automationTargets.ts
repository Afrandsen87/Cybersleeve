/** Automation context control keys shared by guidance and panels. Called by: automationAdds, protocol panels. Calls: nothing. */
import type { AutoBurnStep } from '../../core';
/** Stable panel control identity. Called by: panel registries, automation guidance. Calls: nothing. */
export type AutomationTarget =
  | `chip-sale-${string}`
  | `chip-chan-${string}`
  | `pill-${string}`
  | `slot-${number}`
  | 'ds-status'
  | 'ab-status'
  | 'ab-strip'
  | 'ab-reserve'
  | 'row-throttle'
  | 'row-redline'
  | 'row-failsafe'
  | 'row-restart'
  | 'row-target'
  | 'chip-offActions'
  | 'sub-restartOc';
/** Constructs a sale switch key. Called by: guidance, Kompromat panel. Calls: nothing. */
export const saleChip = (rarity: string): AutomationTarget => `chip-sale-${rarity}`;
/** Constructs a channel switch key. Called by: guidance, Kompromat panel. Calls: nothing. */
export const channelChip = (rarity: string): AutomationTarget => `chip-chan-${rarity}`;
/** Constructs a permit key. Called by: guidance, Dispersal panel. Calls: nothing. */
export const permit = (rarity: string): AutomationTarget => `pill-${rarity}`;
/** Constructs a capacity key. Called by: guidance, Dispersal panel. Calls: nothing. */
export const slot = (n: number): AutomationTarget => `slot-${n}`;
/** Shared fixed controls. Called by: guidance, protocol panels. Calls: nothing. */
export const targets = {
  burnStatus: 'ab-status',
  strip: 'ab-strip',
  reserve: 'ab-reserve',
  dispersalStatus: 'ds-status',
  targetRow: 'row-target',
  offActions: 'chip-offActions',
  restartOc: 'sub-restartOc',
} as const;
/** Shared Auto Burn step keys. Called by: guidance, Auto Burn panel. Calls: nothing. */
export const burnTargets: Readonly<Record<AutoBurnStep, AutomationTarget>> = {
  hold: 'row-throttle',
  upper: 'row-redline',
  offOverclocks: 'row-failsafe',
  offActions: targets.offActions,
  onActions: 'row-restart',
  onOverclocks: targets.restartOc,
  thresholds: targets.strip,
  reserve: targets.reserve,
};
/** Auto Burn protocol row ids (`autoBurnView`) to the control key of the step that reveals the row. Called by: Auto Burn panel. Calls: nothing. */
export const burnRowTargets: Readonly<Record<string, AutomationTarget>> = {
  trigger: burnTargets.upper,
  throttle: burnTargets.hold,
  failsafe: burnTargets.offOverclocks,
  restart: burnTargets.onActions,
};
