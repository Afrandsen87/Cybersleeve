/**
 * @module ui
 *
 * The parts of the two XP bar tips of an action card, taken from the owners of the values.
 *
 * @remarks
 * Called by: `actionView.ts` (as getters, so the work is done only for the tip under the pointer). Calls: `GameQueries` (`xpPerRunBreakdown`,
 * `actionXpCurve`, `sleeveXpCurve`, `actionXpForLevel`, `sleeveXpForLevel`, `sleeveXpGrant`, `runsPerSleeveXp`, `actionLevel`, `sleeveLevel`),
 * the text table. Nothing is recomputed here: a figure the tip shows is the owner's.
 */
import type { ActionQueries, LevelQueries, XpCurve } from '../../core';
import { type BigNum, formatBigNum, formatPlain } from '../../numbers';
import type { LevelXpTipParts, SleeveXpTipParts, UiText, XpCurveParts, XpFactorPart } from '../uiText';
import { AUGMENT_XP_DECIMALS } from './viewFormat';

/** Decimals of a percentage written in an XP tip. */
const PERCENT_DECIMALS = 2;

/** The cost-of-a-level part: the curve's numbers, with delay and reduction only when they matter. */
function curveParts(curve: XpCurve, level: number, next: BigNum): XpCurveParts {
  return {
    level,
    firstLevel: formatBigNum(curve.firstLevelXp),
    growth: formatPlain(curve.growthFactor, AUGMENT_XP_DECIMALS),
    delay: curve.delay > 0 ? formatPlain(curve.delay) : null,
    reductionPercent: curve.reduction > 0 ? formatPlain(curve.reduction * 100, PERCENT_DECIMALS) : null,
    next: formatBigNum(next),
  };
}

/**
 * The parts of the tip of an action's level XP bar.
 *
 * Called by: `buildActionViews` (inside a getter). Calls: `xpPerRunBreakdown`, `actionXpCurve`, `actionXpForLevel`, `actionLevel`.
 *
 * @param engine the questions about actions and levels
 * @param actionId the action
 * @param text the display text (names the factors)
 */
export function levelXpTipParts(engine: ActionQueries & LevelQueries, actionId: string, text: UiText): LevelXpTipParts {
  const b = engine.xpPerRunBreakdown(actionId);
  const names = text.action.xpFactors;
  const factors: XpFactorPart[] = [
    { name: names.lever, factor: b.lever },
    { name: names.augments, factor: b.augmentFactor },
    { name: names.mirror, factor: b.mirrorFactor },
  ]
    .filter((f) => f.factor !== 1)
    .map((f) => ({ name: f.name, value: formatPlain(f.factor, AUGMENT_XP_DECIMALS) }));
  return {
    base: formatBigNum(b.base, AUGMENT_XP_DECIMALS),
    factors,
    xpPerRun: formatBigNum(b.total, AUGMENT_XP_DECIMALS),
    criticalMultiplier: b.criticalXpMultiplier === null ? null : formatPlain(b.criticalXpMultiplier),
    curve: curveParts(engine.actionXpCurve(actionId), engine.actionLevel(actionId), engine.actionXpForLevel(actionId)),
  };
}

/**
 * The parts of the tip of an action's sleeve XP bar.
 *
 * Called by: `buildActionViews` (inside a getter). Calls: `runsPerSleeveXp`, `sleeveXpGrant`, `sleeveXpCurve`, `sleeveXpForLevel`, `sleeveLevel`.
 *
 * @param engine the questions about levels
 * @param actionId the action
 */
export function sleeveXpTipParts(engine: LevelQueries, actionId: string): SleeveXpTipParts {
  return {
    runsPerGrant: formatPlain(engine.runsPerSleeveXp()),
    xpPerGrant: formatBigNum(engine.sleeveXpGrant()),
    curve: curveParts(engine.sleeveXpCurve(actionId), engine.sleeveLevel(actionId), engine.sleeveXpForLevel(actionId)),
  };
}
