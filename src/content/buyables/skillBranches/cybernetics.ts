/**
 * @module content
 *
 * The skills of the cybernetics branch (speed, payout and learning), bought with skill points.
 */
import type { BuyableDefinition } from '../../../core';
import { num } from '../../../numbers';
import {
  BRANCH_CYBERNETICS,
  CRITICAL_SUCCESS,
  GROW_NETWORK,
  PUSH_MALWARE,
  SKILL_BACKBONE_PARASITE,
  SKILL_BANDWIDTH,
  SKILL_FIBER_TAP,
  SKILL_MUSCLE_MEMORY,
  SKILL_NEURAL_ACCELERANT,
  SKILL_OVERCLOCK,
  SKILL_OVERDRIVE_SPIKE,
  SKILL_PARALLEL_THREADS,
  SKILL_QUICK_STUDY,
  SKILL_SIGNAL_AMPLIFIER,
} from '../../ids';

/**
 * The cybernetics branch: Overclocked Cortex is the root, with three arms drawn as straight lanes. Bandwidth Leech, which splits into two lanes (Signal Amplifier, Overdrive Spike; and Fiber Tap, Backbone Parasite);
 * Muscle Memory, Quick Study; Parallel Threads, Neural Accelerant.
 */
export const cyberneticsSkills: BuyableDefinition[] = [
  {
    id: SKILL_OVERCLOCK,
    name: 'Overclocked Cortex',
    symbol: 'OC',
    description: 'Raises interface speed by 25%.',
    currency: 'skillPoints',
    branch: BRANCH_CYBERNETICS,
    cost: num(1),
    effect: { kind: 'interfaceSpeedMultiplier', factor: 1.25 },
  },

  {
    id: SKILL_BANDWIDTH,
    name: 'Bandwidth Leech',
    symbol: 'BL',
    description: 'Raises node payout by 50%.',
    currency: 'skillPoints',
    branch: BRANCH_CYBERNETICS,
    parents: [SKILL_OVERCLOCK],
    cost: num(1),
    effect: { kind: 'nodePayoutMultiplier', factor: 1.5 },
  },

  {
    id: SKILL_MUSCLE_MEMORY,
    name: 'Muscle Memory',
    symbol: 'MM',
    description: 'Raises Hacking Proficiency by 25%.',
    currency: 'skillPoints',
    branch: BRANCH_CYBERNETICS,
    parents: [SKILL_OVERCLOCK],
    cost: num(1),
    effect: { kind: 'hackingProficiencyMultiplier', factor: 1.25 },
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

  {
    id: SKILL_PARALLEL_THREADS,
    name: 'Parallel Threads',
    symbol: 'PT',
    description: 'Multiplies the base interface speed by 1 + ln(nodes) / 500.',
    currency: 'skillPoints',
    branch: BRANCH_CYBERNETICS,
    parents: [SKILL_OVERCLOCK],
    cost: num(1),
    // Very slow on purpose: at the infinity cap (ln about 709) it gives about x2.4, where Network synergy (1 / 100) gives about x8.
    effect: { kind: 'interfaceSpeedPerLnNodes', perLn: 0.002 },
  },

  {
    id: SKILL_NEURAL_ACCELERANT,
    name: 'Neural Accelerant',
    symbol: 'NA',
    description: 'Raises interface speed by 5% for each distinct rarity of augment applied on any action.',
    currency: 'skillPoints',
    branch: BRANCH_CYBERNETICS,
    parents: [SKILL_PARALLEL_THREADS],
    cost: num(1),
    effect: { kind: 'interfaceSpeedFromAugmentRarities', perRarity: 0.05 },
  },

  {
    id: SKILL_SIGNAL_AMPLIFIER,
    name: 'Signal Amplifier',
    symbol: 'SG',
    description: 'Every critical success has a 5% chance to bring one extra critical success.',
    currency: 'skillPoints',
    branch: BRANCH_CYBERNETICS,
    parents: [SKILL_BANDWIDTH],
    requires: [CRITICAL_SUCCESS], // reveal gate: critical successes exist once they are bought
    cost: num(1),
    effect: { kind: 'criticalExtraChance', chance: 0.05 },
  },

  {
    id: SKILL_OVERDRIVE_SPIKE,
    name: 'Overdrive Spike',
    symbol: 'OS',
    description: 'Doubles the reward of every critical success.',
    currency: 'skillPoints',
    branch: BRANCH_CYBERNETICS,
    parents: [SKILL_SIGNAL_AMPLIFIER],
    cost: num(1),
    effect: { kind: 'criticalRewardMultiplier', factor: 2 },
  },

  {
    id: SKILL_FIBER_TAP,
    name: 'Fiber Tap',
    symbol: 'FT',
    description: 'Each completed Push malware run has a 25% chance to also pay one full Grow network reward. It cannot be critical.',
    currency: 'skillPoints',
    branch: BRANCH_CYBERNETICS,
    parents: [SKILL_BANDWIDTH],
    cost: num(1),
    // A whole reward or nothing (half a node cannot be paid), so the chance is the lever.
    effect: { kind: 'paysActionReward', sourceActionId: PUSH_MALWARE, targetActionId: GROW_NETWORK, chance: 0.25 },
  },

  {
    id: SKILL_BACKBONE_PARASITE,
    name: 'Backbone Parasite',
    symbol: 'BP',
    description: 'Multiplies the nodes each Grow network run pays, by a rising but ever flatter amount of its action level.',
    formula: 'Multiplier = 1 + 2.26 x ln(1 + action level / 18)',
    currency: 'skillPoints',
    branch: BRANCH_CYBERNETICS,
    parents: [SKILL_FIBER_TAP],
    cost: num(1),
    // About x2 at action level 10 and x4 at level 50, then ever flatter (x5.3 at 100, x10 at 1000).
    effect: {
      kind: 'rewardMultiplierFromActionLevel',
      sourceActionId: GROW_NETWORK,
      targetActionId: GROW_NETWORK,
      coefficient: 2.263,
      scale: 18,
    },
  },
];
