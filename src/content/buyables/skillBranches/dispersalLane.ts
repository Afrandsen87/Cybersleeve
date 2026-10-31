/**
 * @module content
 * Automation context: the stable nine-node Augment dispersal chain grants rarity permissions and action selection slots.
 * No requires gates: Daemon Persistence must retain the skills when their manual purchases reset.
 * Called by: automationLines. Calls: automationSkillId; content data only.
 */
import type { BuyableDefinition } from '../../../core';
import { num } from '../../../numbers';
import { automationSkillId, BRANCH_DISPERSAL } from '../../ids';
import { itemsConfig } from '../../items';

/** Automation context: saved slot order; null adds a target slot, a rarity adds permission. */
const PERMISSIONS = ['common', null, 'uncommon', null, null, 'rare', null, 'legendary', null] as const;

/** Automation context: one-point chain; the root alone unlocks the feature and grants its initial slot and rarity. */
export const dispersalSkills: BuyableDefinition[] = PERMISSIONS.map((rarity, i) => {
  const slot = i + 1;
  const name = rarity === null ? null : itemsConfig.rarities.find((r) => r.id === rarity)!.name;
  return {
    id: automationSkillId(BRANCH_DISPERSAL, slot),
    name: slot === 1 ? 'Augment Dispersal' : name === null ? 'Dispersal Target' : `Dispersal: ${name}`,
    symbol: `D${slot}`,
    description:
      slot === 1
        ? 'Applies common Augment schematics evenly to selected actions. Adds one action selection slot.'
        : name === null
          ? 'Adds one action selection slot for Augment dispersal.'
          : `Applies ${name.toLowerCase()} Augment schematics too.`,
    currency: 'automationPoints',
    branch: BRANCH_DISPERSAL,
    ...(i > 0 ? { parents: [automationSkillId(BRANCH_DISPERSAL, i)] } : {}),
    cost: num(1),
    effect:
      slot === 1
        ? { kind: 'unlocksAutomation', feature: 'dispersal', allowsDispersal: 'common', dispersalSlots: 1 }
        : rarity === null
          ? { kind: 'dispersalSlots', count: 1 }
          : { kind: 'allowsDispersal', rarity },
  };
});
