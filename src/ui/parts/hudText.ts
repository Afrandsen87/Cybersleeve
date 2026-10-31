/**
 * @module ui
 * Main-screen text contracts; all numbers arrive already formatted.
 * Called by: hudText and view builders. Calls: none.
 */

/**
 * Wording for the HUD, panel groups and heat gauge.
 * Called by: main-screen view builders. Calls: none.
 */
export interface MainScreenText {
  readonly creditsLabel: string;
  readonly online: string;
  readonly linked: string;
  readonly groupTitles: Readonly<Record<'access' | 'skill' | 'defense' | 'risk', string>>;
  /** The label of the zone where the tax takes every credit (not where the tax starts: it starts with the first point of heat). */
  readonly zoneText: string;
  readonly resleeveTitle: string;
  /** Formats the heat readout. Called by: heat gauge/HUD. Calls: none. */
  heatValue(value: string): string;
  /** Formats tax percent. Called by: HUD. Calls: none. */
  taxValue(percent: string): string;
  /** Formats the heat tax note. Called by: networkView. Calls: none. */
  taxNote(percent: string, heat: string, stop: string | null): string;
  /** Formats total income. Called by: HUD. Calls: none. */
  rate(value: string): string;
  /** Formats the all-income tax threshold. Called by: sleeveGroups. Calls: none. */
  stopLegend(stop: string): string;
  /** Formats a capped tax. Called by: sleeveGroups. Calls: none. */
  capLegend(percent: string): string;
  /** Formats one cooldown cycle. Called by: sleeveRows. Calls: none. */
  cooldown(amount: string, seconds: string): string;
}
