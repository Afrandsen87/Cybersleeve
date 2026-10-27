/**
 * @module content
 *
 * The reach lane of the re-sleeve skills: XP, access and focus. Sleeve Euphoria is the root; each skill needs the one before.
 */
import type { BuyableDefinition } from '../../../core';
import { num } from '../../../numbers';
import { BRANCH_REACH, SKILL_CLEARANCE_ESCALATION, SKILL_DEEP_CONDITIONING, SKILL_OVERDRIVE_CAP, SKILL_SLEEVE_EUPHORIA } from '../../ids';

/** The reach lane, root first. Prices rise down the lane. */
export const reachSkills: BuyableDefinition[] = [
  {
    id: SKILL_SLEEVE_EUPHORIA,
    name: 'Sleeve Euphoria',
    symbol: 'SE',
    description:
      "Every action level needs less XP the higher that action's sleeve level is: half as much at sleeve level 10, a quarter at 100.",
    formula: 'XP Needed = Normal XP x 0.5 ^ log10(Sleeve Level of the action)',
    currency: 'resleevePoints',
    branch: BRANCH_REACH,
    cost: num(1),
    // each order of magnitude of sleeve level halves what is left: 50% less at level 10, 75% less at level 100; never more than 99.9% less
    effect: { kind: 'actionXpReductionFromSleeveLevel', remainingPerOrder: 0.5, maxReduction: 0.999 },
  },
  {
    id: SKILL_DEEP_CONDITIONING,
    name: 'Deep Conditioning',
    symbol: 'DN',
    description: 'Faster conditioning can be bought 5 more times, taking sleeve XP down to a batch of only 5 runs.',
    currency: 'resleevePoints',
    branch: BRANCH_REACH,
    cost: num(2),
    parents: [SKILL_SLEEVE_EUPHORIA],
    effect: { kind: 'placeholder' },
  },
  {
    id: SKILL_CLEARANCE_ESCALATION,
    name: 'Clearance Escalation',
    symbol: 'CE',
    description: 'Allows one more Access upgrade, so a sixth access level can be reached.',
    currency: 'resleevePoints',
    branch: BRANCH_REACH,
    cost: num(3),
    parents: [SKILL_DEEP_CONDITIONING],
    effect: { kind: 'placeholder' },
  },
  {
    id: SKILL_OVERDRIVE_CAP,
    name: 'Overdrive Cap',
    symbol: 'OD',
    description:
      'Several Focus slots can sit on the same action. Focus buttons split into add and remove; every slot on an action makes it run 25% faster again.',
    currency: 'resleevePoints',
    branch: BRANCH_REACH,
    cost: num(3),
    parents: [SKILL_CLEARANCE_ESCALATION],
    effect: { kind: 'placeholder' },
  },
];
