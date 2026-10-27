/**
 * @module content
 *
 * The buyables of the corporation (shown in the Asset Acquisition widget of the Corporation tab). Data only.
 */
import type { BuyableDefinition } from '../../core';
import { num } from '../../numbers';
import { CORPORATE_ACCESS_UPGRADE } from '../ids';

/** The buyables of the corporation. They are paid in credits and kept through re-sleeving, like the corporation. */
export const corporationBuyables: BuyableDefinition[] = [
  {
    id: CORPORATE_ACCESS_UPGRADE,
    name: 'Corporate access upgrade',
    symbol: 'CA',
    description: 'Raises Corporate rank by 1, which unlocks the next corporation action. Each copy costs 100000x more.',
    cost: num(5_000_000), // placeholder: meant to be bought after at least two re-sleeves
    costGrowth: 100_000, // every 5th order of magnitude
    maxPurchases: Infinity,
    effect: { kind: 'corporateRank', amount: 1 },
  },
];
