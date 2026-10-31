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
        /** Relative weight of each rarity once a file drops: 90% common, 10% uncommon; nothing rarer can drop at first. */
        rarityWeights: { common: 90, uncommon: 10, rare: 0, legendary: 0, crisis: 0 },
      },
    },
  },

  {
    id: SKILL_TRANSFER,
    name: 'Skill transfer',
    symbol: 'ST',
    description: "Adds Practice Hacking's sleeve level to Grow network's level, which raises its speed.",
    actionId: PRACTICE_HACKING,
    cost: num(1_000_000),
    requiresSleeveSkills: 1, // opens after buying the first sleeve skill
    effect: { kind: 'levelBonusFromSleeveLevel', sourceActionId: PRACTICE_HACKING, targetActionId: GROW_NETWORK },
  },

  {
    id: STUDY_METHODS,
    name: 'Study methods',
    symbol: 'SM',
    description: 'The XP every sleeve level of the other actions needs is divided by 1 plus the sleeve level of Practice Hacking.',
    actionId: PRACTICE_HACKING,
    cost: num(1e15),
    requires: [SLEEVE_LEVELS], // reveal gate: sleeve levels exist once the Sleeve levels upgrade is owned
    requiresSleeveSkills: 1, // opens after buying the first sleeve skill
    // divisor = 1 + perLevel x Practice Hacking sleeve level: perLevel 1 halves the XP at level 1; there is no ceiling
    effect: { kind: 'sleeveXpReduction', sourceActionId: PRACTICE_HACKING, perLevel: 1 },
  },

  overclockUnlock(PRACTICE_HACKING, 'Unlocks Overclock for this action: pays 200% more, but each completed run costs 5 nodes.'),

  focusUnlock(PRACTICE_HACKING),
];
