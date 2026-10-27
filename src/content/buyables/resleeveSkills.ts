/**
 * @module content
 *
 * The buyables of re-sleeve skills (bought with re-sleeve points).
 */
import type { BuyableDefinition } from '../../core';
import { num } from '../../numbers';
import { SKILL_SLEEVE_EUPHORIA, SKILL_SYNTHETIC_SLEEVES, SKILL_INCORPORATION } from '../ids';

/** The buyables of re-sleeve skills (bought with re-sleeve points). */
export const resleeveSkillsBuyables: BuyableDefinition[] = [
  // Re-sleeve skills: bought with re-sleeve points (one per re-sleeve), kept through re-sleeving, laid out as a tree through `parents`.
  {
    id: SKILL_SLEEVE_EUPHORIA,
    name: 'Sleeve Euphoria',
    symbol: 'SE',
    description:
      "Every action level needs less XP the higher that action's sleeve level is: half as much at sleeve level 10, a quarter at 100.",
    formula: 'XP Needed = Normal XP x 0.5 ^ log10(Sleeve Level of the action)',
    currency: 'resleevePoints',
    cost: num(1),
    // each order of magnitude of sleeve level halves what is left: 50% less at level 10, 75% less at level 100; never more than 99.9% less
    effect: { kind: 'actionXpReductionFromSleeveLevel', remainingPerOrder: 0.5, maxReduction: 0.999 },
  },

  {
    id: SKILL_SYNTHETIC_SLEEVES,
    name: 'Synthetic Sleeves',
    symbol: 'SS',
    description:
      'Run extra sleeves beside this one. You get one now, copied from your last sleeve-run, and one more with every re-sleeve. Each earns the credits per second its run ended with, scaled by how many action levels you have compared to then, until you catch up.',
    currency: 'resleevePoints',
    cost: num(1),
    parents: [SKILL_SLEEVE_EUPHORIA],
    effect: { kind: 'synthSleeves' },
  },

  {
    id: SKILL_INCORPORATION,
    name: 'Incorporation',
    symbol: 'IN',
    description: 'Founds a corporation: opens the Corporation tab.',
    currency: 'resleevePoints',
    cost: num(1),
    parents: [SKILL_SLEEVE_EUPHORIA],
    effect: { kind: 'unlocksCorporation' },
  },
];
