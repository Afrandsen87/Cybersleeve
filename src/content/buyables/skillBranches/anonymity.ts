/**
 * @module content
 *
 * The skills of the anonymity branch (heat and traces), bought with skill points.
 *
 * Shape: Cold Trail is the root and splits into three lanes, each a straight line. Cooling: Obfuscation, Purge Protocol, Blackout (the end
 * skill). Burn leads: Scorched Earth, Silver Tongue. Idle: Quiet Hours, Undercover.
 */
import type { BuyableDefinition } from '../../../core';
import { num } from '../../../numbers';
import {
  BRANCH_ANONYMITY,
  BURN_LEAD,
  BURN_LEADS,
  GROW_NETWORK,
  LEGEND,
  PUSH_MALWARE,
  SKILL_BLACKOUT,
  SLEEVE_LEVELS,
  SKILL_COLD_TRAIL,
  SKILL_OBFUSCATION,
  SKILL_PURGE_PROTOCOL,
  SKILL_QUIET_HOURS,
  SKILL_SCORCHED_EARTH,
  SKILL_SILVER_TONGUE,
  SKILL_UNDERCOVER,
  overclockUnlockId,
} from '../../ids';

/** The anonymity branch: Cold Trail is the root; see the module comment for the paths. */
export const anonymitySkills: BuyableDefinition[] = [
  {
    id: SKILL_COLD_TRAIL,
    name: 'Cold Trail',
    symbol: 'CT',
    description: 'Heat cools down 25% faster.',
    currency: 'skillPoints',
    branch: BRANCH_ANONYMITY,
    cost: num(1),
    effect: { kind: 'heatCooldownSpeed', factor: 1.25 },
  },

  {
    id: SKILL_OBFUSCATION,
    name: 'Obfuscation',
    symbol: 'OB',
    description: 'Lowers the heat Push malware makes per overclocked run that makes heat from 3x to 2x.',
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
    requires: [SLEEVE_LEVELS], // reveal gate: sleeve levels exist once re-sleeving is unlocked
    cost: num(1), // placeholder; a late-stage skill, since sleeve levels of Build Legend come slowly
    effect: { kind: 'heatCooldownAmountFromSleeveLevel', sourceActionId: LEGEND, perLevel: 1 },
  },

  {
    id: SKILL_SCORCHED_EARTH,
    name: 'Scorched Earth',
    symbol: 'SC',
    description: 'Each Burn lead takes 1 more point of heat away, after its percentage.',
    currency: 'skillPoints',
    branch: BRANCH_ANONYMITY,
    parents: [SKILL_COLD_TRAIL],
    requires: [BURN_LEADS], // reveal gate: the purchase that makes Burn leads drop
    cost: num(1),
    effect: { kind: 'burnLeadFlatHeat', amount: 1 },
  },

  {
    id: SKILL_SILVER_TONGUE,
    name: 'Silver Tongue',
    symbol: 'SV',
    description: 'Burn leads drop 50% more often.',
    currency: 'skillPoints',
    branch: BRANCH_ANONYMITY,
    parents: [SKILL_SCORCHED_EARTH],
    cost: num(1),
    effect: { kind: 'itemDropChanceMultiplier', itemId: BURN_LEAD, factor: 1.5 },
  },

  {
    id: SKILL_QUIET_HOURS,
    name: 'Quiet Hours',
    symbol: 'QH',
    description:
      'While nothing is running, heat cools 5 times as fast. An action counts as running from its start until its run completes; a manual action that has finished and waits counts as idle.',
    currency: 'skillPoints',
    branch: BRANCH_ANONYMITY,
    parents: [SKILL_COLD_TRAIL],
    cost: num(1),
    effect: { kind: 'idleHeatCooldown', factor: 5 }, // placeholder strength; it may need to be much higher
  },

  {
    id: SKILL_UNDERCOVER,
    name: 'Undercover',
    symbol: 'UC',
    description: 'Quiet Hours also counts while Grow network runs without Overclock, as if nothing were running.',
    currency: 'skillPoints',
    branch: BRANCH_ANONYMITY,
    parents: [SKILL_QUIET_HOURS],
    cost: num(1),
    effect: { kind: 'idleHeatCooldownAction', actionId: GROW_NETWORK },
  },

  {
    id: SKILL_BLACKOUT,
    name: 'Blackout',
    symbol: 'BO',
    description: 'The heat tax takes at most half of your node income, however hot you are.',
    currency: 'skillPoints',
    branch: BRANCH_ANONYMITY,
    parents: [SKILL_PURGE_PROTOCOL],
    cost: num(1),
    effect: { kind: 'heatTaxCap', maxShare: 0.5 },
  },
];
