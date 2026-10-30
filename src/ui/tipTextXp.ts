/**
 * @module ui
 *
 * The wording of the two XP bar tips: how much XP a run gives and how the cost of a level grows.
 *
 * @remarks
 * Part of the hover texts: `tipText.ts` merges the tables into the one `uiText.ts` holds as `tips`. Entries receive already-formatted
 * strings from `ui/view/xpTipView.ts`; a line appears only when its factor is not 1 (see `docs/REVEAL_RULES.md`).
 */
import type { XpCurveParts } from './parts/xpTipParts';
import type { TipTexts } from './tipTextTypes';

/** The cost-of-a-level lines shared by both bars: the formula, its variables (only those that matter) and the result. */
function curveLines(curve: XpCurveParts, delayed: boolean): string[] {
  const power = delayed ? `Growth ^ (Level - Delay)` : 'Growth ^ Level';
  return [
    `XP for a Level = First Level x ${power}${curve.reductionPercent === null ? '' : ' x (1 - Reduction)'}`,
    '',
    `Level = ${curve.level}`,
    `First Level = ${curve.firstLevel}`,
    `Growth = ${curve.growth}`,
    ...(curve.delay === null ? [] : [`Delay = ${curve.delay} (levels the growth is held back by Skill shards)`]),
    ...(curve.reductionPercent === null ? [] : [`Reduction = ${curve.reductionPercent}%`]),
    '',
    `XP for the next Level = ${curve.next}`,
  ];
}

/** The XP bar hover texts. */
export const xpTips: Pick<TipTexts, 'levelXp' | 'sleeveXp'> = {
  levelXp: ({ base, factors, xpPerRun, criticalMultiplier, curve }) =>
    [
      factors.length === 0 ? 'XP per Run = Base XP' : `XP per Run = Base XP x ${factors.map((f) => f.name).join(' x ')}`,
      '',
      `Base XP = ${base}`,
      ...factors.map((f) => `${f.name} = ${f.value}`),
      '',
      `XP per Run = ${[base, ...factors.map((f) => f.value)].join(' x ')} = ${xpPerRun}`,
      ...(criticalMultiplier === null ? [] : [`A critical success gives ${criticalMultiplier}x XP`]),
      '',
      ...curveLines(curve, curve.delay !== null),
    ].join('\n'),
  sleeveXp: ({ runsPerGrant, xpPerGrant, curve }) =>
    [`Every ${runsPerGrant} completed runs of this action give ${xpPerGrant} Sleeve XP`, '', ...curveLines(curve, false)].join('\n'),
};
