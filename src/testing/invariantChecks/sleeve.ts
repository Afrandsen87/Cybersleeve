/**
 * @module testing
 *
 * Invariants of the life being lived: network, actions, owned buyables, toggles, Focus, banked criticals and chains.
 */
import { BuyableCaps, isActionCardPurchase } from '../../core';
import { type InvariantCheck, isWhole, validAmount, validCount } from './shared';

/**
 * Network is whole with a remainder below 1; each action's amounts, progress, shards and augments are valid; owned copies are within caps and
 * their requirements; Overclock and Focus are on only with their unlock; Focus slots are within the slots; banked criticals and chains are valid.
 *
 * Called by: `testing/invariants.ts`. Calls: `BuyableCaps`, `isActionCardPurchase`.
 */
export const checkSleeve: InvariantCheck = (state, config, problems) => {
  if (!isWhole(state.sleeve.network)) problems.push(`network is not whole: ${state.sleeve.network.toString()}`);
  if (!(state.sleeve.networkRemainder >= 0 && state.sleeve.networkRemainder < 1))
    problems.push(`networkRemainder is outside [0, 1): ${state.sleeve.networkRemainder}`);

  for (const def of config.actions) {
    const action = state.sleeve.actions[def.id];
    if (!action) {
      problems.push(`action ${def.id} has no state`);
      continue;
    }
    if (!validAmount(action.xp)) problems.push(`${def.id}.xp is not a valid amount: ${action.xp.toString()}`);
    if (!validAmount(action.sleeveXp)) problems.push(`${def.id}.sleeveXp is not a valid amount: ${action.sleeveXp.toString()}`);
    if (!Number.isFinite(action.progress) || action.progress < 0 || action.progress >= 1)
      problems.push(`${def.id}.progress is invalid: ${action.progress}`);
    if (!validCount(action.skillShards)) problems.push(`${def.id}.skillShards is invalid: ${action.skillShards}`);
    for (const [rarity, count] of Object.entries(action.augments)) {
      if (!validCount(count)) problems.push(`${def.id}.augments.${rarity} is invalid: ${count}`);
    }
    if (!validCount(action.runsTowardSleeveXp) || action.runsTowardSleeveXp >= config.progression.runsPerSleeveXp) {
      problems.push(`${def.id}.runsTowardSleeveXp is invalid: ${action.runsTowardSleeveXp}`);
    }
  }
  const caps = new BuyableCaps(config.buyables);
  for (const b of config.buyables) {
    const owned = state.sleeve.purchased[b.id] ?? 0;
    if (!validCount(owned) || owned > caps.maxCopies(b, state.sleeve.purchased)) problems.push(`${b.id} owned count is invalid: ${owned}`);
    for (const need of [...(b.requires ?? []), ...(b.parents ?? [])]) {
      if (owned > 0 && (state.sleeve.purchased[need] ?? 0) <= 0) problems.push(`${b.id} is owned without ${need}, which it needs`);
    }
  }
  const unlocked = (kind: string, actionId: string): boolean =>
    config.buyables.some((b) => b.effect.kind === kind && b.actionId === actionId && (state.sleeve.purchased[b.id] ?? 0) > 0);
  const slots =
    config.focus.baseSlots +
    config.buyables.reduce((n, b) => (b.effect.kind === 'focusSlots' ? n + b.effect.perCopy * (state.sleeve.purchased[b.id] ?? 0) : n), 0);
  const known = new Set(config.actions.map((a) => a.id));
  for (const id of Object.keys(state.sleeve.overclocked)) {
    const def = config.actions.find((a) => a.id === id);
    if (!known.has(id) || !def?.overclock || !unlocked('overclockUnlock', id))
      problems.push(`overclocked.${id} is switched on without its unlock`);
  }
  for (const id of Object.keys(state.sleeve.focused)) {
    if (!known.has(id) || !unlocked('focusUnlock', id)) problems.push(`focused.${id} is switched on without its unlock`);
  }
  for (const [id, count] of Object.entries(state.wallet.lastLifePurchases)) {
    const b = config.buyables.find((x) => x.id === id);
    if (!b || !isActionCardPurchase(b) || !validCount(count) || count < 1) problems.push(`lastLifePurchases.${id} is invalid: ${count}`);
  }
  const stacking = config.buyables.some((b) => b.effect.kind === 'focusStacking' && (state.sleeve.purchased[b.id] ?? 0) > 0);
  for (const [id, count] of Object.entries(state.sleeve.focusStacks)) {
    if (!validCount(count) || count < 1) problems.push(`focusStacks.${id} is invalid: ${count}`);
    if (state.sleeve.focused[id] !== true) problems.push(`focusStacks.${id} has stacked slots on an action that is not focused`);
    if (!stacking) problems.push(`focusStacks.${id} is set without a focus stacking skill`);
  }
  const taken = Object.keys(state.sleeve.focused).length + Object.values(state.sleeve.focusStacks).reduce((n, c) => n + c, 0);
  if (taken > slots) problems.push(`${taken} Focus slots are taken with ${slots} slots`);
  for (const [id, count] of Object.entries(state.sleeve.bankedCriticals)) {
    if (!known.has(id) || !validCount(count)) problems.push(`bankedCriticals.${id} is invalid: ${count}`);
  }
  for (const [id, links] of Object.entries(state.sleeve.chains)) {
    const owned = config.buyables.find(
      (b) => b.effect.kind === 'overclockChain' && b.actionId === id && (state.sleeve.purchased[b.id] ?? 0) > 0,
    );
    const max = owned?.effect.kind === 'overclockChain' ? owned.effect.chain.maxLinks : undefined;
    if (max === undefined || !validCount(links) || links > max) problems.push(`chains.${id} is invalid: ${links}`);
  }
};
