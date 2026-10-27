/**
 * @module content
 *
 * The buyables of Kill servers.
 */
import type { BuyableDefinition } from '../../core';
import { num } from '../../numbers';
import {
  KILL_SERVERS,
  KILL_AUTO_RUN,
  overclockUnlockId,
  ADMIN_KEY,
  KILL_CHAIN,
  BLACK_BOX_RECORDER,
  DECOMMISSION_PROTOCOL,
  CREDIT_SIPHON,
  CASCADE_FAILURE,
} from '../ids';
import { autoRunCost, overclockUnlock, focusUnlock } from './helpers';

/** The buyables of Kill servers. */
export const killServersBuyables: BuyableDefinition[] = [
  {
    id: KILL_AUTO_RUN,
    name: 'Auto-run',
    symbol: '↻',
    description: 'Restarts the action automatically when it finishes (each restart pays the start cost).',
    actionId: KILL_SERVERS,
    cost: num(autoRunCost(KILL_SERVERS)),
    effect: { kind: 'autoRun' },
  },

  {
    id: DECOMMISSION_PROTOCOL,
    name: 'Decommission protocol',
    symbol: 'DP',
    description:
      'Every action level lowers the share of your nodes a run takes by 1% of its current value. The first level is worth the most.',
    formula: 'Share of nodes = base share x 0.99 ^ action level',
    actionId: KILL_SERVERS,
    // Placeholder price (balance is not tuned yet). The Kill servers prices climb in this order: Cascade failure, Credit Siphon,
    // Decommission protocol, Kill chain, Black box recorder.
    cost: num(1e14),
    effect: { kind: 'startCostReduction', perLevel: 0.01 },
  },

  {
    id: CREDIT_SIPHON,
    name: 'Credit Siphon',
    symbol: 'CD',
    description: 'When a run starts, you are paid 10 seconds of what a node produces for every node it destroys.',
    actionId: KILL_SERVERS,
    // Placeholder price (balance is not tuned yet).
    cost: num(1e12),
    effect: { kind: 'creditSiphon', seconds: 10 },
  },

  {
    id: CASCADE_FAILURE,
    name: 'Cascade failure',
    symbol: '×2',
    description: 'Doubles the ICE Rating each run pays. Each copy costs 100x more.',
    actionId: KILL_SERVERS,
    // Placeholder price (balance is not tuned yet).
    cost: num(1e10),
    costGrowth: 100, // every 2nd order of magnitude
    maxPurchases: Infinity,
    effect: { kind: 'rewardMultiplier', factor: 2 },
  },

  {
    id: KILL_CHAIN,
    name: 'Kill chain',
    symbol: 'KC',
    description:
      'Adds a chain to the Overclock of this action: every consecutive overclocked run adds a link (up to 20) that makes the next run pay 10% more ICE Rating and take 10% more of the share of nodes. Stopping the action or switching Overclock off resets the chain.',
    actionId: KILL_SERVERS,
    requires: [overclockUnlockId(KILL_SERVERS)],
    // Placeholder price (balance is not tuned yet).
    cost: num(1e17),
    // 20 links; each adds 10% of the base reward (a gain: grows with Overclock strength) and 10% to the node share (a price: fixed)
    effect: { kind: 'overclockChain', chain: { maxLinks: 20, rewardPerLink: 0.1, nodesPerLink: 0.1 } },
  },

  {
    id: BLACK_BOX_RECORDER,
    name: 'Black box recorder',
    symbol: 'BB',
    description:
      'Each completed run has a chance to drop an Admin key. Switch Admin keys on in the Inventory: each completed Practice Hacking run then uses one up and gets +100% critical chance, and may drop a Skill shard.',
    actionId: KILL_SERVERS,
    // Placeholder price (balance is not tuned yet).
    cost: num(1e20),
    effect: {
      kind: 'itemDrop',
      drop: {
        itemId: ADMIN_KEY,
        /** Chance that one completed run drops an Admin key at all: 10% (placeholder; Kill servers runs are slow). */
        chance: 0.1,
      },
    },
  },

  overclockUnlock(
    KILL_SERVERS,
    'Unlocks Overclock for this action: pays double ICE Rating and holds heat in place while it runs. The Kill chain adds more.',
  ),

  focusUnlock(KILL_SERVERS),
];
