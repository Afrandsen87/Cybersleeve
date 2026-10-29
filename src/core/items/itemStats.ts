/**
 * @module core
 *
 * What items an action drops now, and where a stack can come from; Hacking Proficiency as it counts for the rarity shift. Read only.
 */
import type { BigNum, NumberFactory } from '../../numbers';
import { resolveDropChanceFactor, resolveEffects, type SleeveStats } from '../effects/effects';
import { wholeOrders } from '../kernel/curves';
import type { ActionId, GameConfig, GameState, ItemDropRule } from '../types';
import { dropShare } from './drops';
import { type BackChannelRule, resolveBackChannel, resolveRarityWeightBonus } from './leverageEffects';
import { shiftWeights } from './rarityShift';

/**
 * Answers the questions about item drops. Holds no state; reads the `GameState` it was given every time.
 *
 * Called by: `DerivedStats` (the facade). Calls: `resolveEffects`, `resolveDropChanceFactor`, `shiftWeights`, `dropShare`.
 */
export class ItemStats {
  /**
   * Creates the unit.
   *
   * @param config reads `buyables`, `actions` and `items`
   * @param state the live game state (read only)
   * @param factory number factory
   * @param sleeveStats the sleeve-wide stats (computed once per snapshot by the facade)
   */
  constructor(
    private readonly config: Pick<GameConfig, 'buyables' | 'actions' | 'items'>,
    private readonly state: GameState,
    private readonly factory: NumberFactory,
    private readonly sleeveStats: () => SleeveStats,
  ) {}

  /**
   * The items the action may drop per completed run, from its owned `itemDrop` buyables, with the rarity weights as they stand now:
   * shifted towards the rarer rarities by Hacking Proficiency when a `rarityShiftFromProficiency` buyable of the action is owned,
   * and with the drop chance raised by owned `itemDropChanceMultiplier` buyables (never above 1).
   */
  itemDrops(id: ActionId): readonly ItemDropRule[] {
    const { drops, rarityShifts } = resolveEffects(this.config.buyables, this.state, id, this.factory);
    const steps = rarityShifts.length === 0 ? 0 : wholeOrders(this.effectiveHackingProficiency());
    const rarityIds = this.config.items.rarities.map((r) => r.id);
    return drops.map((rule) => {
      const base = rule.rarityWeights;
      const factor = resolveDropChanceFactor(this.config.buyables, this.state, rule.itemId);
      if (base === undefined) return { ...rule, chance: Math.min(1, rule.chance * factor) }; // an item without rarity has no ratios to shift
      let weights = rarityIds.map((r) => base[r] ?? 0);
      for (const fraction of rarityShifts) weights = shiftWeights(weights, steps, fraction);
      const bonus = resolveRarityWeightBonus(this.config.buyables, this.state, rule.itemId, rarityIds); // added after the shift, per rarity
      const bonused = bonus.some((b) => b > 0);
      if (bonused) weights = weights.map((w, i) => w + bonus[i]!);
      return {
        ...rule,
        chance: Math.min(1, rule.chance * factor),
        rarityWeights: rarityShifts.length === 0 && !bonused ? base : Object.fromEntries(rarityIds.map((r, i) => [r, weights[i]!])),
      };
    });
  }

  /**
   * Where one stack of items can drop from right now: for each action that can drop the item, the chance that ONE completed run of it
   * drops this item in this rarity. That is the drop chance (with the chance multipliers) times the share of the rarity in the drop
   * ratios as they stand now (Hacking Proficiency shifts included); an item without rarity is one stack, so its share is 1. Actions
   * that cannot drop it, and rarities with a share of 0, are left out.
   *
   * @param itemId the item
   * @param rarityId the rarity of the stack (the first rarity for an item without rarity)
   * @returns the actions in configuration order, with the chance of this stack per completed run of each (0..1)
   */
  dropSources(itemId: string, rarityId: string): readonly { readonly actionId: ActionId; readonly chance: number }[] {
    const first = this.config.items.rarities[0]?.id;
    const sources: { actionId: ActionId; chance: number }[] = [];
    for (const def of this.config.actions) {
      let chance = 0;
      for (const rule of this.itemDrops(def.id)) {
        if (rule.itemId === itemId) chance += dropShare(rule, rarityId, first);
      }
      if (chance > 0) sources.push({ actionId: def.id, chance });
    }
    return sources;
  }

  /** Hacking Proficiency as it counts: the stored total times the factor of owned `hackingProficiencyMultiplier` buyables. */
  effectiveHackingProficiency(): BigNum {
    const factor = this.sleeveStats().hackingProficiencyFactor;
    return factor === 1 ? this.state.sleeve.hackingProficiency : this.state.sleeve.hackingProficiency.mul(this.factory.fromNumber(factor));
  }

  /** The back channel the player has unlocked (an owned `backChannel` buyable), or `null`. */
  backChannel(): BackChannelRule | null {
    return resolveBackChannel(
      this.config.buyables,
      this.state,
      this.config.items.rarities.map((r) => r.id),
    );
  }
}
