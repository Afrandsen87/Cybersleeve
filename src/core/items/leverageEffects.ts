/**
 * @module core
 *
 * The effects of the leverage skills that are read by dedicated queries: the back channel (Moles for items) and the flat bonus to the
 * drop ratios of an item.
 */
import type { BuyableDefinition, GameState } from '../types';

/** What the owned back channel buyables let the player do. */
export interface BackChannelRule {
  readonly itemId: string;
  /** Moles one given-up item is worth, per rarity id. A rarity that is missing cannot be given up. */
  readonly molesByRarity: Readonly<Record<string, number>>;
  /** The extra cooldown speed (0.5 = 50 percent) while Moles remain. */
  readonly cooldownBoost: number;
}

/**
 * The back channel the player has unlocked, if any.
 *
 * @remarks
 * The first owned `backChannel` buyable opens the channel for its rarity at `molesPerItem`. An owned `backChannelRarityScaling` for the
 * same item opens every rarity, and a rarity is worth `molesPerItem x (its position in the rarity list, from 1)`: common x1, uncommon x2,
 * rare x3 and so on. Every owned copy of a `backChannelMultiplier` for the item then multiplies all of it by its `factor`.
 *
 * Called by: `stats.ts` (`DerivedStats.backChannel`).
 *
 * @param buyables all buyable definitions
 * @param state current state (reads `purchased`)
 * @param rarityIds every rarity id, most common first
 * @returns the rule, or `null` while no `backChannel` buyable is owned
 */
export function resolveBackChannel(
  buyables: readonly BuyableDefinition[],
  state: Pick<GameState, 'purchased'>,
  rarityIds: readonly string[],
): BackChannelRule | null {
  const owned = (b: BuyableDefinition): number => state.purchased[b.id] ?? 0;
  const channel = buyables.find((b) => owned(b) > 0 && b.effect.kind === 'backChannel')?.effect;
  if (channel?.kind !== 'backChannel') return null;
  const { itemId, rarityId, molesPerItem, cooldownBoost } = channel;
  let multiplier = 1;
  let scaled = false;
  for (const b of buyables) {
    const effect = b.effect;
    if (owned(b) === 0 || !('itemId' in effect) || effect.itemId !== itemId) continue;
    if (effect.kind === 'backChannelRarityScaling') scaled = true;
    if (effect.kind === 'backChannelMultiplier') multiplier *= effect.factor ** owned(b);
  }
  const molesByRarity: Record<string, number> = {};
  rarityIds.forEach((id, index) => {
    if (scaled) molesByRarity[id] = molesPerItem * (index + 1) * multiplier;
    else if (id === rarityId) molesByRarity[id] = molesPerItem * multiplier;
  });
  return { itemId, molesByRarity, cooldownBoost };
}

/**
 * The flat amount added to the drop weight of each rarity of an item (owned `rarityWeightBonus` buyables, per copy): a buyable with a
 * `rarityId` adds to that rarity only, one without adds to every rarity.
 *
 * Called by: `stats.ts` (`DerivedStats.itemDrops`).
 *
 * @param buyables all buyable definitions
 * @param state current state (reads `purchased`)
 * @param itemId the item
 * @param rarityIds the rarity ids of the configuration
 * @returns the weight to add to each rarity, aligned with `rarityIds` (0 without such a buyable)
 */
export function resolveRarityWeightBonus(
  buyables: readonly BuyableDefinition[],
  state: Pick<GameState, 'purchased'>,
  itemId: string,
  rarityIds: readonly string[],
): number[] {
  const bonus = rarityIds.map(() => 0);
  for (const b of buyables) {
    const copies = state.purchased[b.id] ?? 0;
    const e = b.effect;
    if (copies === 0 || e.kind !== 'rarityWeightBonus' || e.itemId !== itemId) continue;
    rarityIds.forEach((id, i) => {
      if (e.rarityId === undefined || e.rarityId === id) bonus[i]! += e.amount * copies;
    });
  }
  return bonus;
}
