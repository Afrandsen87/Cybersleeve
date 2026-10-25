/**
 * @module core
 *
 * Burn leads: items that are used up to take a share of the current heat away.
 */
import type { Inventory } from './inventory';
import { itemCount } from './inventory';
import type { GameConfig, GameState, RarityId } from './types';

/**
 * Uses Burn leads from the Inventory.
 *
 * @remarks
 * One lead removes `items.burnLead.heatFraction` (0.05 = 5 percent) of the CURRENT heat and is used up, so a lead is worth more the
 * hotter the sleeve is. The result may be a fraction of a point of heat; the cooldown then removes whole points only (see `coolHeat`).
 * The lead is not used up when there is no heat to remove. Leads are not sold: the item is declared `sellable: false`.
 *
 * Called by: `engine.ts` (`GameEngine.useBurnLead`). Calls: {@link Inventory} (`take`).
 */
export class BurnLeads {
  /**
   * Creates the unit.
   *
   * @param config reads `items.burnLead` (which item is the lead and what one removes)
   * @param state the live game state (mutated: `heat`)
   * @param inventory where the leads are taken from
   * @param blocked true while heat cannot be reduced at all (an Overclock that stops heat cooling is running); no lead can be used then
   */
  constructor(
    private readonly config: Pick<GameConfig, 'items'>,
    private readonly state: GameState,
    private readonly inventory: Inventory,
    private readonly blocked: () => boolean = () => false,
  ) {}

  /**
   * True when pressing the button for this stack would do something: the game has leads, one of this rarity is held, there is heat
   * and heat is not being held in place.
   *
   * @param rarityId the rarity of the stack
   */
  canUse(rarityId: RarityId): boolean {
    const lead = this.config.items.burnLead;
    return lead !== undefined && !this.blocked() && this.state.heat > 0 && itemCount(this.state, lead.itemId, rarityId) > 0;
  }

  /**
   * Uses one lead of a rarity: it is used up and takes its share of the current heat away.
   *
   * @param rarityId the rarity of the stack to use a lead from
   * @returns true when a lead was used; false when the game has none, none of this rarity is held, or there is no heat
   */
  use(rarityId: RarityId): boolean {
    const lead = this.config.items.burnLead;
    if (!lead || !this.canUse(rarityId)) return false;
    if (this.inventory.take(lead.itemId, rarityId, 1) <= 0) return false;
    this.state.heat -= this.state.heat * lead.heatFraction;
    return true;
  }
}
