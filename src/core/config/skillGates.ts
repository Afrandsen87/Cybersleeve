/**
 * @module core/config
 * Config context: validates skill-tree parents and economy sleeve-skill requirements.
 * Called by: validateConfig. Calls: isPointCurrency, sleeveSkillIds.
 */
import { isPointCurrency, sleeveSkillIds } from '../kernel/currencies';
import type { BuyableDefinition } from '../effects/buyableTypes';

/**
 * Checks branch trunks, parent references and distinct-skill count bounds; appends errors without mutating content.
 * Called by: validateConfig. Calls: isPointCurrency, Map accessors.
 * @param buyables configured purchases
 * @param errors diagnostic output
 */
export function checkSkillGates(buyables: readonly BuyableDefinition[], errors: string[]): void {
  const byId = new Map(buyables.map((b) => [b.id, b]));
  const branchSizes = new Map<string, number>();
  const sleeveSkills = sleeveSkillIds(buyables).length;
  for (const b of buyables)
    if (b.branch !== undefined && isPointCurrency(b.currency)) {
      branchSizes.set(b.branch, (branchSizes.get(b.branch) ?? 0) + 1);
    }
  for (const b of buyables) {
    for (const id of b.parents ?? []) {
      const parent = byId.get(id);
      if (!parent) errors.push(`buyable "${b.id}": has unknown parent "${id}"`);
      if (id === b.id) errors.push(`buyable "${b.id}": cannot be its own parent`);
      const trunk =
        parent !== undefined &&
        isPointCurrency(parent.currency) &&
        parent.branch !== undefined &&
        branchSizes.get(parent.branch) === 1 &&
        (parent.parents?.length ?? 0) === 0;
      if (parent && parent.branch !== b.branch && !trunk)
        errors.push(
          `buyable "${b.id}": its parent "${id}" is in another branch (a parent must be in the same branch or a trunk branch containing exactly one parentless skill)`,
        );
    }
    if ((b.parents?.length ?? 0) > 0 && !isPointCurrency(b.currency))
      errors.push(`buyable "${b.id}": only skills (paid in points) have parents`);
    const required = b.requiresSleeveSkills ?? 0;
    if (!(Number.isInteger(required) && required >= 0 && required <= sleeveSkills))
      errors.push(`buyable "${b.id}": requiresSleeveSkills must be an integer >= 0 and no greater than the number of sleeve skills`);
  }
}
