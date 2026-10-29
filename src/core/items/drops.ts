/**
 * @module core
 *
 * Item drops: what a batch of completed runs drops, drawn in closed form.
 */
import type { Inventory } from './inventory';
import { multinomial, perRunEvents, type RandomSource } from '../kernel/sampling';
import type { ActionId, GameConfig, ItemDropRule } from '../types';

/**
 * The chance that ONE completed run drops one rule's item in a given rarity: the rule's chance times that rarity's share of the
 * (normalised) rarity weights. An item without rarity is one stack kept under the first rarity, so its share is 1 there and 0 elsewhere.
 *
 * @remarks
 * The one place the share of a rarity is worked out; `ItemDrops.place` splits real drops with the same weights, so the numbers the
 * interface shows (`DerivedStats.dropSources`) and the drops that happen cannot drift apart.
 * Called by: `engine/stats.ts` (`DerivedStats.dropSources`). Calls: nothing (pure).
 *
 * @param rule the drop rule, with its rarity weights as they stand now
 * @param rarityId the rarity asked about
 * @param firstRarityId the first (most common) rarity
 * @returns a chance in 0..1 (0 for a rarity with no weight)
 */
export function dropShare(rule: ItemDropRule, rarityId: string, firstRarityId: string | undefined): number {
  const weights = rule.rarityWeights;
  if (weights === undefined) return rarityId === firstRarityId ? rule.chance : 0;
  const total = Object.values(weights).reduce((sum, w) => sum + w, 0);
  return total > 0 ? (rule.chance * (weights[rarityId] ?? 0)) / total : 0;
}

/** What drop rules does an action have right now (satisfied by `DerivedStats`). */
export interface DropRules {
  /** The drop rules of the action's owned `itemDrop` buyables. */
  itemDrops(id: ActionId): readonly ItemDropRule[];
}

/**
 * Rolls the items a batch of completed runs drops and puts them in the inventory.
 *
 * @remarks
 * For `runs` completed runs and a rule with chance `p`, the number of drops is drawn from Binomial(runs, p); the drops
 * are then split over the rarities by the rule's weights (multinomial). One batch of a million runs costs the same as one
 * run, in keeping with the closed-form run completion. The drop rules are read at the moment the runs complete, so a
 * rule that changes over time (weights, chance) applies to the runs completed after the change.
 *
 * Called by: `actionRunner.ts` (`ActionRunner.completeRuns`).
 * Calls: `DerivedStats.itemDrops`, `Inventory.add`, `perRunEvents`, `multinomial`.
 */
export class ItemDrops {
  private readonly rarityIds: readonly string[];

  /**
   * Creates the unit.
   *
   * @param config reads `items.rarities` (their order decides how weights are matched), `actions` and `buyables` (for {@link ItemDrops.forceDrop})
   * @param rules where the drop rules of an action come from
   * @param inventory receives the drops
   * @param random randomness (inject a seeded one in tests)
   */
  constructor(
    private readonly config: Pick<GameConfig, 'items' | 'actions' | 'buyables'>,
    private readonly rules: DropRules,
    private readonly inventory: Inventory,
    private readonly random: RandomSource,
  ) {
    this.rarityIds = config.items.rarities.map((r) => r.id);
  }

  /**
   * Rolls the drops of `runs` completed runs of an action.
   *
   * @param actionId the action whose runs completed
   * @param runs how many runs completed (a whole number >= 1)
   */
  roll(actionId: ActionId, runs: number): void {
    for (const rule of this.rules.itemDrops(actionId)) {
      const drops = perRunEvents(runs, rule.chance, this.random);
      if (drops > 0) this.place(rule, drops);
    }
  }

  /**
   * Test aid: drops one item per drop rule right now, whatever the chance, with the rarity drawn by the rule's current weights.
   * The rules are those of the owned `itemDrop` buyables; when none is owned, those of every `itemDrop` buyable in the
   * configuration, so the drops can be tried before buying the harvest.
   *
   * Called by: `engine.ts` (`GameEngine.dropTestItem`).
   */
  forceDrop(): void {
    let rules = this.config.actions.flatMap((a) => this.rules.itemDrops(a.id));
    if (rules.length === 0) rules = this.config.buyables.flatMap((b) => (b.effect.kind === 'itemDrop' ? [b.effect.drop] : []));
    for (const rule of rules) this.place(rule, 1);
  }

  /** Splits `drops` items over the rarities by the rule's weights and puts them in the inventory. */
  private place(rule: ItemDropRule, drops: number): void {
    const weights = rule.rarityWeights;
    if (weights === undefined) {
      // An item without rarity: every drop is its single stack, kept under the most common rarity.
      this.inventory.addFirst(rule.itemId, drops);
      return;
    }
    const counts = multinomial(
      drops,
      this.rarityIds.map((id) => weights[id] ?? 0),
      this.random,
    );
    for (const [i, count] of counts.entries()) this.inventory.add(rule.itemId, this.rarityIds[i]!, count);
  }
}
