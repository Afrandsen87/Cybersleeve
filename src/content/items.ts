/**
 * @module content
 *
 * The items of the game: rarities (with their sell values), the item kinds and the special items.
 */
import type { GameConfig } from '../core';
import { num } from '../numbers';
import { PRACTICE_HACKING, PUSH_MALWARE, KOMPROMAT, AUGMENT_SCHEMATIC, BURN_LEAD, ZERO_DAY, ADMIN_KEY, SKILL_SHARD } from './ids';

/** The items of the game: rarities (with their sell values), the item kinds and the special items. */
export const itemsConfig: GameConfig['items'] = {
  /** Most common first. Common sells for 100 credits; each tier is two orders of magnitude above the one before. */
  rarities: [
    { id: 'common', name: 'Common', sellValue: num(100) },
    { id: 'uncommon', name: 'Uncommon', sellValue: num(10_000) },
    { id: 'rare', name: 'Rare', sellValue: num(1_000_000) },
    { id: 'legendary', name: 'Legendary', sellValue: num(100_000_000) },
    { id: 'crisis', name: 'Crisis level', sellValue: num(10_000_000_000) },
  ],
  definitions: [
    { id: KOMPROMAT, name: 'Kompromat file' },
    // Schematics are applied with the Augment button, not paid out.
    { id: AUGMENT_SCHEMATIC, name: 'Augment schematic', sellable: false },
    // Leads are used from the Inventory to take heat away, not paid out.
    { id: BURN_LEAD, name: 'Burn lead', sellable: false, hasRarity: false },
    // Zero-days are switched on in the Inventory and used up by critical Push malware runs, not paid out.
    { id: ZERO_DAY, name: 'Zero-day', sellable: false, hasRarity: false },
    // Admin keys are switched on in the Inventory and used up by critical Practice Hacking runs, not paid out.
    { id: ADMIN_KEY, name: 'Admin key', sellable: false, hasRarity: false },
    // Shards are used from the Inventory on a random unlocked action, not paid out.
    { id: SKILL_SHARD, name: 'Skill shard', sellable: false, hasRarity: false },
  ],
  /**
   * One Augment schematic applied to an action adds 1% to the action XP boost of ITS rarity (additively); the boosts of the
   * different rarities multiply. Sleeve XP is not affected.
   */
  augment: { itemId: AUGMENT_SCHEMATIC, xpBonusPerItem: 0.01 },
  /** One Burn lead used from the Inventory takes 5% of the CURRENT heat away and is used up. */
  burnLead: { itemId: BURN_LEAD, heatFraction: 0.05 },
  /** While the Zero-day toggle is on, every completed Push malware run uses one Zero-day up and gets +100% critical chance. */
  zeroDay: { itemId: ZERO_DAY, actionId: PUSH_MALWARE },
  /**
   * While the Admin key toggle is on, every completed Practice Hacking run uses one Admin key up and is a critical success. Each such
   * key-assisted critical run has a 2% chance to drop a Skill shard (placeholder).
   */
  adminKey: { itemId: ADMIN_KEY, actionId: PRACTICE_HACKING, shard: { itemId: SKILL_SHARD, chance: 0.02 } },
  /** One Skill shard delays the XP scaling of the action it lands on by 1 level. */
  skillShard: { itemId: SKILL_SHARD, levelsDelayed: 1 },
};
