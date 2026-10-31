/**
 * @module ui
 *
 * The Sleeve widget: the stat rows (access level, interface speed, ICE Rating, heat, Legend, critical chance) and the sleeve-wide
 * purchases grouped into sections.
 *
 * @remarks
 * Called by: `ui/viewModel.ts`. Calls: the helpers in `viewFormat.ts`, `buyableViews.ts`.
 */
import {
  resleeveGateId,
  type GameConfig,
  type GameStateView,
  type SleeveStats,
  earnedSpeedBeyond,
  coolsNow as heatCoolsNow,
  cycleMs as heatCycleMs,
  cycleSeconds as heatCycleSeconds,
  heatStopPoint,
  heatTaxShare,
  ownsAutoRun,
} from '../../core';
import { formatBigNum, formatPlain, formatSignificant, numberFactory } from '../../numbers';
import type { UiText } from '../uiText';
import { isCorporate, isPointCurrency, sectionLayout } from './buyableViews';
import { aggregatedMoleText } from './moleBonus';
import type { RevealTracker } from './revealTracker';
import { sleeveGroups, sleeveHeatGauge } from './sleeveGroups';
import { iceBonusSource, nextUnlock } from './sleeveTipSources';
import { heatOrIceMoved, isStatHidden } from './statReveal';
import { MULTIPLIER_DECIMALS, PANEL_DIGITS, PROFICIENCY_DECIMALS, SPEED_DECIMALS, buildStatRow as row, namedTerms } from './viewFormat';
import type { BuyableView, SleeveView, StatRowView } from './viewTypes';

/**
 * The sleeve stat rows, in configuration order (`sleeveGroups` puts them in group order). Panel values keep {@link PANEL_DIGITS}
 * significant figures; the tooltips keep full precision.
 *
 * Called by: {@link sleeveView}. Calls: `isStatHidden`, the heat model, `formatSignificant`.
 *
 * @param stopPoint the heat at which the tax takes every credit (`heatStopPoint`), shared with the heat gauge
 */
function sleeveRows(
  stats: SleeveStats,
  state: GameStateView,
  config: GameConfig,
  text: UiText,
  stopPoint: number | null,
  tracker?: RevealTracker,
): StatRowView[] {
  const ownedCount = (id: string): number => state.sleeve.purchased[id] ?? 0;
  const { sleeve } = config;
  const reveal = {
    config,
    accessLevel: stats.accessLevel,
    owned: ownedCount,
    ownsAuto: (id: string): boolean => ownsAutoRun(config.buyables, state, id),
    ...(tracker ? { tracker } : {}),
  };
  // heat and ICE Rating appear together, so either having moved keeps both on show
  const heatOrIceShown = heatOrIceMoved(stats, config);
  const capped = stats.heatTaxCap < 1; // Blackout: the tax stops short of taking everything, so node credits never stop
  const stopsAt = stopPoint === null ? null : text.format.heatPoints(formatPlain(stopPoint));
  const cycleMs = heatCycleMs(sleeve, stats.legend);
  const orders = Math.max(0, stats.iceRating.log10());
  const beyond = earnedSpeedBeyond(sleeve);
  const curve = {
    scale: sleeve.earnedSpeedScale,
    exponent: sleeve.earnedSpeedExponent,
    // a second shape is only worth a line in the tip while it differs from the first
    ...(beyond && beyond.exponent !== sleeve.earnedSpeedExponent ? { beyond } : {}),
  };
  const proficiency = state.sleeve.hackingProficiency.mul(numberFactory.fromNumber(stats.hackingProficiencyFactor));
  const cycleSeconds = heatCycleSeconds(sleeve, stats.legend, stats.heatCooldownSpeed);
  const coolsNow = heatCoolsNow(stats.heat, stats.heatCooldownAmount);
  const panel = (n: number): string => formatSignificant(n, PANEL_DIGITS);
  const heatTip = (): string =>
    text.tips.heat({
      heat: formatPlain(stats.heat),
      perPointPercent: formatPlain(sleeve.heatTaxPerPoint * 100),
      reductionPercent: formatPlain(stats.heatReduction * 100),
      taxPercent: formatPlain(
        heatTaxShare(stats.heat, stats.heatReduction, sleeve.heatTaxPerPoint, stats.heatTaxCap, stats.heatTaxScale) * 100,
      ),
      stopsAt,
      taxCapPercent: capped ? formatPlain(stats.heatTaxCap * 100) : null,
      taxScale: stats.heatTaxScale === 1 ? null : formatPlain(stats.heatTaxScale, 4),
      amount: formatPlain(stats.heatCooldownAmount),
      cycleSeconds: formatPlain(cycleSeconds),
      moles:
        state.sleeve.moles > 0
          ? {
              moles: formatPlain(state.sleeve.moles),
              boostPercent: formatPlain(stats.heatCooldownBoost * 100),
              aggregatedPercent: aggregatedMoleText(stats.moleAggregation, state.sleeve.moles),
            }
          : null,
    });
  return [
    row('access', text, String(stats.accessLevel), () =>
      text.tips.access({
        start: String(sleeve.baseAccessLevel),
        purchases: String(stats.accessLevel - sleeve.baseAccessLevel),
        level: String(stats.accessLevel),
        next: nextUnlock(config, stats.accessLevel),
      }),
    ),
    row('interfaceSpeed', text, panel(stats.interfaceSpeed), () =>
      text.tips.interfaceSpeed({
        base: formatPlain(sleeve.baseInterfaceSpeed),
        boosts: formatPlain(stats.interfaceBoosts),
        networkFactor: stats.interfaceNetworkFactor === 1 ? null : formatPlain(stats.interfaceNetworkFactor),
        nodes: formatBigNum(state.sleeve.network),
        hackingMultiplier: formatPlain(stats.hackingMultiplier, MULTIPLIER_DECIMALS),
        curve,
        skillFactor: stats.interfaceSkillFactor === 1 ? null : formatPlain(stats.interfaceSkillFactor, MULTIPLIER_DECIMALS),
        total: formatPlain(stats.interfaceSpeed, SPEED_DECIMALS),
      }),
    ),
    row(
      'hackingProficiency',
      text,
      proficiency.lt(numberFactory.fromNumber(1000)) ? panel(proficiency.toNumber()) : formatBigNum(proficiency),
      () =>
        text.tips.hackingProficiency({
          proficiency: formatBigNum(proficiency, PROFICIENCY_DECIMALS),
          hackingMultiplier: formatPlain(stats.hackingMultiplier, MULTIPLIER_DECIMALS),
          curve,
        }),
    ),
    row(
      'iceRating',
      text,
      formatBigNum(stats.iceRating),
      () =>
        text.tips.iceRating({
          earned: formatBigNum(stats.iceRatingEarned),
          levelBonus: stats.iceRatingBonus.gt(numberFactory.fromNumber(0)) ? formatBigNum(stats.iceRatingBonus) : null,
          levelBonusSource: iceBonusSource(config, ownedCount),
          multipliers: namedTerms(stats.iceRatingTerms, config, ownedCount, (f) => formatPlain(f)),
          total: formatBigNum(stats.iceRating),
          orders: formatPlain(orders),
          ordersForFull: formatPlain(sleeve.iceRatingOrdersForFullReduction),
          exponent: formatPlain(sleeve.iceRatingReductionExponent),
          reductionPercent: formatPlain(stats.heatReduction * 100),
          fullAt: text.format.powerOfTen(formatPlain(sleeve.iceRatingOrdersForFullReduction)),
        }),
      null,
      isStatHidden('iceRating', reveal, heatOrIceShown),
    ),
    row(
      'heat',
      text,
      panel(stats.heat),
      heatTip,
      {
        // while it cools, the bar says by how much and how often; otherwise why it waits
        label: coolsNow ? text.mainScreen.cooldown(panel(stats.heatCooldownAmount), panel(cycleSeconds)) : text.bars.heat(false),
        percent: Math.min(100, (state.sleeve.heatCooldownMs / cycleMs) * 100),
        running: coolsNow,
        hidden: false,
      },
      isStatHidden('heat', reveal, heatOrIceShown),
    ),
    row(
      'legend',
      text,
      panel(stats.legend),
      () =>
        text.tips.legend({
          legend: formatPlain(stats.legend),
          baseSeconds: formatPlain(sleeve.heatCooldownMs / 1000),
          speedupPercent: formatPlain(sleeve.legendHeatSpeedup * 100),
          cycleSeconds: formatPlain(cycleMs / 1000),
          decayMinutes: formatPlain(sleeve.legendDecayPeriodMs / 60_000),
        }),
      {
        label: text.bars.legend,
        percent: Math.min(100, (state.sleeve.legendCooldownMs / sleeve.legendDecayPeriodMs) * 100),
        running: stats.legend > 0,
        hidden: !(stats.legend > 0), // nothing decays without Legend
      },
      isStatHidden('legend', reveal, stats.legend > 0),
    ),
    row(
      'criticalChance',
      text,
      `${panel(stats.criticalChance * 100)}%`,
      () =>
        text.tips.critical({
          chancePercent: formatPlain(stats.criticalChance * 100),
          xpMultiplier: formatPlain(config.criticalSuccess.xpMultiplier),
          rewardMultiplier: formatPlain(config.criticalSuccess.rewardMultiplier),
        }),
      null,
      !(stats.criticalChance > 0), // the row appears with the first Critical success purchase
    ),
  ];
}

/**
 * The Sleeve widget.
 *
 * Called by: {@link buildViewModel}. Calls: {@link sleeveRows}, {@link sleeveGroups}, {@link sleeveHeatGauge}, {@link sectionLayout}.
 *
 * @param stats the sleeve's derived stats
 * @param state the game state
 * @param config game configuration
 * @param buyableViews the view of every buyable
 * @param viewById the same views by id
 * @param text the display text
 * @param tracker the reveal ledger reader (default: none, the stat rules decide alone)
 */
export function sleeveView(
  stats: SleeveStats,
  state: GameStateView,
  config: GameConfig,
  buyableViews: readonly BuyableView[],
  viewById: ReadonlyMap<string, BuyableView>,
  text: UiText,
  tracker?: RevealTracker,
): SleeveView {
  const stopPoint = heatStopPoint(stats.heatReduction, config.sleeve.heatTaxPerPoint, stats.heatTaxCap, stats.heatTaxScale);
  const { groups, stats: rows } = sleeveGroups(sleeveRows(stats, state, config, text, stopPoint, tracker), text);
  const heatHidden = rows.find((r) => r.id === 'heat')?.hidden ?? true;
  return {
    title: text.titles.sleeve,
    status: text.mainScreen.online,
    stats: rows,
    groups,
    heatGauge: sleeveHeatGauge(stats, stopPoint, heatHidden, text),
    resleeveTitle: text.mainScreen.resleeveTitle,
    buyables: buyableViews.filter(
      (b) =>
        b.actionId === undefined &&
        !isPointCurrency(config.buyables.find((d) => d.id === b.id)?.currency) &&
        !isCorporate(config, b.id) &&
        b.id !== resleeveGateId(config.buyables),
    ),
    sections: sectionLayout(config).map((section) => ({
      id: section.id,
      title: text.sections[section.id],
      buyables: section.ids.flatMap((id) => viewById.get(id) ?? []),
    })),
  };
}
