/**
 * @module ui
 *
 * The top bar's view: the wallet balance and the income rate.
 *
 * @remarks
 * Called by: `buildScoped` (`ui/viewModel.ts`). Calls: `SleeveQueries.creditsPerSecond`, `formatBigNum`, `RevealTracker`.
 */
import type { GameStateView, SleeveQueries } from '../../core';
import { formatBigNum, numberFactory } from '../../numbers';
import type { UiText } from '../uiText';
import type { RevealTracker } from './revealTracker';
import type { RevealableStat } from './statReveal';

/** The reveal-ledger stat id of the income rate (in `REVEALABLE_STATS`): once shown it stays, also at 0 and after a re-sleeve. */
export const INCOME_RATE_REVEAL_ID: RevealableStat = 'incomeRate';

/**
 * Display data of the top bar.
 *
 * Called by: `ViewModel`, `widgets/hud.ts`. Calls: nothing.
 */
export interface HudView {
  /** The label beside the balance (`CREDITS`). */
  readonly creditsLabel: string;
  /** The wallet balance, formatted. */
  readonly creditsText: string;
  /** The total income per second (`+34.73T/s`); `null` until the income has first been above 0. */
  readonly rateText: string | null;
}

/**
 * Builds the top bar's view. Reads only; the rate's first showing is collected by the tracker for the ledger.
 *
 * Called by: `buildScoped`. Calls: `SleeveQueries.creditsPerSecond` (owner: `NetworkSystem.creditsPerSecond`), `formatBigNum`,
 * `RevealTracker.reveals`.
 *
 * @param engine gives the total income per second
 * @param state gives the wallet balance
 * @param text the display text
 * @param tracker the reveal ledger reader (default: none, the rate shows only while above 0)
 * @returns the display-ready top bar
 */
export function hudView(engine: SleeveQueries, state: GameStateView, text: UiText, tracker?: RevealTracker): HudView {
  const rate = engine.creditsPerSecond();
  const earning = rate.gt(numberFactory.fromNumber(0));
  const shown = tracker ? tracker.reveals('stat', INCOME_RATE_REVEAL_ID, earning) : earning;
  return {
    creditsLabel: text.mainScreen.creditsLabel,
    creditsText: formatBigNum(state.wallet.credits),
    rateText: shown ? text.mainScreen.rate(formatBigNum(rate)) : null,
  };
}
