/**
 * @module testing
 *
 * Invariants of the Inventory and the key toggles.
 */
import { type InvariantCheck, validCount } from './shared';

/**
 * Zero-day and Admin key toggles are on only while one is held; every held stack is a whole number and in the seen set.
 *
 * Called by: `testing/invariants.ts`. Calls: nothing.
 */
export const checkItems: InvariantCheck = (state, config, problems) => {
  if (state.sleeve.keyToggles['zeroDay']) {
    const rule = config.items.zeroDay;
    const stack = config.items.rarities[0];
    if (!rule || !stack || (state.wallet.inventory[rule.itemId]?.[stack.id] ?? 0) <= 0)
      problems.push('the Zero-day toggle is switched on without a Zero-day held');
  }
  if (state.sleeve.keyToggles['adminKey']) {
    const rule = config.items.adminKey;
    const stack = config.items.rarities[0];
    if (!rule || !stack || (state.wallet.inventory[rule.itemId]?.[stack.id] ?? 0) <= 0)
      problems.push('the Admin key toggle is switched on without an Admin key held');
  }
  for (const [itemId, stacks] of Object.entries(state.wallet.inventory)) {
    for (const [rarityId, count] of Object.entries(stacks)) {
      if (count > 0 && state.wallet.seenItems[itemId]?.[rarityId] !== true)
        problems.push(`inventory ${itemId}/${rarityId} is held but not seen`);
      if (!validCount(count) || count > Number.MAX_SAFE_INTEGER)
        problems.push(`inventory ${itemId}/${rarityId} count is invalid: ${count}`);
    }
  }
};
