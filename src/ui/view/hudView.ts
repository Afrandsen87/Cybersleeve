/**
 * @module ui
 * Pure HUD projection for the selected sleeve and the shared wallet.
 * Called by: `buildScoped`. Calls: `SleeveQueries.creditsPerSecond`, `formatBigNum`, `formatSignificant`.
 */
import type { GameStateView, SleeveQueries } from '../../core';
import { formatBigNum, formatSignificant, numberFactory } from '../../numbers';
import type { UiText } from '../uiText';
import type { HeatGaugeView } from './sleeveViewTypes';
import { PANEL_DIGITS } from './viewFormat';

/**
 * Display data of the wallet balance, passive income and selected sleeve's heat.
 * Called by: `ViewModel`, header widgets. Calls: nothing.
 */
export interface HudView {
  readonly creditsLabel: string;
  readonly creditsText: string;
  readonly rateText: string | null;
  readonly heat: { readonly valueText: string; readonly taxText: string; readonly fillPercent: number } | null;
}

/**
 * Builds HUD text without changing state; the gauge supplies the single strip layout and heat reveal decision.
 * Called by: `buildScoped`. Calls: `SleeveQueries`, number formatters, injected text.
 * @param engine sleeve queries supplying the authoritative income and credit keep factor
 * @param state shared wallet state
 * @param gauge selected sleeve's gauge, absent exactly while its heat row is hidden
 * @param text injected interface wording
 * @returns display-ready HUD data
 */
export function hudView(engine: SleeveQueries, state: GameStateView, gauge: HeatGaugeView | null, text: UiText): HudView {
  const rate = engine.creditsPerSecond();
  return {
    creditsLabel: text.mainScreen.creditsLabel,
    creditsText: formatBigNum(state.wallet.credits),
    rateText: rate.gt(numberFactory.fromNumber(0)) ? text.mainScreen.rate(formatBigNum(rate)) : null,
    heat:
      gauge === null
        ? null
        : {
            valueText: gauge.valueText,
            taxText: text.mainScreen.taxValue(formatSignificant((1 - engine.creditKeepFactor()) * 100, PANEL_DIGITS)),
            fillPercent: gauge.strip.fillPercent,
          },
  };
}
