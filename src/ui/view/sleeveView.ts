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
  sleeveLevelsGateId,
  type ActionDefinition,
  type GameConfig,
  type GameStateView,
  type SleeveStats,
  earnedSpeedBeyond,
  coolsNow as heatCoolsNow,
  cycleMs as heatCycleMs,
  heatStopPoint,
  heatTaxShare,
} from '../../core';
import { formatBigNum, formatPlain, numberFactory } from '../../numbers';
import type { UiText } from '../uiText';
import { isCorporate, isPointCurrency, sectionLayout } from './buyableViews';
import { aggregatedMoleText } from './moleBonus';
import { heatOrIceMoved, isStatHidden } from './statReveal';
import { MULTIPLIER_DECIMALS, PROFICIENCY_DECIMALS, SPEED_DECIMALS, buildStatRow as row, namedTerms } from './viewFormat';
import type { BuyableView, SleeveView, StatRowView } from './viewTypes';

/**
 * The next action that opens at a higher access level than the sleeve has: the lowest level above it, the first such action
 * in the configuration order.
 *
 * Called by: {@link sleeveRows}.
 *
 * @param config game configuration (reads the actions and their `requiredAccessLevel`)
 * @param accessLevel the sleeve's access level now
 * @returns its name and required level, or `null` when every action is open
 */
function nextUnlock(config: GameConfig, accessLevel: number): { name: string; level: string } | null {
  let next: ActionDefinition | null = null;
  for (const a of config.actions) {
    const level = a.requiredAccessLevel ?? 1;
    if (level > accessLevel && (next === null || level < (next.requiredAccessLevel ?? 1))) next = a;
  }
  return next === null ? null : { name: next.name, level: String(next.requiredAccessLevel ?? 1) };
}

/**
 * The names of the owned purchases that add base ICE Rating per action level, joined with " + ".
 *
 * Called by: {@link sleeveRows}.
 *
 * @param config game configuration (reads the buyables)
 * @param ownedCount copies owned of a buyable id
 * @returns the names, or a generic label when none is owned
 */
function iceBonusSource(config: GameConfig, ownedCount: (id: string) => number): string {
  const names = config.buyables.filter((b) => b.effect.kind === 'iceRatingFromActionLevel' && ownedCount(b.id) > 0).map((b) => b.name);
  return names.length > 0 ? names.join(' + ') : 'Purchase Bonus';
}

/** The sleeve stat rows. */
function sleeveRows(stats: SleeveStats, state: GameStateView, config: GameConfig, text: UiText): StatRowView[] {
  const ownedCount = (id: string): number => state.purchased[id] ?? 0;
  const { sleeve } = config;
  const reveal = { config, accessLevel: stats.accessLevel, owned: ownedCount };
  // heat and ICE Rating appear together, so either having moved keeps both on show
  const heatOrIceShown = heatOrIceMoved(stats, config);
  const capped = stats.heatTaxCap < 1; // Blackout: the tax stops short of taking everything, so node credits never stop
  const stopPoint = heatStopPoint(stats.heatReduction, sleeve.heatTaxPerPoint, stats.heatTaxCap);
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
  const proficiency = state.hackingProficiency.mul(numberFactory.fromNumber(stats.hackingProficiencyFactor));
  const cooldownSpeed = stats.heatCooldownSpeed;
  const coolsNow = heatCoolsNow(stats.heat, stats.heatCooldownAmount);
  const heatTip = (): string =>
    text.tips.heat({
      heat: formatPlain(stats.heat),
      perPointPercent: formatPlain(sleeve.heatTaxPerPoint * 100),
      reductionPercent: formatPlain(stats.heatReduction * 100),
      taxPercent: formatPlain(heatTaxShare(stats.heat, stats.heatReduction, sleeve.heatTaxPerPoint, stats.heatTaxCap) * 100),
      stopsAt,
      taxCapPercent: capped ? formatPlain(stats.heatTaxCap * 100) : null,
      amount: formatPlain(stats.heatCooldownAmount),
      cycleSeconds: formatPlain(cycleMs / cooldownSpeed / 1000),
      moles:
        state.moles > 0
          ? {
              moles: formatPlain(state.moles),
              boostPercent: formatPlain(stats.heatCooldownBoost * 100),
              aggregatedPercent: aggregatedMoleText(stats.moleAggregation, state.moles),
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
    row('interfaceSpeed', text, formatPlain(stats.interfaceSpeed), () =>
      text.tips.interfaceSpeed({
        base: formatPlain(sleeve.baseInterfaceSpeed),
        boosts: formatPlain(stats.interfaceBoosts),
        networkFactor: stats.interfaceNetworkFactor === 1 ? null : formatPlain(stats.interfaceNetworkFactor),
        nodes: formatBigNum(state.network),
        hackingMultiplier: formatPlain(stats.hackingMultiplier, MULTIPLIER_DECIMALS),
        curve,
        skillFactor: stats.interfaceSkillFactor === 1 ? null : formatPlain(stats.interfaceSkillFactor, MULTIPLIER_DECIMALS),
        total: formatPlain(stats.interfaceSpeed, SPEED_DECIMALS),
      }),
    ),
    row('hackingProficiency', text, formatBigNum(proficiency, PROFICIENCY_DECIMALS), () =>
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
          perOrderPercent: formatPlain(sleeve.iceRatingReductionPerOrder * 100),
          reductionPercent: formatPlain(stats.heatReduction * 100),
          fullAt: sleeve.iceRatingReductionPerOrder > 0 ? text.format.powerOfTen(formatPlain(1 / sleeve.iceRatingReductionPerOrder)) : null,
        }),
      null,
      isStatHidden('iceRating', reveal, heatOrIceShown),
    ),
    row(
      'heat',
      text,
      String(Number(stats.heat.toFixed(4))),
      heatTip,
      {
        label: text.bars.heat(coolsNow),
        percent: Math.min(100, (state.heatCooldownMs / cycleMs) * 100),
        running: coolsNow,
      },
      isStatHidden('heat', reveal, heatOrIceShown),
    ),
    row(
      'legend',
      text,
      formatPlain(stats.legend),
      () =>
        text.tips.legend({
          legend: formatPlain(stats.legend),
          baseSeconds: formatPlain(sleeve.heatCooldownMs / 1000),
          speedupPercent: formatPlain(sleeve.legendHeatSpeedup * 100),
          cycleSeconds: formatPlain(cycleMs / 1000),
          decayMinutes: formatPlain(sleeve.legendDecayPeriodMs / 60_000),
        }),
      {
        label: text.bars.legend(stats.legend > 0),
        percent: Math.min(100, (state.legendCooldownMs / sleeve.legendDecayPeriodMs) * 100),
        running: stats.legend > 0,
      },
      isStatHidden('legend', reveal, stats.legend > 0),
    ),
    row(
      'criticalChance',
      text,
      `${formatPlain(stats.criticalChance * 100)}%`,
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
 * Called by: {@link buildViewModel}. Calls: {@link sleeveRows}, {@link sectionLayout}.
 *
 * @param stats the sleeve's derived stats
 * @param state the game state
 * @param config game configuration
 * @param buyableViews the view of every buyable
 * @param viewById the same views by id
 * @param text the display text
 */
export function sleeveView(
  stats: SleeveStats,
  state: GameStateView,
  config: GameConfig,
  buyableViews: readonly BuyableView[],
  viewById: ReadonlyMap<string, BuyableView>,
  text: UiText,
): SleeveView {
  return {
    title: text.titles.sleeve,
    stats: sleeveRows(stats, state, config, text),
    buyables: buyableViews.filter(
      (b) =>
        b.actionId === undefined &&
        !isPointCurrency(config.buyables.find((d) => d.id === b.id)?.currency) &&
        !isCorporate(config, b.id) &&
        b.id !== sleeveLevelsGateId(config.buyables),
    ),
    sections: sectionLayout(config).map((section) => ({
      id: section.id,
      title: text.sections[section.id],
      buyables: section.ids.flatMap((id) => viewById.get(id) ?? []),
    })),
  };
}
