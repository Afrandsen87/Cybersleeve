/**
 * @module content
 *
 * The corporation lane of the re-sleeve skills: where prestige moves once re-sleeving stops paying. Incorporation is the root.
 */
import type { BuyableDefinition } from '../../../core';
import { num } from '../../../numbers';
import { BRANCH_CORPORATION, SKILL_INCORPORATION, SKILL_SYNTHETIC_PROCUREMENT, SKILL_SYNTHETIC_WORKERS } from '../../ids';

/** The corporation lane, root first. Prices rise down the lane. */
export const corporationSkills: BuyableDefinition[] = [
  {
    id: SKILL_INCORPORATION,
    name: 'Incorporation',
    symbol: 'IN',
    description: 'Founds a corporation: opens the Corporation tab.',
    currency: 'resleevePoints',
    branch: BRANCH_CORPORATION,
    cost: num(1),
    effect: { kind: 'unlocksCorporation' },
  },
  {
    id: SKILL_SYNTHETIC_WORKERS,
    name: 'Synthetic Workers',
    symbol: 'SW',
    description: 'The more synthetic sleeves you have, the faster corporation actions run.',
    formula: 'Corporation run speed x (1 + ln(1 + synthetic sleeves) / 10)',
    currency: 'resleevePoints',
    branch: BRANCH_CORPORATION,
    cost: num(2),
    parents: [SKILL_INCORPORATION],
    effect: { kind: 'placeholder' },
  },
  {
    id: SKILL_SYNTHETIC_PROCUREMENT,
    name: 'Synthetic Procurement',
    symbol: 'SP',
    description: 'Unlocks buying new synthetic sleeves on the Corporation tab.',
    currency: 'resleevePoints',
    branch: BRANCH_CORPORATION,
    cost: num(3),
    parents: [SKILL_SYNTHETIC_WORKERS],
    effect: { kind: 'placeholder' },
  },
];
