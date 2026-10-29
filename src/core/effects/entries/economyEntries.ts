import type { BuyableEffect } from '../../types';
import { factorAtLeastOne, sleeveWide } from '../effectHelpers';
import type { EffectDefinition } from '../effectTypes';

type Kind = 'nodePayoutMultiplier' | 'networkGrowth' | 'networkGrowthFromActionLevel';

/** The entries for the network and payout effects, keyed by kind. */
export const ECONOMY_ENTRIES: { readonly [K in Kind]: EffectDefinition<Extract<BuyableEffect, { kind: K }>> } = {
  nodePayoutMultiplier: {
    traits: sleeveWide,
    validate: factorAtLeastOne,
    sleeve: (acc, e, { owned }) => {
      acc.nodePayoutFactor *= e.factor ** owned;
    },
  },
  networkGrowth: {
    traits: sleeveWide,
    validate: (e, { where, errors }) => {
      if (!(Number.isFinite(e.ratePerSecond) && e.ratePerSecond >= 0)) errors.push(`${where}: network growth rate must be >= 0`);
    },
  },
  networkGrowthFromActionLevel: {
    traits: sleeveWide,
    validate: (e, { where, actionIds, errors }) => {
      if (!(Number.isFinite(e.percentPerLevel) && e.percentPerLevel >= 0))
        errors.push(`${where}: network growth percent per level must be >= 0`);
      if (!actionIds.has(e.sourceActionId)) errors.push(`${where}: network growth refers to unknown action "${e.sourceActionId}"`);
    },
  },
};
