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
  PUSH_MALWARE,
  SKILL_BACK_CHANNEL,
  SKILL_BLACK_LEDGER,
  SKILL_DEEP_COVER,
  SKILL_DEEP_FILES,
  SKILL_DOSSIER,
  SKILL_DOUBLE_AGENT,
  SKILL_EXPLOIT_KOMPROMAT,
  SKILL_NOSE_FOR_SECRETS,
  SKILL_SEALED_ARCHIVES,
  SKILL_TIERED_INFORMANTS,
  overclockUnlockId,
} from '../../ids';

/**
 * The leverage branch: Nose for Secrets is the root; Deep Files (then Sealed Archives, then Black Ledger), Exploit Kompromat (then Dossier) and Back Channel Deals (then Tiered
 * Informants, Double Agent, then Deep Cover) grow from it. All of them are masked until
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
    description: 'Each rare Kompromat file you hold raises node payout by 1%.',
    currency: 'skillPoints',
    branch: BRANCH_LEVERAGE,
    parents: [SKILL_NOSE_FOR_SECRETS],
    requires: [KOMPROMAT_HARVEST],
    cost: num(1),
    effect: { kind: 'nodePayoutFromItems', itemId: KOMPROMAT, rarityId: 'rare', perItem: 0.01 },
  },

  {
    id: SKILL_BACK_CHANNEL,
    name: 'Back Channel Deals',
    symbol: 'BC',
    description: 'Give up common Kompromat files for Moles. Each Mole is one point of heat that cools down 200% faster.',
    currency: 'skillPoints',
    branch: BRANCH_LEVERAGE,
    parents: [SKILL_NOSE_FOR_SECRETS],
    requires: [KOMPROMAT_HARVEST, overclockUnlockId(PUSH_MALWARE)], // Moles are heat: wait for the Overclock that makes heat
    cost: num(1),
    // 5 Moles per file given up; while Moles remain the heat cools 200% faster
    effect: { kind: 'backChannel', itemId: KOMPROMAT, rarityId: 'common', molesPerItem: 5, cooldownBoost: 2 },
  },

  {
    id: SKILL_DEEP_FILES,
    name: 'Deep Files',
    symbol: 'DF',
    description: 'Adds 0.1% to the drop chance of rare Kompromat files, which cannot drop without it.',
    currency: 'skillPoints',
    branch: BRANCH_LEVERAGE,
    parents: [SKILL_NOSE_FOR_SECRETS],
    requires: [KOMPROMAT_HARVEST],
    cost: num(1),
    // weights add up to 100, so 0.1 is 0.1 percentage points, also for a rarity that weighs 0
    effect: { kind: 'rarityWeightBonus', itemId: KOMPROMAT, rarityId: 'rare', amount: 0.1 },
  },

  {
    id: SKILL_SEALED_ARCHIVES,
    name: 'Sealed Archives',
    symbol: 'AR',
    description: 'Adds 0.1% to the drop chance of legendary Kompromat files, which cannot drop without it.',
    currency: 'skillPoints',
    branch: BRANCH_LEVERAGE,
    parents: [SKILL_DEEP_FILES],
    requires: [KOMPROMAT_HARVEST],
    cost: num(1),
    effect: { kind: 'rarityWeightBonus', itemId: KOMPROMAT, rarityId: 'legendary', amount: 0.1 },
  },

  {
    id: SKILL_BLACK_LEDGER,
    name: 'Black Ledger',
    symbol: 'LE',
    description: 'Adds 0.1% to the drop chance of crisis Kompromat files, which cannot drop without it.',
    currency: 'skillPoints',
    branch: BRANCH_LEVERAGE,
    parents: [SKILL_SEALED_ARCHIVES],
    requires: [KOMPROMAT_HARVEST],
    cost: num(1),
    effect: { kind: 'rarityWeightBonus', itemId: KOMPROMAT, rarityId: 'crisis', amount: 0.1 },
  },

  {
    id: SKILL_DOSSIER,
    name: 'Dossier',
    symbol: 'DO',
    description: 'Each legendary Kompromat file you hold raises node payout by 5%.',
    currency: 'skillPoints',
    branch: BRANCH_LEVERAGE,
    parents: [SKILL_EXPLOIT_KOMPROMAT],
    requires: [KOMPROMAT_HARVEST],
    cost: num(1),
    effect: { kind: 'nodePayoutFromItems', itemId: KOMPROMAT, rarityId: 'legendary', perItem: 0.05 },
  },

  {
    id: SKILL_TIERED_INFORMANTS,
    name: 'Tiered Informants',
    symbol: 'TI',
    description:
      'Back channel takes files of every rarity, and the rarer the file the more Moles it pays: x2 for uncommon, x3 for rare, and so on.',
    currency: 'skillPoints',
    branch: BRANCH_LEVERAGE,
    parents: [SKILL_BACK_CHANNEL],
    requires: [KOMPROMAT_HARVEST],
    cost: num(1),
    effect: { kind: 'backChannelRarityScaling', itemId: KOMPROMAT },
  },

  {
    id: SKILL_DOUBLE_AGENT,
    name: 'Double Agent',
    symbol: 'DA',
    description: 'Back channel pays twice the Moles for every rarity.',
    currency: 'skillPoints',
    branch: BRANCH_LEVERAGE,
    parents: [SKILL_TIERED_INFORMANTS],
    requires: [KOMPROMAT_HARVEST],
    cost: num(1),
    effect: { kind: 'backChannelMultiplier', itemId: KOMPROMAT, factor: 2 },
  },

  {
    id: SKILL_DEEP_COVER,
    name: 'Deep Cover',
    symbol: 'DC',
    description:
      'Moles stay with you instead of being spent. Heat cools 5% faster for every order of magnitude of Moles you hold, in place of the Mole boost.',
    currency: 'skillPoints',
    branch: BRANCH_LEVERAGE,
    parents: [SKILL_DOUBLE_AGENT],
    requires: [KOMPROMAT_HARVEST],
    cost: num(1),
    effect: { kind: 'moleAggregation', bonusPerOrder: 0.05 },
  },
];
