/**
 * @module content
 *
 * The skills of the leverage branch (Kompromat), bought with skill points.
 */
import type { BuyableDefinition } from '../../../core';
import { num } from '../../../numbers';
import {
  BRANCH_LEVERAGE,
  KOMPROMAT,
  KOMPROMAT_HARVEST,
  SKILL_BACK_CHANNEL,
  SKILL_EXPLOIT_KOMPROMAT,
  SKILL_NOSE_FOR_SECRETS,
} from '../../ids';

/**
 * The leverage branch: Nose for Secrets is the root; Exploit Kompromat and Back Channel Deals grow from it. All three are masked until
 * Kompromat harvest is owned (the reveal gate `requires`; the children also inherit the root's masking through `parents`).
 */
export const leverageSkills: BuyableDefinition[] = [
  {
    id: SKILL_NOSE_FOR_SECRETS,
    name: 'Nose for Secrets',
    symbol: 'NF',
    description: 'Doubles the chance that a run drops a Kompromat file.',
    currency: 'skillPoints',
    branch: BRANCH_LEVERAGE,
    requires: [KOMPROMAT_HARVEST],
    cost: num(1),
    effect: { kind: 'itemDropChanceMultiplier', itemId: KOMPROMAT, factor: 2 },
  },

  {
    id: SKILL_EXPLOIT_KOMPROMAT,
    name: 'Exploit Kompromat',
    symbol: 'EK',
    description: 'Each uncommon Kompromat file you hold raises node payout by 1%.',
    currency: 'skillPoints',
    branch: BRANCH_LEVERAGE,
    parents: [SKILL_NOSE_FOR_SECRETS],
    requires: [KOMPROMAT_HARVEST],
    cost: num(1),
    effect: { kind: 'nodePayoutFromItems', itemId: KOMPROMAT, rarityId: 'uncommon', perItem: 0.01 },
  },

  {
    id: SKILL_BACK_CHANNEL,
    name: 'Back Channel Deals',
    symbol: 'BC',
    description: 'Give up common Kompromat files for Moles. Each Mole is one point of heat that cools down 200% faster.',
    currency: 'skillPoints',
    branch: BRANCH_LEVERAGE,
    parents: [SKILL_NOSE_FOR_SECRETS],
    requires: [KOMPROMAT_HARVEST],
    cost: num(1),
    // 5 Moles per file given up; while Moles remain the heat cools 200% faster
    effect: { kind: 'backChannel', itemId: KOMPROMAT, rarityId: 'common', molesPerItem: 5, cooldownBoost: 2 },
  },
];
