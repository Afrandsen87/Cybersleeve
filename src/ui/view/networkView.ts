/**
 * @module ui
 *
 * The Network widget: nodes, payout per node, credits per second, synthetic sleeves and Moles.
 *
 * @remarks
 * Called by: `ui/viewModel.ts`. Calls: `GameQueries`, the helpers in `viewFormat.ts`.
 */
import { heatStopPoint, type GameConfig, type ItemQueries, type SleeveQueries, type GameStateView, type SleeveStats } from '../../core';
import { formatBigNum, formatPlain, formatSignificant } from '../../numbers';
import type { UiText } from '../uiText';
import { aggregatedMoleText } from './moleBonus';
import { ACTION_BONUS_DECIMALS, MULTIPLIER_DECIMALS, PANEL_DIGITS, PER_NODE_DECIMALS, buildStatRow as row, namedTerms } from './viewFormat';
import type { NetworkView } from './viewTypes';

/**
 * The Network widget.
 *
 * Called by: {@link buildViewModel}. Calls: `GameQueries.passiveCreditsPerNode`, `passiveCreditsPerSecond`, `synthCount`.
 *
 * @param engine the engine to read from
 * @param config game configuration
 * @param state the game state
 * @param stats the sleeve's derived stats
 * @param text the display text
 */
export function networkView(
  engine: ItemQueries & SleeveQueries,
  config: GameConfig,
  state: GameStateView,
  stats: SleeveStats,
  text: UiText,
): NetworkView {
  const keep = engine.creditKeepFactor();
  const taxShare = 1 - keep;
  const stop = heatStopPoint(stats.heatReduction, config.sleeve.heatTaxPerPoint, stats.heatTaxCap);
  return {
    title: text.titles.network,
    status: !state.sleeve.network.isZero() ? text.mainScreen.linked : null,
    taxNote:
      taxShare > 0
        ? text.mainScreen.taxNote(
            formatSignificant(taxShare * 100, PANEL_DIGITS),
            formatSignificant(stats.heat, PANEL_DIGITS),
            stop === null ? null : formatSignificant(stop, PANEL_DIGITS),
          )
        : null,
    stats: [
      row('nodes', text, formatBigNum(state.sleeve.network)),
      row('payout', text, text.perSecond(formatBigNum(engine.passiveCreditsPerNode(), PER_NODE_DECIMALS)), () =>
        text.tips.payout({
          base: formatPlain(config.network.creditsPerNodePerSecond),
          creditLever: config.global.creditMultiplier === 1 ? null : formatPlain(config.global.creditMultiplier),
          purchases: namedTerms(
            stats.nodePayoutTerms,
            config,
            (id) => state.sleeve.purchased[id] ?? 0,
            (f) => formatPlain(f, MULTIPLIER_DECIMALS),
          ),
          actionBonus: formatPlain(stats.nodePayoutBonus, ACTION_BONUS_DECIMALS),
          perNode: formatBigNum(engine.passiveCreditsPerNode(), PER_NODE_DECIMALS),
        }),
      ),
      row('income', text, text.format.income(formatBigNum(engine.passiveCreditsPerSecond())), () =>
        text.tips.income({
          nodes: formatBigNum(state.sleeve.network),
          perNode: formatBigNum(engine.passiveCreditsPerNode(), PER_NODE_DECIMALS),
          keepPercent: keep >= 1 ? null : formatPlain(keep * 100),
          gross: formatBigNum(engine.passiveCreditsPerNode().mul(state.sleeve.network)),
          total: formatBigNum(engine.passiveCreditsPerSecond()),
        }),
      ),
      row(
        'synths',
        text,
        formatSignificant(engine.synthCount(), PANEL_DIGITS),
        () =>
          text.tips.synths({
            count: formatPlain(engine.synthCount()),
            perSecond: formatBigNum(engine.synthCreditsPerSecond()),
            ceiling: formatBigNum(engine.synthIncomeCeiling()),
          }),
        null,
        !engine.synthSleevesUnlocked(), // the entry appears with the skill that gives synthetic sleeves
      ),
      row(
        'synthIncome',
        text,
        text.format.income(formatBigNum(engine.synthCreditsPerSecond())),
        null,
        null,
        !engine.synthSleevesUnlocked(),
      ),
      row(
        'moles',
        text,
        formatSignificant(state.sleeve.moles, PANEL_DIGITS),
        () =>
          text.tips.moles({
            moles: formatPlain(state.sleeve.moles),
            boostPercent: formatPlain(stats.heatCooldownBoost * 100),
            aggregatedPercent: aggregatedMoleText(stats.moleAggregation, state.sleeve.moles),
          }),
        null,
        engine.backChannel() === null && !(state.sleeve.moles > 0), // the counter appears with the skill that gives Moles
      ),
    ],
  };
}
