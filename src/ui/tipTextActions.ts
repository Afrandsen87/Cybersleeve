/**
 * @module ui
 *
 * The wording of the action, income and critical tips.
 *
 * @remarks
 * Part of the hover texts: `tipText.ts` merges the three tables into the one `uiText.ts` holds as `tips`. Entries receive already-formatted strings from the view model.
 */
import type { LevelScaling } from '../core';
import { formatPlain } from '../numbers';
import type { TipTexts } from './tipTextTypes';

/** The actions hover texts. */
export const actionTips: Pick<TipTexts, 'actionSpeed' | 'payout' | 'income' | 'critical' | 'overclock' | 'focus' | 'networkGrowthValues'> =
  {
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
    critical: ({ chancePercent, xpMultiplier, rewardMultiplier }) =>
      [
        `Chance per completed run = ${chancePercent}%`,
        '',
        `Each critical success gives ${xpMultiplier}x action XP and pays ${rewardMultiplier}x the reward`,
        'Above 100% a run can have several critical successes: 150% is one guaranteed and a 50% chance of a second',
        'Some actions may have other effects as well',
      ].join('\n'),
    overclock: ({
      on,
      strength,
      speed,
      reward,
      heatPerMinute,
      heatPerRunFactor,
      heatChanceFactor,
      nodesLost,
      alsoPays,
      holdsHeat,
      chain,
    }) =>
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
        ...(heatPerMinute === null ? [] : [`Causes ${heatPerMinute} heat per minute while this action runs`]),
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
    networkGrowthValues: ({ level, percent }) => ({
      variables: [`Action level = ${level}`],
      result: `Growth factor percentage = ${percent}%`,
    }),
  };
