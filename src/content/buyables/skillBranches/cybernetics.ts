/**
 * @module content
 *
 * The skills of the cybernetics branch (speed, payout and learning), bought with skill points.
 */
import type { BuyableDefinition } from '../../../core';
import { num } from '../../../numbers';
import { BRANCH_CYBERNETICS, SKILL_BANDWIDTH, SKILL_MUSCLE_MEMORY, SKILL_OVERCLOCK, SKILL_QUICK_STUDY } from '../../ids';

/** The cybernetics branch: Overclocked Cortex is the root; Bandwidth Leech and Muscle Memory grow from it, Quick Study from Muscle Memory. */
export const cyberneticsSkills: BuyableDefinition[] = [
  {
    id: SKILL_OVERCLOCK,
    name: 'Overclocked Cortex',
    symbol: 'OC',
    description: 'Raises interface speed by 5%.',
    currency: 'skillPoints',
    branch: BRANCH_CYBERNETICS,
    cost: num(1),
    effect: { kind: 'interfaceSpeedMultiplier', factor: 1.05 },
  },

  {
    id: SKILL_BANDWIDTH,
    name: 'Bandwidth Leech',
    symbol: 'BL',
    description: 'Raises node payout by 10%.',
    currency: 'skillPoints',
    branch: BRANCH_CYBERNETICS,
    parents: [SKILL_OVERCLOCK],
    cost: num(1),
    effect: { kind: 'nodePayoutMultiplier', factor: 1.1 },
  },

  {
    id: SKILL_MUSCLE_MEMORY,
    name: 'Muscle Memory',
    symbol: 'MM',
    description: 'Raises Hacking Proficiency by 5%.',
    currency: 'skillPoints',
    branch: BRANCH_CYBERNETICS,
    parents: [SKILL_OVERCLOCK],
    cost: num(1),
    effect: { kind: 'hackingProficiencyMultiplier', factor: 1.05 },
  },

  {
    id: SKILL_QUICK_STUDY,
    name: 'Quick Study',
    symbol: 'QS',
    description: 'Every action level needs 1% less XP.',
    currency: 'skillPoints',
    branch: BRANCH_CYBERNETICS,
    parents: [SKILL_MUSCLE_MEMORY],
    cost: num(1),
    effect: { kind: 'actionXpReduction', amount: 0.01 },
  },
];
