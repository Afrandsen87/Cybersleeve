/** @module ui
 * Panel contracts. Called by: view and widget. Calls: none.
 */
import type { AutoBurnActivity, AutoBurnSwitch } from '../../core';
import type { HeatStripLayout } from './autoBurnStrip';
/** LED state. Called by: view, panel. Calls: none. */
export interface BurnSwitchView {
  readonly name: AutoBurnSwitch;
  readonly on: boolean;
  readonly text: string;
}
/** Target chip. Called by: view, panel. Calls: none. */
export interface BurnChipView {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
  readonly icon: string;
  readonly on: boolean;
  readonly switchName?: AutoBurnSwitch;
}
/** Restart group. Called by: view, panel. Calls: none. */
export interface BurnSubrowView {
  readonly id: string;
  readonly visible: boolean;
  readonly switch: BurnSwitchView;
  readonly chips: readonly BurnChipView[];
  readonly empty: string;
}
/** Protocol row. Called by: view, panel. Calls: none. */
export interface BurnRowView {
  readonly id: string;
  readonly visible: boolean;
  readonly tag: string;
  readonly caption: string;
  readonly condition: string;
  readonly action: string;
  readonly firing: boolean;
  readonly switch?: BurnSwitchView;
  readonly chips: readonly BurnChipView[];
  readonly subrows: readonly BurnSubrowView[];
}
/** Fixed or editable notch. Called by: view, panel. Calls: none. */
export interface BurnNotchView {
  readonly visible: boolean;
  readonly value: number;
  readonly label: string;
  readonly editable: boolean;
}
/** Owner-sourced panel data. Called by: AutomationView. Calls: none. */
export interface AutoBurnView {
  readonly status: {
    readonly visible: boolean;
    readonly activity: AutoBurnActivity;
    readonly word: string;
    readonly reason: string;
    readonly heat: string;
    readonly leads: string;
    readonly toggle: string;
  };
  readonly strip: {
    readonly visible: boolean;
    readonly layout: HeatStripLayout;
    readonly zones: readonly string[];
    readonly floor: BurnNotchView;
    readonly redline: BurnNotchView;
    readonly heat: string;
  };
  readonly rows: readonly BurnRowView[];
  readonly reserve: { readonly visible: boolean; readonly value: number; readonly label: string };
}
