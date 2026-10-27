/**
 * @module ui
 *
 * The Network widget: nodes, payout per node, credits per second, synthetic sleeves and Moles.
 *
 * @remarks
 * Called by: `ui/viewModel.ts`. Calls: `GameQueries`, the helpers in `viewFormat.ts`.
 */
import type { GameConfig, ItemQueries, SleeveQueries, GameStateView, SleeveStats } from '../../core';
import { formatBigNum, formatPlain } from '../../numbers';
import type { UiText } from '../uiText';
import { ACTION_BONUS_DECIMALS, MULTIPLIER_DECIMALS, PER_NODE_DECIMALS, buildStatRow as row, namedTerms } from './viewFormat';
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
  return {
    title: text.titles.network,
    stats: [
      row('nodes', text, formatBigNum(state.network)),
      row('payout', text, text.perSecond(formatBigNum(engine.passiveCreditsPerNode(), PER_NODE_DECIMALS)), () =>
        text.tips.payout({
          base: formatPlain(config.network.creditsPerNodePerSecond),
          creditLever: config.global.creditMultiplier === 1 ? null : formatPlain(config.global.creditMultiplier),
          purchases: namedTerms(
            stats.nodePayoutTerms,
            config,
            (id) => state.purchased[id] ?? 0,
            (f) => formatPlain(f, MULTIPLIER_DECIMALS),
          ),
          actionBonus: formatPlain(stats.nodePayoutBonus, ACTION_BONUS_DECIMALS),
          perNode: formatBigNum(engine.passiveCreditsPerNode(), PER_NODE_DECIMALS),
        }),
      ),
      row('income', text, text.format.income(formatBigNum(engine.passiveCreditsPerSecond())), () =>
        text.tips.income({
          nodes: formatBigNum(state.network),
          perNode: formatBigNum(engine.passiveCreditsPerNode(), PER_NODE_DECIMALS),
          keepPercent: keep >= 1 ? null : formatPlain(keep * 100),
          gross: formatBigNum(engine.passiveCreditsPerNode().mul(state.network)),
          total: formatBigNum(engine.passiveCreditsPerSecond()),
        }),
      ),
      row(
        'synths',
        text,
        formatPlain(engine.synthCount()),
        () => text.tips.synths({ count: formatPlain(engine.synthCount()), perSecond: formatBigNum(engine.synthCreditsPerSecond()) }),
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
        formatPlain(state.moles),
        () => text.tips.moles({ moles: formatPlain(state.moles), boostPercent: formatPlain(stats.heatCooldownBoost * 100) }),
        null,
        engine.backChannel() === null && !(state.moles > 0), // the counter appears with the skill that gives Moles
      ),
    ],
  };
}
