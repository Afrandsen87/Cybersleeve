/**
 * @module content
 *
 * The buyables of Practice Hacking.
 */
import type { BuyableDefinition } from '../../core';
import { num } from '../../numbers';
import {
  PRACTICE_HACKING,
  GROW_NETWORK,
  AUTO_RUN,
  SKILL_TRANSFER,
  STUDY_METHODS,
  KOMPROMAT_HARVEST,
  KOMPROMAT,
  RARITY_REFINEMENT,
  SLEEVE_LEVELS,
} from '../ids';
import { autoRunCost, overclockUnlock, focusUnlock } from './helpers';

/** The buyables of Practice Hacking. */
export const practiceHackingBuyables: BuyableDefinition[] = [
  {
    id: AUTO_RUN,
    name: 'Auto-run',
    symbol: '↻',
    description: 'Restarts the action automatically when it finishes.',
    actionId: PRACTICE_HACKING,
    cost: num(autoRunCost(PRACTICE_HACKING)),
    effect: { kind: 'autoRun' },
  },

  {
    id: KOMPROMAT_HARVEST,
    name: 'Kompromat harvest',
    symbol: 'KH',
    description: 'Each completed run has a chance to drop a Kompromat file, which can be sold from the Inventory.',
    actionId: PRACTICE_HACKING,
    cost: num(500),
    effect: {
      kind: 'itemDrop',
      drop: {
        itemId: KOMPROMAT,
        /** Chance that one completed run drops a file at all: 5%. */
        chance: 0.05,
        /** Relative weight of each rarity once a file drops: 90% common, 9% uncommon, 1% rare. */
        rarityWeights: { common: 90, uncommon: 9, rare: 1, legendary: 0, crisis: 0 },
      },
    },
  },

  {
    id: RARITY_REFINEMENT,
    name: 'Rarity refinement',
    symbol: 'RR',
    description: 'Increases the rarity of Kompromat drops based on Hacking Proficiency.',
    actionId: PRACTICE_HACKING,
    cost: num(10_000),
    requires: [KOMPROMAT_HARVEST],
    // fractionPerOrder 0.01: each shift moves 1% of every rarity's weight on to the next rarity, all worked out up front and moved at once
    effect: { kind: 'rarityShiftFromProficiency', fractionPerOrder: 0.01 },
  },

  {
    id: SKILL_TRANSFER,
    name: 'Skill transfer',
    symbol: 'ST',
    description: "Adds Practice Hacking's sleeve level to Grow network's level, which raises its speed.",
    actionId: PRACTICE_HACKING,
    cost: num(1_000_000),
    revealAfterResleeves: 1, // from the second sleeve run on
    effect: { kind: 'levelBonusFromSleeveLevel', sourceActionId: PRACTICE_HACKING, targetActionId: GROW_NETWORK },
  },

  {
    id: STUDY_METHODS,
    name: 'Study methods',
    symbol: 'SM',
    description: 'Every sleeve level of the other actions needs 0.01% less XP for each sleeve level of Practice Hacking, up to 25% less.',
    actionId: PRACTICE_HACKING,
    cost: num(1e15),
    requires: [SLEEVE_LEVELS], // reveal gate: sleeve levels exist once re-sleeving is unlocked
    // perLevel 0.0001 = 0.01 percent per sleeve level (the cap is reached at level 2500); maxReduction 0.25 = at most 25 percent
    effect: { kind: 'sleeveXpReduction', sourceActionId: PRACTICE_HACKING, perLevel: 0.0001, maxReduction: 0.25 },
  },

  overclockUnlock(PRACTICE_HACKING, 'Unlocks Overclock for this action: pays 200% more, but each completed run costs 5 nodes.'),

  focusUnlock(PRACTICE_HACKING),
];
