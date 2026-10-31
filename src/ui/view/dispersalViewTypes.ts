/**
 * @module ui
 * Automation-context display data for augment dispersal. Called by: dispersalView, dispersalPanel. Calls: nothing.
 */

/** Dispersal protocol wording, supplied by uiText. Called by: dispersalView, dispersalPanel. Calls: nothing. */
export interface DispersalText {
  readonly dispersing: string;
  readonly standby: string;
  readonly pickAction: string;
  readonly targets: string;
  readonly permits: string;
  readonly permitCondition: string;
  readonly targetCondition: string;
  readonly targetTag: string;
  readonly arrow: string;
  status(rarities: number, actions: number): string;
  slotCount(used: number, slots: number): string;
  fullSlots(slots: number): string;
}

/** One action switch from the automation owner. Called by: dispersalView, dispersalPanel. Calls: nothing. */
export interface DispersalActionView {
  readonly id: string;
  readonly name: string;
  readonly selected: boolean;
  readonly visible: boolean;
  readonly disabled: boolean;
}

/** Owner-sourced dispersal status, permissions and targets. Called by: automationView, dispersalPanel. Calls: nothing. */
export interface DispersalView {
  readonly active: boolean;
  readonly word: string;
  readonly summary: string;
  readonly used: number;
  readonly slots: number;
  readonly maxSlots: number;
  readonly count: string;
  readonly fullSlotsNote: string;
  readonly permits: readonly { readonly id: string; readonly name: string; readonly rarityIndex: number }[];
  readonly rarityOptions: readonly { readonly id: string; readonly name: string }[];
  readonly actions: readonly DispersalActionView[];
}
