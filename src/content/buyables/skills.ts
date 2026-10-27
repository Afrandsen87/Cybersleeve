/**
 * @module content
 *
 * The buyables of skills (bought with skill points).
 */
import type { BuyableDefinition } from '../../core';
import { num } from '../../numbers';
import {
  PUSH_MALWARE,
  LEGEND,
  SKILL_OVERCLOCK,
  SKILL_BANDWIDTH,
  SKILL_COLD_TRAIL,
  SKILL_MUSCLE_MEMORY,
  SKILL_QUICK_STUDY,
  SKILL_NOSE_FOR_SECRETS,
  SKILL_EXPLOIT_KOMPROMAT,
  SKILL_BACK_CHANNEL,
  SKILL_OBFUSCATION,
  SKILL_PURGE_PROTOCOL,
  KOMPROMAT_HARVEST,
  KOMPROMAT,
  overclockUnlockId,
} from '../ids';

/** The buyables of skills (bought with skill points). */
export const skillsBuyables: BuyableDefinition[] = [
  // Skills: bought with skill points (one point each for now), shown in the Skills tab. No actionId.
  {
    id: SKILL_OVERCLOCK,
    name: 'Overclocked Cortex',
    symbol: 'OC',
    description: 'Raises interface speed by 5%.',
    currency: 'skillPoints',
    cost: num(1),
    effect: { kind: 'interfaceSpeedMultiplier', factor: 1.05 },
  },

  {
    id: SKILL_BANDWIDTH,
    name: 'Bandwidth Leech',
    symbol: 'BL',
    description: 'Raises node payout by 10%.',
    currency: 'skillPoints',
    cost: num(1),
    effect: { kind: 'nodePayoutMultiplier', factor: 1.1 },
  },

  {
    id: SKILL_COLD_TRAIL,
    name: 'Cold Trail',
    symbol: 'CT',
    description: 'Heat cools down 5% faster.',
    currency: 'skillPoints',
    cost: num(1),
    effect: { kind: 'heatCooldownSpeed', factor: 1.05 },
  },

  {
    id: SKILL_MUSCLE_MEMORY,
    name: 'Muscle Memory',
    symbol: 'MM',
    description: 'Raises Hacking Proficiency by 5%.',
    currency: 'skillPoints',
    cost: num(1),
    effect: { kind: 'hackingProficiencyMultiplier', factor: 1.05 },
  },

  {
    id: SKILL_QUICK_STUDY,
    name: 'Quick Study',
    symbol: 'QS',
    description: 'Every action level needs 1% less XP.',
    currency: 'skillPoints',
    cost: num(1),
    effect: { kind: 'actionXpReduction', amount: 0.01 },
  },

  {
    id: SKILL_NOSE_FOR_SECRETS,
    name: 'Nose for Secrets',
    symbol: 'NF',
    description: 'Doubles the chance that a run drops a Kompromat file.',
    currency: 'skillPoints',
    requires: [KOMPROMAT_HARVEST], // only offered once the purchase that makes it useful is owned
    cost: num(1),
    effect: { kind: 'itemDropChanceMultiplier', itemId: KOMPROMAT, factor: 2 },
  },

  {
    id: SKILL_EXPLOIT_KOMPROMAT,
    name: 'Exploit Kompromat',
    symbol: 'EK',
    description: 'Each uncommon Kompromat file you hold raises node payout by 1%.',
    currency: 'skillPoints',
    requires: [KOMPROMAT_HARVEST], // only offered once the purchase that makes it useful is owned
    cost: num(1),
    effect: { kind: 'nodePayoutFromItems', itemId: KOMPROMAT, rarityId: 'uncommon', perItem: 0.01 },
  },

  {
    id: SKILL_BACK_CHANNEL,
    name: 'Back Channel Deals',
    symbol: 'BC',
    description: 'Give up common Kompromat files for Moles. Each Mole is one point of heat that cools down 200% faster.',
    currency: 'skillPoints',
    requires: [KOMPROMAT_HARVEST], // only offered once the purchase that makes it useful is owned
    cost: num(1),
    // 5 Moles per file given up; while Moles remain the heat cools 200% faster
    effect: { kind: 'backChannel', itemId: KOMPROMAT, rarityId: 'common', molesPerItem: 5, cooldownBoost: 2 },
  },

  {
    id: SKILL_OBFUSCATION,
    name: 'Obfuscation',
    symbol: 'OB',
    description: 'Lowers the heat Push malware makes per overclocked run from 3x to 2x.',
    currency: 'skillPoints',
    requires: [overclockUnlockId(PUSH_MALWARE)], // only offered once the purchase that makes it useful is owned
    cost: num(1),
    effect: { kind: 'overclockHeatFactor', targetActionId: PUSH_MALWARE, factor: 2 },
  },

  {
    id: SKILL_PURGE_PROTOCOL,
    name: 'Purge Protocol',
    symbol: 'PP',
    description: 'Each heat cooldown cycle removes 1 more heat for every sleeve level of Build Legend.',
    currency: 'skillPoints',
    cost: num(1), // placeholder; a late-stage skill, since sleeve levels of Build Legend come slowly
    effect: { kind: 'heatCooldownAmountFromSleeveLevel', sourceActionId: LEGEND, perLevel: 1 },
  },
];
