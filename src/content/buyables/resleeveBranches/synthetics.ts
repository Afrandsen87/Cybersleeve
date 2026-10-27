/**
 * @module content
 *
 * The synthetics lane of the re-sleeve skills: synthetic sleeves growing into copies of you. Synthetic Sleeves is the root.
 */
import type { BuyableDefinition } from '../../../core';
import { num } from '../../../numbers';
import {
  BRANCH_SYNTHETICS,
  SKILL_CLONING_VATS,
  SKILL_HIVE_INTERFACE,
  SKILL_NEURAL_MIRROR,
  SKILL_PERFECT_COPIES,
  SKILL_SYNTHETIC_SLEEVES,
} from '../../ids';

/** The synthetics lane, root first. Prices rise down the lane. */
export const syntheticsSkills: BuyableDefinition[] = [
  {
    id: SKILL_SYNTHETIC_SLEEVES,
    name: 'Synthetic Sleeves',
    symbol: 'SS',
    description:
      'Run extra sleeves beside this one. You get one now, copied from your last sleeve-run, and one more with every re-sleeve. Each earns the credits per second its run ended with, scaled by how many action levels you have compared to then, until you catch up.',
    currency: 'resleevePoints',
    branch: BRANCH_SYNTHETICS,
    cost: num(1),
    effect: { kind: 'synthSleeves' },
  },
  {
    id: SKILL_CLONING_VATS,
    name: 'Cloning Vats',
    symbol: 'CV',
    description: 'Every re-sleeve gives two synthetic sleeves instead of one.',
    currency: 'resleevePoints',
    branch: BRANCH_SYNTHETICS,
    cost: num(2),
    parents: [SKILL_SYNTHETIC_SLEEVES],
    effect: { kind: 'placeholder' },
  },
  {
    id: SKILL_HIVE_INTERFACE,
    name: 'Hive Interface',
    symbol: 'HI',
    description: 'The more synthetic sleeves you have, the faster every action runs.',
    formula: 'Base interface speed x (1 + ln(1 + synthetic sleeves) / 10)',
    currency: 'resleevePoints',
    branch: BRANCH_SYNTHETICS,
    cost: num(2),
    parents: [SKILL_CLONING_VATS],
    effect: { kind: 'placeholder' },
  },
  {
    id: SKILL_NEURAL_MIRROR,
    name: 'Neural Mirror',
    symbol: 'NM',
    description:
      'An action whose level is below the level your best synthetic sleeve reached on it earns 25% more action XP, until you catch up.',
    currency: 'resleevePoints',
    branch: BRANCH_SYNTHETICS,
    cost: num(3),
    parents: [SKILL_HIVE_INTERFACE],
    effect: { kind: 'placeholder' },
  },
  {
    id: SKILL_PERFECT_COPIES,
    name: 'Perfect Copies',
    symbol: 'PC',
    description:
      'Every synthetic sleeve earns what your own network earns right now, however far you have come: your credits per second are multiplied by one plus the number of synthetic sleeves.',
    currency: 'resleevePoints',
    branch: BRANCH_SYNTHETICS,
    cost: num(5),
    parents: [SKILL_NEURAL_MIRROR],
    effect: { kind: 'placeholder' },
  },
];
