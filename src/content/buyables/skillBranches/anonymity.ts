/**
 * @module content
 *
 * The skills of the anonymity branch (heat and traces), bought with skill points.
 */
import type { BuyableDefinition } from '../../../core';
import { num } from '../../../numbers';
import {
  BRANCH_ANONYMITY,
  LEGEND,
  PUSH_MALWARE,
  SKILL_COLD_TRAIL,
  SKILL_OBFUSCATION,
  SKILL_PURGE_PROTOCOL,
  overclockUnlockId,
} from '../../ids';

/** The anonymity branch: Cold Trail is the root, then Obfuscation, then Purge Protocol. */
export const anonymitySkills: BuyableDefinition[] = [
  {
    id: SKILL_COLD_TRAIL,
    name: 'Cold Trail',
    symbol: 'CT',
    description: 'Heat cools down 5% faster.',
    currency: 'skillPoints',
    branch: BRANCH_ANONYMITY,
    cost: num(1),
    effect: { kind: 'heatCooldownSpeed', factor: 1.05 },
  },

  {
    id: SKILL_OBFUSCATION,
    name: 'Obfuscation',
    symbol: 'OB',
    description: 'Lowers the heat Push malware makes per overclocked run from 3x to 2x.',
    currency: 'skillPoints',
    branch: BRANCH_ANONYMITY,
    parents: [SKILL_COLD_TRAIL],
    requires: [overclockUnlockId(PUSH_MALWARE)], // reveal gate: the purchase that makes it useful
    cost: num(1),
    effect: { kind: 'overclockHeatFactor', targetActionId: PUSH_MALWARE, factor: 2 },
  },

  {
    id: SKILL_PURGE_PROTOCOL,
    name: 'Purge Protocol',
    symbol: 'PP',
    description: 'Each heat cooldown cycle removes 1 more heat for every sleeve level of Build Legend.',
    currency: 'skillPoints',
    branch: BRANCH_ANONYMITY,
    parents: [SKILL_OBFUSCATION],
    cost: num(1), // placeholder; a late-stage skill, since sleeve levels of Build Legend come slowly
    effect: { kind: 'heatCooldownAmountFromSleeveLevel', sourceActionId: LEGEND, perLevel: 1 },
  },
];
