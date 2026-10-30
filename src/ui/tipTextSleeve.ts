/**
 * @module ui
 *
 * The wording of the Sleeve panel tips (access, interface speed, hacking, heat, ICE Rating, Legend, Moles).
 *
 * @remarks
 * Part of the hover texts: `tipText.ts` merges the three tables into the one `uiText.ts` holds as `tips`. Entries receive already-formatted strings from the view model.
 */
import type { HackingCurve } from './uiTextParts';
import { formatPlain } from '../numbers';
import type { TipTexts } from './tipTextTypes';

/** The hacking multiplier written out for a curve: `1 + scale x ((1 + Hacking Proficiency)^exponent - 1) / exponent`. */
function hackingMultiplierFormula(curve: HackingCurve): string {
  const scale = formatPlain(curve.scale);
  const exponent = formatPlain(curve.exponent);
  if (curve.exponent === 1) return `1 + ${scale} x Hacking Proficiency`;
  if (curve.exponent === 0) return `1 + ${scale} x ln(1 + Hacking Proficiency)`;
  return `1 + ${scale} x ((1 + Hacking Proficiency)^${exponent} - 1) / ${exponent}`;
}

/** A line that says where the Hacking Multiplier curve changes shape, or nothing while it is one curve. */
function hackingCurveBeyondLines(curve: HackingCurve): string[] {
  if (!curve.beyond) return [];
  const { knee, exponent } = curve.beyond;
  const effect = exponent < curve.exponent ? 'each further point adds even less' : 'each further point adds more';
  return [`Past ${formatPlain(knee)} Hacking Proficiency the exponent is ${formatPlain(exponent)}: ${effect}`];
}

/** The sleeve hover texts. */
export const sleeveTips: Pick<TipTexts, 'access' | 'interfaceSpeed' | 'hackingProficiency' | 'heat' | 'iceRating' | 'legend' | 'moles'> = {
  // Every calculation tip has the same layout: the formulas, a blank line, the variables, a blank line, the result.
  // The blank lines are intentional. The text says what things do.
  access: ({ start, purchases, level, next }) =>
    [
      'Access Level = Start Level + Purchases',
      '',
      `Start Level = ${start}`,
      `Purchases = ${purchases}`,
      '',
      `Access Level = ${level}`,
      ...(next === null ? [] : ['', `Next unlock: ${next.name} at Access Level ${next.level}`]),
    ].join('\n'),
  interfaceSpeed: ({ base, boosts, networkFactor, nodes, hackingMultiplier, curve, skillFactor, total }) =>
    [
      `Interface Speed = (base + boost) x ${networkFactor === null ? '' : 'Node Bonus x '}Hacking Multiplier${skillFactor === null ? '' : ' x Skills'}`,
      `Hacking Multiplier = ${hackingMultiplierFormula(curve)}`,
      ...hackingCurveBeyondLines(curve),
      '',
      `Base = ${base}`,
      `Boosts = ${boosts}`,
      ...(networkFactor === null ? [] : [`Node Bonus = ${networkFactor} (1 + ln(nodes) / 100, with ${nodes} nodes)`]),
      `Hacking Multiplier = ${hackingMultiplier}`,
      ...(skillFactor === null ? [] : [`Skills = ${skillFactor}`]),
      '',
      `Interface Speed = ${total}`,
    ].join('\n'),
  hackingProficiency: ({ proficiency, hackingMultiplier, curve }) =>
    [
      `Hacking Multiplier = ${hackingMultiplierFormula(curve)}`,
      ...hackingCurveBeyondLines(curve),
      'Interface Speed = (base + boost) x Hacking Multiplier',
      '',
      `Hacking Proficiency = ${proficiency}${curve.exponent < 1 ? ' (each further point adds less)' : ''}`,
      '',
      `Hacking Multiplier = ${hackingMultiplier}`,
    ].join('\n'),
  heat: ({ heat, perPointPercent, reductionPercent, taxPercent, stopsAt, taxCapPercent, amount, cycleSeconds, moles }) =>
    [
      'Heat Tax = Heat x Tax per Point x (1 - Heat Reduction)',
      '',
      `Heat = ${heat}`,
      `Tax per Point = ${perPointPercent}%`,
      `Heat Reduction = ${reductionPercent}% (from ICE Rating)`,
      '',
      `Heat Tax = ${taxPercent}% of all credits earned from nodes`,
      ...(taxCapPercent === null ? [] : [`The Heat Tax takes at most ${taxCapPercent}%`]),
      ...(stopsAt === null ? [] : [`Node credits stop at ${stopsAt}`]),
      `Heat falls by ${amount} every ${cycleSeconds}s, once at least ${amount} heat is held`,
      ...(moles === null
        ? []
        : [
            moles.aggregatedPercent === null
              ? `${moles.moles} Moles make it ${moles.boostPercent}% faster`
              : `${moles.moles} Moles make it ${moles.aggregatedPercent}% faster`,
          ]),
    ].join('\n'),
  iceRating: ({ earned, levelBonus, levelBonusSource, multipliers, total, orders, perOrderPercent, reductionPercent, fullAt }) =>
    [
      `ICE Rating = ${levelBonus === null ? 'Earned' : `(Earned + ${levelBonusSource})`}${multipliers.map((t) => ` x ${t.label}`).join('')}`,
      '',
      `Earned = ${earned}`,
      ...(levelBonus === null ? [] : [`${levelBonusSource} = ${levelBonus}`]),
      ...multipliers.map((t) => `${t.label} = x${t.value}`),
      `ICE Rating = ${total}`,
      '',
      'Heat Reduction = Orders of Magnitude ICE Rating x Reduction per Order',
      '',
      `Orders of Magnitude ICE Rating = ${orders}`,
      `Reduction per Order = ${perOrderPercent}%`,
      '',
      `Heat Reduction = ${reductionPercent}%`,
      ...(fullAt === null ? [] : [`Reaches 100% at ${fullAt}`]),
    ].join('\n'),
  legend: ({ legend, baseSeconds, speedupPercent, cycleSeconds, decayMinutes }) =>
    [
      'Heat Cooldown Time = Base Time / (1 + Speedup per Legend x Legend)',
      '',
      `Base Time = ${baseSeconds}s`,
      `Speedup per Legend = ${speedupPercent}%`,
      `Legend = ${legend}`,
      '',
      `Heat Cooldown Time = ${cycleSeconds}s`,
      `Legend falls by 1 every ${decayMinutes} min`,
    ].join('\n'),
  moles: ({ moles, boostPercent, aggregatedPercent }) =>
    (aggregatedPercent === null
      ? [
          'Heat Cooldown Speed = Normal Speed x (1 + Mole Boost) while Moles remain',
          'Each point of heat cooled uses one Mole',
          '',
          `Mole Boost = ${boostPercent}%`,
          '',
          `Moles = ${moles}`,
        ]
      : [
          'Heat Cooldown Speed = Normal Speed x (1 + Bonus per Order) ^ log10(Moles)',
          'Moles stay with you',
          '',
          `Moles = ${moles}`,
          `Heat cools ${aggregatedPercent}% faster`,
        ]
    ).join('\n'),
};
