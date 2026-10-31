/**
 * @module content
 * Automation context: the Kompromat trunk forks after rare autosale into Back Channel and higher-rarity sales.
 * Called by: automationLines. Calls: automationSkillId; content data only.
 */
import type { BuyableDefinition } from '../../../core';
import { num } from '../../../numbers';
import { itemsConfig } from '../../items';
import { automationSkillId, BRANCH_AUTOSALE, KOMPROMAT_HARVEST, SKILL_BACK_CHANNEL, SKILL_TIERED_INFORMANTS } from '../../ids';

/** Automation context: stable saved slots, rarity ids and first-parent edges of the single tree. */
const NODES = [
  { slot: 1, rarity: 'common', parent: 0, channel: false },
  { slot: 2, rarity: 'uncommon', parent: 1, channel: false },
  { slot: 3, rarity: 'rare', parent: 2, channel: false },
  { slot: 4, rarity: 'common', parent: 3, channel: true },
  { slot: 5, rarity: 'uncommon', parent: 4, channel: true },
  { slot: 6, rarity: 'rare', parent: 5, channel: true },
  { slot: 7, rarity: 'legendary', parent: 3, channel: false },
  { slot: 8, rarity: 'crisis', parent: 7, channel: false },
] as const;

/** Automation context: eight distinct skills, one automation point each; removed slots 9/10 stay absent. */
export const autosaleSkills: BuyableDefinition[] = NODES.map(({ slot, rarity, parent, channel }) => {
  const name = itemsConfig.rarities.find((r) => r.id === rarity)!.name;
  return {
    id: automationSkillId(BRANCH_AUTOSALE, slot),
    name: channel ? `Auto Back Channel: ${name}` : `Autosale: ${name}`,
    symbol: `S${slot}`,
    description: channel
      ? `Adds a switch to give up all ${name.toLowerCase()} Kompromat files through Back Channel, before autosale.`
      : `Adds a switch to sell ${name.toLowerCase()} Kompromat files automatically at the normal price.`,
    currency: 'automationPoints',
    branch: BRANCH_AUTOSALE,
    requires: channel ? [rarity === 'common' ? SKILL_BACK_CHANNEL : SKILL_TIERED_INFORMANTS] : [KOMPROMAT_HARVEST],
    ...(parent ? { parents: [automationSkillId(BRANCH_AUTOSALE, parent)] } : {}),
    cost: num(1),
    effect:
      slot === 1
        ? { kind: 'unlocksAutomation', feature: 'autosale', allowsAutosale: rarity }
        : channel
          ? { kind: 'allowsAutoBackchannel', rarity }
          : { kind: 'allowsAutosale', rarity },
  };
});
