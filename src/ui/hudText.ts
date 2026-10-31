/**
 * @module ui
 *
 * The default wording of the main screen's top bar, Sleeve stat groups, heat gauge and status lights (`uiText.mainScreen`),
 * kept in its own file so `uiText.ts` stays small.
 *
 * @remarks
 * Called by: `uiText.ts`. Calls: nothing.
 */
import type { MainScreenText } from './parts/hudText';

/** The default main screen wording (see `MainScreenText`). */
export const hudText: MainScreenText = {
  creditsLabel: 'CREDITS',
  online: 'ONLINE',
  linked: 'LINKED',
  groupTitles: { access: 'ACCESS', skill: 'SKILL', defense: 'DEFENSE', risk: 'RISK' },
  zoneText: 'FULLY TAXED ZONE',
  resleeveTitle: 'RE-SLEEVE',
  heatValue: (value) => `HEAT ${value}`,
  taxNote: (percent) => `heat tax takes ${percent}%`,
  rate: (value) => `+${value}/s`,
  stopLegend: (stop) => `all credits taxed ≥ ${stop}`,
  capLegend: (percent) => `tax capped at ${percent}%`,
  cooldown: (amount, seconds) => `-${amount} / ${seconds}s`,
};
