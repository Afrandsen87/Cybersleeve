/**
 * @module content
 * Resleeve context: the ungated trunk of sleeve skills.
 * Called by: resleeveSkills.ts. Calls: num.
 */
import type { BuyableDefinition } from '../../../core';
import { num } from '../../../numbers';
import { BRANCH_SLEEVE_UP, SKILL_SLEEVE_UP } from '../../ids';
/** Root purchase. Called by: resleeveSkillsBuyables. Calls: num. */
export const sleeveUpSkills: BuyableDefinition[] = [
  {
    id: SKILL_SLEEVE_UP,
    name: 'Sleeve Up!',
    symbol: 'SU',
    description: 'The start of every path of sleeve skills. Buying sleeve skills opens new purchases from your second sleeve on.',
    currency: 'resleevePoints',
    branch: BRANCH_SLEEVE_UP,
    cost: num(1),
    effect: { kind: 'sleeveUp' },
  },
];
