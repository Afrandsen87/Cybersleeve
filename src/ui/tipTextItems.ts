/**
 * @module ui
 *
 * The wording of the item and purchase tips.
 *
 * @remarks
 * Part of the hover texts: `tipText.ts` merges the three tables into the one `uiText.ts` holds as `tips`. Entries receive already-formatted strings from the view model.
 */
import type { DropChanceParts } from './uiTextParts';
import type { TipTexts } from './tipTextTypes';

/** The drop chance lines of an item tooltip: one per action that can drop the stack, or 0% while none can. */
function dropChanceLines(drops: readonly DropChanceParts[]): string[] {
  return drops.length === 0 ? ['Drop Chance = 0%'] : drops.map((d) => `Drop Chance = ${d.percent}% per ${d.action} run`);
}

/** The items hover texts. */
export const itemTips: Pick<
  TipTexts,
  'buyable' | 'stack' | 'augment' | 'burnLead' | 'zeroDay' | 'adminKey' | 'skillShard' | 'stackKept' | 'backChannel' | 'synths'
> = {
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
      'Click to apply one of the selected rarity to this action. It will boost its XP gain.',
    ].join('\n'),
  burnLead: ({ label, sharePercent, drops, heat, heatAfter, count, canUse }) =>
    [
      label,
      'Heat after Use = Heat x (1 - Share Removed)',
      'Click the lead to burn it',
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
      `Delays the XP scaling of a random unlocked action by ${levels} level${levels === '1' ? '' : 's'}`,
      '',
      ...dropChanceLines(drops),
      canUse ? 'Click to use one' : 'Needs a shard and an unlocked action',
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
};
