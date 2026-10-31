/**
 * @module ui
 *
 * The text the main screen's top bar, Sleeve stat groups, heat gauge and panel status lights are written with. Every number
 * arrives already formatted.
 *
 * @remarks
 * Pure types; part of `UiText` (`uiText.mainScreen`, filled in by `ui/hudText.ts`). Called by: `hudView.ts`, `sleeveView.ts`,
 * `sleeveGroups.ts`, `networkView.ts`. Calls: nothing.
 */

/** The wording of the top bar, the Sleeve stat groups, the heat gauge and the panel status lights. */
export interface MainScreenText {
  /** The label beside the credits balance in the top bar. */
  readonly creditsLabel: string;
  /** The Sleeve panel's status light. */
  readonly online: string;
  /** The Network panel's status light while there are nodes. */
  readonly linked: string;
  /** The header of each Sleeve stat group. */
  readonly groupTitles: Readonly<Record<'access' | 'skill' | 'defense' | 'risk', string>>;
  /** The label of the zone where the tax takes every credit (not where the tax starts: it starts with the first point of heat). */
  readonly zoneText: string;
  /** The title of the re-sleeve box at the bottom of the Sleeve panel. */
  readonly resleeveTitle: string;
  /** The heat written on the heat strip, e.g. `HEAT 652`. */
  heatValue(value: string): string;
  /** The red note under the network income: the share the heat tax takes, the heat, and where it takes everything (`null`: capped). */
  taxNote(percent: string, heat: string, stop: string | null): string;
  /** The total income per second in the top bar, e.g. `+34.73T/s`. */
  rate(value: string): string;
  /** Under the heat strip: the heat from which every credit is taxed. */
  stopLegend(stop: string): string;
  /** Under the heat strip when the tax is capped: the cap in percent. */
  capLegend(percent: string): string;
  /** The cooldown bar's label while heat cools: heat removed per cycle and seconds per cycle, e.g. `-1 / 60s`. */
  cooldown(amount: string, seconds: string): string;
}
