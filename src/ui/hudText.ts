/**
 * @module ui
 * Main-screen wording kept outside the uiText facade.
 * Called by: uiText. Calls: none; no side effects.
 */
import type { MainScreenText } from './parts/hudText';

/** Main-screen words. Called by: view builders via uiText. Calls: none. */
export const hudText: MainScreenText = {
  creditsLabel: 'CREDITS',
  online: 'ONLINE',
  linked: 'LINKED',
  groupTitles: { access: 'ACCESS', skill: 'SKILL', defense: 'DEFENSE', risk: 'RISK' },
  zoneText: 'TAX ZONE',
  resleeveTitle: 'RE-SLEEVE',
  heatValue: (value) => `HEAT ${value}`,
  taxValue: (percent) => `TAX ${percent}%`,
  taxNote: (percent, heat, stop) => `heat tax takes ${percent}% (heat ${heat}${stop === null ? '' : ` ≥ ${stop}`})`,
  rate: (value) => `+${value}/s`,
  stopLegend: (stop) => `all credits taxed ≥ ${stop}`,
  capLegend: (percent) => `tax capped at ${percent}%`,
  cooldown: (amount, seconds) => `-${amount} / ${seconds}s`,
};
