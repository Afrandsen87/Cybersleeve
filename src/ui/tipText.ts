/**
 * @module ui
 *
 * The wording of every hover text: calculation tips (formulas, variables, result), item tips and purchase tips.
 *
 * @remarks
 * Part of the text table: `uiText.ts` holds it as `tips`. Entries receive already-formatted strings from the view model.
 */
import type { LevelScaling } from '../core';
import { formatPlain } from '../numbers';
import type { UiText } from './uiText';
import type { DropChanceParts, HackingCurve } from './uiTextParts';

/** The drop chance lines of an item tooltip: one per action that can drop the stack, or 0% while none can. */
function dropChanceLines(drops: readonly DropChanceParts[]): string[] {
  return drops.length === 0 ? ['Drop Chance = 0%'] : drops.map((d) => `Drop Chance = ${d.percent}% per ${d.action} run`);
}

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

/** The hover texts of the interface. */
export const tipText: UiText['tips'] = {
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
  actionSpeed: ({
    speed,
    actionLevel,
    levelBonus,
    actionFactor,
    actionScaling,
    sleeveShown,
    sleeveLevel,
    sleeveFactor,
    sleeveScaling,
    interfaceFactor,
    globalFactor,
    overclockFactor,
    focusFactor,
    baseDuration,
    duration,
  }) => {
    const perLevel = (s: LevelScaling): string =>
      s.kind === 'linear' ? `+${formatPlain(s.perLevel * 100)}% per level` : `x${formatPlain(s.base)} per level`;
    return [
      `Action Speed = Action Level${sleeveShown ? ' x Sleeve Level' : ''} x Interface Speed${globalFactor === null ? '' : ' x Global Speed'}${overclockFactor === null ? '' : ' x Overclock'}${focusFactor === null ? '' : ' x Focus'}`,
      'Run Time = Base Time / Action Speed',
      '',
      `Action Level = ${actionFactor} (level ${actionLevel}${levelBonus > 0 ? ` + ${levelBonus} from purchases` : ''}, ${perLevel(actionScaling)})`,
      ...(sleeveShown ? [`Sleeve Level = ${sleeveFactor} (level ${sleeveLevel}, ${perLevel(sleeveScaling)})`] : []),
      `Interface Speed = ${interfaceFactor}`,
      ...(globalFactor === null ? [] : [`Global Speed = ${globalFactor}`]),
      ...(overclockFactor === null ? [] : [`Overclock = ${overclockFactor}`]),
      ...(focusFactor === null ? [] : [`Focus = ${focusFactor}`]),
      '',
      `Action Speed = ${speed}`,
      `Run Time = ${duration} (${baseDuration} / ${speed})`,
    ].join('\n');
  },
  payout: ({ base, creditLever, purchases, actionBonus, perNode }) =>
    [
      `Payout per Node = (Base + Action Bonus)${[...(creditLever === null ? [] : ['Credit Lever']), ...purchases.map((t) => t.label)].map((f) => ` x ${f}`).join('')}`,
      '',
      `Base = ${base} credits/s`,
      ...(creditLever === null ? [] : [`Credit Lever = ${creditLever}`]),
      ...purchases.map((t) => `${t.label} = x${t.value}`),
      `Action Bonus = ${actionBonus} credits/s`,
      '',
      `Payout per Node = ${perNode} credits/s`,
    ].join('\n'),
  income: ({ nodes, perNode, keepPercent, gross, total }) =>
    [
      `Credits per Second = Nodes x Payout per Node${keepPercent === null ? '' : ' x Heat Tax Kept'}`,
      '',
      `Nodes = ${nodes}`,
      `Payout per Node = ${perNode} credits/s`,
      ...(keepPercent === null ? [] : [`Heat Tax Kept = ${keepPercent}%`]),
      '',
      ...(keepPercent === null ? [] : [`Before the Heat Tax = ${gross} credits/s`]),
      `Credits per Second = ${total}`,
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
      'Heat Reduction = Orders of Magnitude x Reduction per Order',
      '',
      `Orders of Magnitude = ${orders}`,
      `Reduction per Order = ${perOrderPercent}%`,
      '',
      `Heat Reduction = ${reductionPercent}%`,
      ...(fullAt === null ? [] : [`Reaches 100% at ${fullAt}`]),
    ].join('\n'),
  critical: ({ chancePercent, xpMultiplier, rewardMultiplier }) =>
    [
      `Chance per completed run = ${chancePercent}%`,
      '',
      `Each critical success gives ${xpMultiplier}x action XP and pays ${rewardMultiplier}x the reward`,
      'Above 100% a run can have several critical successes: 150% is one for sure and a 50% chance of a second',
      'Some actions may have other effects as well',
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
  buyable: ({ name, description, formula, values, cost, costUnit, owned, repeatable, maxed, toggleable, enabled }) => {
    // The name, what the purchase does and its formula; then the current numbers; then what the player can do with it.
    const about = [...(description ? [description] : []), ...(formula ? [formula] : [])];
    const numbers = values === null ? [] : ['', ...values.variables, '', values.result];
    if (toggleable && owned > 0) {
      return [`${name} (${enabled ? 'on' : 'off'})`, ...about, ...numbers, '', `Click to switch ${enabled ? 'off' : 'on'}`].join('\n');
    }
    if (maxed) return [name, ...about, ...numbers, '', 'Owned'].join('\n');
    return [name, ...about, ...numbers, '', `Cost = ${cost} ${costUnit}`, ...(repeatable ? [`Owned = ${owned}`] : [])].join('\n');
  },
  stack: ({ label, sellValue, count, total, unit, drops }) =>
    [
      label,
      `Used as blackmail: pays flat ${sellValue} ${unit} each`,
      'Click to select it, then press Sell or Sell all',
      '',
      ...dropChanceLines(drops),
      `Owned = ${count}`,
      `Payment = ${total} ${unit}`,
    ].join('\n'),
  augment: ({ xpPerRun, baseXp, bonus, bonusPercent, applied, held, selected, item }) =>
    [
      'XP per Run = Base XP x Boost of each Rarity',
      'Boost of a Rarity = 1 + Bonus per Augment x Augments of that Rarity',
      '',
      `Bonus per Augment = ${bonusPercent}%`,
      ...(applied.length === 0 ? ['Augments = 0'] : applied.map((a) => `${a.rarity} Augments = ${a.count}`)),
      '',
      // The whole calculation with the numbers in: the base XP, then the boost of each rarity that has augments, and the result.
      `XP per Run = ${[baseXp, ...applied.map((a) => `(1 + ${bonus} x ${a.count})`)].join(' x ')} = ${xpPerRun}`,
      '',
      selected === null ? `Select a rarity of ${item} in the Inventory first` : `Selected = ${selected} (${held} held)`,
      'Click to apply one of the selected rarity to this action: its action levels come sooner',
    ].join('\n'),
  overclock: ({ on, strength, speed, reward, heatPerMinute, heatPerRunFactor, heatChanceFactor, nodesLost, alsoPays, holdsHeat, chain }) =>
    [
      `Overclock (${on ? 'on' : 'off'})`,
      ...(speed === null ? [] : ['Action Speed = Action Speed x (1 + Speed Bonus)']),
      ...(reward === null ? [] : ['Reward per Run = Reward per Run x (1 + Reward Bonus)']),
      ...(speed === null && reward === null ? [] : ['Bonus = Action Bonus x Strength', '']),
      ...(speed === null && reward === null ? [] : [`Strength = ${strength} (each extra copy of Overclock adds to it)`]),
      ...(speed === null ? [] : [`Speed Bonus = ${speed.percent}% (${speed.basePercent}% x Strength)`]),
      ...(reward === null ? [] : [`Reward Bonus = ${reward.percent}% (${reward.basePercent}% x Strength)`]),
      ...(alsoPays === null ? [] : [`Each completed run also pays the nodes of one ${alsoPays} run`]),
      ...(speed === null && reward === null && alsoPays === null ? [] : ['']),
      ...(heatPerMinute === null ? [] : [`Costs ${heatPerMinute} heat per minute while this action runs`]),
      ...(heatPerRunFactor === null ? [] : [`Each run makes ${heatPerRunFactor}x as much heat`]),
      ...(heatChanceFactor === null ? [] : [`Each run is ${heatChanceFactor}x as likely to make heat`]),
      ...(nodesLost === null ? [] : [`Each completed run costs ${nodesLost} nodes`]),
      ...(holdsHeat ? ['Heat stays in place while this action runs'] : []),
      ...(chain === null
        ? []
        : [
            '',
            `Kill chain = ${chain.links} / ${chain.maxLinks} links`,
            `Each link adds ${chain.rewardPercent}% to the Reward Bonus and ${chain.nodesPercent}% to the share of the balance a run takes`,
            'Stopping the action or switching Overclock off resets the chain',
          ]),
      '',
      `Click to switch ${on ? 'off' : 'on'}`,
    ].join('\n'),
  focus: ({ on, bonusPercent, used, slots, full, stacking, count }) =>
    [
      stacking ? `Focus (${count} slots on this action)` : `Focus (${on ? 'on' : 'off'})`,
      stacking
        ? 'Action Speed = Action Speed x (1 + Focus Bonus per slot) ^ Slots on this action'
        : 'Action Speed = Action Speed x (1 + Focus Bonus)',
      '',
      `Focus Bonus = ${bonusPercent}%`,
      `Focus Slots in use = ${used} / ${slots}`,
      '',
      stacking
        ? 'Left half: put a slot on this action. Right half: take one off'
        : full
          ? 'Every slot is in use: switch another action off first'
          : `Click to switch ${on ? 'off' : 'on'}`,
    ].join('\n'),
  burnLead: ({ label, sharePercent, drops, heat, heatAfter, count, canUse }) =>
    [
      label,
      'Heat after Use = Heat x (1 - Share Removed)',
      'Click the lead to use one; it leaves the Inventory',
      '',
      `Share Removed = ${sharePercent}% of the current heat`,
      `Heat now = ${heat}`,
      ...dropChanceLines(drops),
      '',
      canUse ? `Heat after Use = ${heatAfter}` : 'Needs some heat to act on',
      `Owned = ${count}`,
    ].join('\n'),
  zeroDay: ({ label, drops, actionName, count, on, canToggle }) =>
    [
      label,
      `While switched on, every completed ${actionName} run uses one up and gets +100% critical chance`,
      'It switches itself off when the last one is used',
      '',
      ...dropChanceLines(drops),
      on ? 'Switched on' : 'Switched off',
      canToggle ? `Click to switch ${on ? 'off' : 'on'}` : 'Needs a Zero-day to switch on',
      `Owned = ${count}`,
    ].join('\n'),
  adminKey: ({ label, drops, actionName, count, on, canToggle, bonusName, bonusPercent }) =>
    [
      label,
      `While switched on, every completed ${actionName} run uses one up and gets +100% critical chance`,
      ...(bonusName === null ? [] : [`Each of those critical runs has a ${bonusPercent}% chance to drop a ${bonusName}`]),
      'It switches itself off when the last one is used',
      '',
      ...dropChanceLines(drops),
      on ? 'Switched on' : 'Switched off',
      canToggle ? `Click to switch ${on ? 'off' : 'on'}` : 'Needs an Admin key to switch on',
      `Owned = ${count}`,
    ].join('\n'),
  skillShard: ({ label, levels, count, canUse, drops }) =>
    [
      label,
      `Delays the XP scaling of a random unlocked action by ${levels} level${levels === '1' ? '' : 's'}: its next level costs stay at the first level's cost for longer`,
      '',
      ...dropChanceLines(drops),
      canUse ? 'Click to use one; it leaves the Inventory' : 'Needs a shard and an unlocked action',
      `Owned = ${count}`,
    ].join('\n'),
  stackKept: ({ label, count, drops }) =>
    [
      label,
      'Click to select this rarity, then apply it to an action with its Augment button',
      '',
      ...dropChanceLines(drops),
      `Owned = ${count}`,
    ].join('\n'),
  backChannel: ({ label, molesPerItem, boostPercent }) =>
    [label, `Give up one for ${molesPerItem} Moles`, `Each Mole is one point of heat that cools down ${boostPercent}% faster`].join('\n'),
  synths: ({ count, perSecond }) =>
    [
      'Credits per Second = Sum of Credits per Second Then x min(1, Action Levels Now / Action Levels Then)',
      '',
      'Each synthetic sleeve copies a finished sleeve-run: Then is the end of that run, Now is this sleeve',
      'A synthetic sleeve keeps its full amount once this sleeve has caught up with it',
      '',
      `Synthetic Sleeves = ${count}`,
      `Credits per Second = ${perSecond}`,
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
  networkGrowthValues: ({ level, percent }) => ({
    variables: [`Action level = ${level}`],
    result: `Growth factor percentage = ${percent}%`,
  }),
};
