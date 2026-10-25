/**
 * @module core
 *
 * Augments: schematics applied to an action to raise the action XP its runs give.
 */
import type { Inventory } from './inventory';
import { itemCount } from './inventory';
import type { ActionId, GameConfig, GameState, RarityId } from './types';

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
 * Applies Augment schematics (items) to actions.
 *
 * @remarks
 * Each applied schematic adds `items.augment.xpBonusPerItem` (0.01 = 1 percent) to the XP boost of ITS rarity on that action; the
 * boosts of the different rarities multiply (see {@link augmentXpFactor}). Only the ACTION XP is raised, so the action levels come
 * sooner; the sleeve level follows the number of runs and is not affected. Which schematic is used up is decided here: the most
 * common rarity the player holds, so every common one is used before an uncommon one.
 *
 * Called by: `engine.ts` (`GameEngine.augmentAction`). Calls: {@link Inventory} (`take`).
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

  /** The rarity that the next application would use up (the most common one held), or `null` when none is held. */
  private nextRarity(): RarityId | null {
    const augment = this.config.items.augment;
    if (!augment) return null;
    return this.rarityIds.find((rarity) => itemCount(this.state, augment.itemId, rarity) > 0) ?? null;
  }

  /**
   * Applies one schematic to an action, using up the most common rarity held.
   *
   * @param actionId the action to augment
   * @returns true when one was applied; false when the action is unknown, the game has no schematic, or none is held
   */
  apply(actionId: ActionId): boolean {
    const augment = this.config.items.augment;
    const action = this.state.actions[actionId];
    const rarity = this.nextRarity();
    if (!augment || !action || rarity === null) return false;
    if (this.inventory.take(augment.itemId, rarity, 1) <= 0) return false;
    action.augments[rarity] = (action.augments[rarity] ?? 0) + 1;
    return true;
  }
}
