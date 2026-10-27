/**
 * @module content
 *
 * The buyables of Grow network.
 */
import type { BuyableDefinition } from '../../core';
import { num } from '../../numbers';
import {
  GROW_NETWORK,
  NETWORK_AUTO_RUN,
  NETWORK_OUTPUT,
  SELF_REPLICATION,
  NETWORK_SYNERGY,
  AUGMENT_SCHEMATIC,
  INDUSTRIAL_ESPIONAGE,
  BURN_LEAD,
  BURN_LEADS,
} from '../ids';
import { autoRunCost, overclockUnlock, focusUnlock } from './helpers';

/** The buyables of Grow network. */
export const growNetworkBuyables: BuyableDefinition[] = [
  {
    id: NETWORK_AUTO_RUN,
    name: 'Auto-run',
    symbol: '↻',
    description: 'Restarts the action automatically when it finishes.',
    actionId: GROW_NETWORK,
    cost: num(autoRunCost(GROW_NETWORK)),
    effect: { kind: 'autoRun' },
  },

  {
    id: NETWORK_OUTPUT,
    name: 'Parallel nodes',
    symbol: '×2',
    description: 'Doubles the nodes each run pays. Each copy costs 100x more.',
    actionId: GROW_NETWORK,
    cost: num(75),
    costGrowth: 100, // every 2nd order of magnitude
    maxPurchases: Infinity,
    effect: { kind: 'rewardMultiplier', factor: 2 },
  },

  {
    id: BURN_LEADS,
    name: 'Burn leads',
    symbol: 'BN',
    description: 'Each completed run has a chance to drop a Burn lead. Using one from the Inventory takes 5% of your current heat away.',
    actionId: GROW_NETWORK,
    // Placeholder price (balance is not tuned yet).
    cost: num(1_000),
    effect: {
      kind: 'itemDrop',
      drop: {
        itemId: BURN_LEAD,
        /** Chance that one completed run drops a lead at all: 5%. */
        chance: 0.05,
      },
    },
  },

  {
    id: INDUSTRIAL_ESPIONAGE,
    name: 'Industrial Espionage',
    symbol: 'IE',
    description: 'Each completed run has a chance to drop an Augment schematic, which can be applied to an action.',
    actionId: GROW_NETWORK,
    cost: num(10_000),
    effect: {
      kind: 'itemDrop',
      drop: {
        itemId: AUGMENT_SCHEMATIC,
        /** Chance that one completed run drops a schematic at all: 5% (placeholder, like the Kompromat numbers). */
        chance: 0.05,
        /** Relative weight of each rarity once a schematic drops: 90% common, 9% uncommon, 1% rare. */
        rarityWeights: { common: 90, uncommon: 9, rare: 1, legendary: 0, crisis: 0 },
      },
    },
  },

  {
    id: SELF_REPLICATION,
    name: 'Self-replication',
    symbol: 'SR',
    description: 'The network grows by a percentage every second.',
    formula: 'Growth factor percentage = Action level / 1000',
    actionId: GROW_NETWORK,
    cost: num(1e10),
    // percentPerLevel 0.001: level / 1000 percent per second, e.g. level 50 = 0.05% per second
    effect: { kind: 'networkGrowthFromActionLevel', sourceActionId: GROW_NETWORK, percentPerLevel: 0.001 },
  },

  {
    id: NETWORK_SYNERGY,
    name: 'Network synergy',
    symbol: 'NS',
    description: 'Multiplies the base interface speed by 1 + ln(nodes) / 100.',
    actionId: GROW_NETWORK,
    cost: num(1e35),
    effect: { kind: 'interfaceSpeedPerLnNodes', perLn: 0.01 },
  },

  // Unlocks of the per-action toggles, shown in the square on each action card (not in its row of purchases).
  overclockUnlock(GROW_NETWORK, 'Unlocks Overclock for this action: 50% faster, at the price of 2 heat per minute while it runs.'),

  focusUnlock(GROW_NETWORK),
];
