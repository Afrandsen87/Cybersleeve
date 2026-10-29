/**
 * @module core
 *
 * Shapes of the items: kinds, rarities, drop rules and the special items (Augment schematic, Burn lead, Zero-day, Admin key, Skill shard).
 */
import type { BigNum } from '../../numbers';
import type { ActionId } from '../actions/actionTypes';

/** Identifier of an item kind (e.g. `"kompromat"`). Never shown to the player. */
export type ItemId = string;

/** Identifier of a rarity (e.g. `"rare"`). Never shown to the player. */
export type RarityId = string;

/** One rarity tier of items. The order of {@link ItemsConfig.rarities} is the order from most to least common. */
export interface RarityDefinition {
  readonly id: RarityId;
  /** Display name (placeholder, may be renamed freely). */
  readonly name: string;
  /** Credits one item of this rarity sells for (>= 0). */
  readonly sellValue: BigNum;
}

/** Static description of a kind of item that actions can drop. It exists in every rarity. */
export interface ItemDefinition {
  readonly id: ItemId;
  /** Display name (placeholder, may be renamed freely). */
  readonly name: string;
  /** Items of this kind can be paid out for credits from the Inventory. Default: true. */
  readonly sellable?: boolean;
  /**
   * False for an item without rarity: it is one stack, shown under its own name, and a drop rule for it names no rarity weights.
   * Internally the stack is kept under the first (most common) rarity. Default: true (the item exists in every rarity).
   */
  readonly hasRarity?: boolean;
}

/** What the Augment schematic item does when it is applied to an action. */
export interface AugmentConfig {
  /** The item that is the schematic. */
  readonly itemId: ItemId;
  /**
   * What one schematic adds to the action XP boost of ITS rarity, additively (0.01 = 1 percent; > 0). The boosts of the different
   * rarities multiply each other (3 common, 3 uncommon and 3 rare give 1.03 x 1.03 x 1.03).
   */
  readonly xpBonusPerItem: number;
}

/** What the Burn lead item does when it is used from the Inventory. */
export interface BurnLeadConfig {
  /** The item that is the lead. */
  readonly itemId: ItemId;
  /** The share of the CURRENT heat one lead removes (0.05 = 5 percent; in (0, 1]). Using it uses the lead up. */
  readonly heatFraction: number;
}

/** What the Zero-day item does while its Inventory toggle is on. */
export interface ZeroDayConfig {
  /** The item that is the Zero-day. */
  readonly itemId: ItemId;
  /** The action whose completed runs a Zero-day makes critical: each run uses one up. */
  readonly actionId: ActionId;
}

/**
 * What the Admin key item does while its Inventory toggle is on: the same mechanism as the Zero-day (each completed run of `actionId`
 * uses one up and is critical), and each such key-assisted critical run may also drop a bonus item.
 */
export interface AdminKeyConfig extends ZeroDayConfig {
  /** Item dropped by key-assisted critical runs, or none. */
  readonly shard?: {
    /** The item dropped (an item without rarity). */
    readonly itemId: ItemId;
    /** Chance (0..1) that ONE key-assisted critical run drops one. */
    readonly chance: number;
  };
}

/** What the Skill shard item does when it is used from the Inventory. */
export interface SkillShardConfig {
  /** The item that is the shard. */
  readonly itemId: ItemId;
  /**
   * How many levels one shard delays the XP scaling of the action it lands on by (a whole number >= 1): the first `n` level
   * costs of the action are all the first level's cost, and the growth starts after them. Action levels only.
   */
  readonly levelsDelayed: number;
}

/** The item entity: which kinds exist and which rarity tiers they come in. */
export interface ItemsConfig {
  /** Which item, while switched on in the Inventory, makes the runs of an action critical and may drop a bonus item. Default: none (no toggle). */
  readonly adminKey?: AdminKeyConfig;
  /** Which item can be used from the Inventory to delay the XP scaling of a random unlocked action. Default: none (no Use button). */
  readonly skillShard?: SkillShardConfig;
  /** Which item can be applied to an action to raise its XP gain. Default: none (no Augment button). */
  readonly augment?: AugmentConfig;
  /** Which item can be used from the Inventory to take heat away. Default: none (no Use button). */
  readonly burnLead?: BurnLeadConfig;
  /** Which item, while switched on in the Inventory, makes the runs of an action critical. Default: none (no toggle). */
  readonly zeroDay?: ZeroDayConfig;
  /** Rarity tiers, most common first. */
  readonly rarities: readonly RarityDefinition[];
  /** The kinds of item. */
  readonly definitions: readonly ItemDefinition[];
}

/**
 * Items an action drops when a run completes (the result of an `itemDrop` buyable).
 *
 * @remarks
 * Each completed run has `chance` to drop one item; the item's rarity is then drawn by `rarityWeights`. An item without rarity
 * (`ItemDefinition.hasRarity: false`) has no weights: every drop is its single stack.
 */
export interface ItemDropRule {
  readonly itemId: ItemId;
  /** Chance (0..1) that one completed run drops an item at all. */
  readonly chance: number;
  /** Relative weight per rarity id (>= 0, at least one > 0). Weights are normalised, so `{ common: 90, uncommon: 10 }` means 90% / 10%. A missing rarity weighs 0. */
  readonly rarityWeights?: Readonly<Record<RarityId, number>>;
}
