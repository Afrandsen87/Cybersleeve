import { itemCount } from '../../items/inventory';
import type { BuyableEffect } from '../../types';
import { factorAtLeastOne, perAction, sleeveWide } from '../effectHelpers';
import type { EffectDefinition } from '../effectTypes';

type Kind =
  | 'interfaceSpeedFromAugmentRarities'
  | 'itemDrop'
  | 'rarityShiftFromProficiency'
  | 'itemDropChanceMultiplier'
  | 'nodePayoutFromItems'
  | 'backChannel'
  | 'backChannelRarityScaling'
  | 'backChannelMultiplier'
  | 'rarityWeightBonus';

/** The entries for the item effects: drops, rarity weights, the back channel and what items add to other stats, keyed by kind. */
export const ITEM_ENTRIES: { readonly [K in Kind]: EffectDefinition<Extract<BuyableEffect, { kind: K }>> } = {
  interfaceSpeedFromAugmentRarities: {
    traits: sleeveWide,
    validate: (e, { where, errors }) => {
      if (!(Number.isFinite(e.perRarity) && e.perRarity > 0))
        errors.push(`${where}: interfaceSpeedFromAugmentRarities perRarity must be > 0`);
    },
    sleeve: (acc, e, { augmentRaritiesHeld }) => {
      acc.interfaceSkillFactor *= 1 + e.perRarity * augmentRaritiesHeld();
    },
  },
  itemDrop: {
    traits: perAction,
    validate: ({ drop }, { where, itemIds, rarityIds, raritylessItemIds, errors }) => {
      if (!itemIds.has(drop.itemId)) errors.push(`${where}: drop refers to unknown item "${drop.itemId}"`);
      if (!(Number.isFinite(drop.chance) && drop.chance >= 0 && drop.chance <= 1))
        errors.push(`${where}: drop chance must be between 0 and 1`);
      if (raritylessItemIds.has(drop.itemId)) {
        if (drop.rarityWeights !== undefined) errors.push(`${where}: an item without rarity takes no rarity weights`);
        return;
      }
      if (drop.rarityWeights === undefined) {
        errors.push(`${where}: a drop of an item with rarities needs rarity weights`);
        return;
      }
      let total = 0;
      for (const [rarity, weight] of Object.entries(drop.rarityWeights)) {
        if (!rarityIds.has(rarity)) errors.push(`${where}: drop weights refer to unknown rarity "${rarity}"`);
        if (!(Number.isFinite(weight) && weight >= 0)) errors.push(`${where}: drop weight of "${rarity}" must be >= 0`);
        else total += weight;
      }
      if (!(total > 0)) errors.push(`${where}: at least one drop weight must be > 0`);
    },
    action: (acc, e) => {
      acc.drops.push(e.drop);
    },
  },
  rarityShiftFromProficiency: {
    traits: perAction,
    validate: (e, { where, errors }) => {
      if (!(Number.isFinite(e.fractionPerOrder) && e.fractionPerOrder > 0 && e.fractionPerOrder <= 1)) {
        errors.push(`${where}: fractionPerOrder must be in (0, 1]`);
      }
    },
    action: (acc, e) => {
      acc.rarityShifts.push(e.fractionPerOrder);
    },
  },
  itemDropChanceMultiplier: {
    traits: sleeveWide,
    validate: (e, ctx) => {
      factorAtLeastOne(e, ctx);
      if (!ctx.itemIds.has(e.itemId)) ctx.errors.push(`${ctx.where}: drop chance refers to unknown item "${e.itemId}"`);
    },
  },
  nodePayoutFromItems: {
    traits: sleeveWide,
    validate: (e, { where, itemIds, rarityIds, errors }) => {
      if (!itemIds.has(e.itemId)) errors.push(`${where}: refers to unknown item "${e.itemId}"`);
      if (!rarityIds.has(e.rarityId)) errors.push(`${where}: refers to unknown rarity "${e.rarityId}"`);
      if (!(Number.isFinite(e.perItem) && e.perItem >= 0)) errors.push(`${where}: perItem must be >= 0`);
    },
    sleeve: (acc, e, { owned, state }) => {
      acc.nodePayoutFactor *= (1 + e.perItem * itemCount(state, e.itemId, e.rarityId)) ** owned;
    },
  },
  backChannel: {
    traits: sleeveWide,
    validate: (e, { where, itemIds, rarityIds, errors }) => {
      if (!itemIds.has(e.itemId)) errors.push(`${where}: refers to unknown item "${e.itemId}"`);
      if (!rarityIds.has(e.rarityId)) errors.push(`${where}: refers to unknown rarity "${e.rarityId}"`);
      if (!(Number.isFinite(e.molesPerItem) && e.molesPerItem > 0)) errors.push(`${where}: molesPerItem must be > 0`);
      if (!(Number.isFinite(e.cooldownBoost) && e.cooldownBoost >= 0)) errors.push(`${where}: cooldownBoost must be >= 0`);
    },
    sleeve: (acc, e, { owned }) => {
      acc.heatCooldownBoost += e.cooldownBoost * owned;
    },
  },
  backChannelRarityScaling: {
    traits: sleeveWide,
    validate: (e, { where, itemIds, errors }) => {
      if (!itemIds.has(e.itemId)) errors.push(`${where}: refers to unknown item "${e.itemId}"`);
    },
  },
  backChannelMultiplier: {
    traits: sleeveWide,
    validate: (e, { where, itemIds, errors }) => {
      if (!itemIds.has(e.itemId)) errors.push(`${where}: refers to unknown item "${e.itemId}"`);
      if (!(Number.isFinite(e.factor) && e.factor >= 1)) errors.push(`${where}: factor must be >= 1`);
    },
  },
  rarityWeightBonus: {
    traits: sleeveWide,
    validate: (e, { where, itemIds, rarityIds, errors }) => {
      if (!itemIds.has(e.itemId)) errors.push(`${where}: refers to unknown item "${e.itemId}"`);
      if (e.rarityId !== undefined && !rarityIds.has(e.rarityId)) errors.push(`${where}: refers to unknown rarity "${e.rarityId}"`);
      if (!(Number.isFinite(e.amount) && e.amount > 0)) errors.push(`${where}: amount must be > 0`);
    },
  },
};
