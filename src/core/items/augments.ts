/**
 * @module core
 *
 * Augments: schematics applied to an action to raise the action XP its runs give.
 */
import type { Inventory } from './inventory';
import { itemCount } from './inventory';
import type { ActionId, GameConfig, GameState, RarityId, SleeveState } from '../types';

/**
 * The factor the augments applied to an action multiply its action XP per run by.
 *
 * @remarks
 * Within one rarity the bonus is additive: `n` augments of a rarity give `1 + n x bonus`. The rarities then multiply each other, so
 * 3 common, 3 uncommon and 3 rare augments at 1% each give `1.03 x 1.03 x 1.03`, which is why a rarer augment is worth using.
 *
 * Called by: `stats.ts` (`DerivedStats.xpPerRun`).
 *
 * @param applied augments applied to the action, per rarity id (a missing rarity counts as 0)
 * @param bonus what one augment adds within its rarity (0.01 = 1 percent)
 * @returns a factor >= 1
 */
export function augmentXpFactor(applied: Readonly<Record<RarityId, number>>, bonus: number): number {
  let factor = 1;
  for (const count of Object.values(applied)) if (count > 0) factor *= 1 + count * bonus;
  return factor;
}

/**
 * How many distinct rarities have at least one augment applied on any action (common alone is 1; common and uncommon is 2).
 *
 * Called by: `stats.ts` (`DerivedStats.sleeveStats`, for `interfaceSpeedFromAugmentRarities`).
 *
 * @param actions the state of every action (reads `augments`)
 * @returns a whole number, at most the number of rarities
 */
export function distinctAugmentRarities(actions: Readonly<Record<ActionId, Pick<SleeveState['actions'][ActionId], 'augments'>>>): number {
  const held = new Set<RarityId>();
  for (const action of Object.values(actions)) {
    for (const [rarity, count] of Object.entries(action.augments)) if (count > 0) held.add(rarity);
  }
  return held.size;
}

/**
 * Applies Augment schematics (items) to actions.
 *
 * @remarks
 * Each applied schematic adds `items.augment.xpBonusPerItem` (0.01 = 1 percent) to the XP boost of ITS rarity on that action; the
 * boosts of the different rarities multiply (see {@link augmentXpFactor}). Only the ACTION XP is raised, so the action levels come
 * sooner; the sleeve level follows the number of runs and is not affected. The player chooses which rarity is used up (selected in
 * the Inventory); the dispersal of the Automation tab (`applyMany`) has no choice to make and uses the most common rarity held first.
 *
 * Called by: `engine.ts` (`GameEngine.augmentAction`), `automation.ts` (`applyMany`). Calls: {@link Inventory} (`take`).
 */
export class Augments {
  private readonly rarityIds: readonly string[];

  /**
   * Creates the unit.
   *
   * @param config reads `items.augment` (which item is the schematic and what one is worth) and the rarity order
   * @param state the live game state (mutated: each action's `augments`)
   * @param inventory where the schematics are taken from
   */
  constructor(
    private readonly config: Pick<GameConfig, 'items'>,
    private readonly state: GameState,
    private readonly inventory: Inventory,
  ) {
    this.rarityIds = config.items.rarities.map((r) => r.id);
  }

  /**
   * Applies up to `count` schematics to an action, the most common rarities first.
   *
   * @param actionId the action to augment
   * @param count how many to apply at most (a whole number >= 1)
   * @returns how many were applied (0 when the action is unknown, the game has no schematic, or none is held)
   */
  applyMany(actionId: ActionId, count: number): number {
    const augment = this.config.items.augment;
    const action = this.state.sleeve.actions[actionId];
    if (!augment || !action) return 0;
    let applied = 0;
    for (const rarity of this.rarityIds) {
      if (applied >= count) break;
      const taken = this.inventory.take(augment.itemId, rarity, count - applied);
      if (taken > 0) action.augments[rarity] = (action.augments[rarity] ?? 0) + taken;
      applied += taken;
    }
    return applied;
  }

  /**
   * Applies one schematic of the chosen rarity to an action.
   *
   * @param actionId the action to augment
   * @param rarityId the rarity to use up (only this one is touched)
   * @returns true when one was applied; false when the action or rarity is unknown, the game has no schematic, or none of that rarity is held
   */
  apply(actionId: ActionId, rarityId: RarityId): boolean {
    const augment = this.config.items.augment;
    const action = this.state.sleeve.actions[actionId];
    if (!augment || !action || !this.rarityIds.includes(rarityId)) return false;
    if (itemCount(this.state, augment.itemId, rarityId) <= 0 || this.inventory.take(augment.itemId, rarityId, 1) <= 0) return false;
    action.augments[rarityId] = (action.augments[rarityId] ?? 0) + 1;
    return true;
  }
}
