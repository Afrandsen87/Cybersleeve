import type { BuyableEffect } from '../../types';
import { factorAtLeastOne, sleeveWide } from '../effectHelpers';
import type { EffectDefinition } from '../effectTypes';

type Kind = 'heatCooldownSpeed' | 'heatCooldownAmountFromSleeveLevel';

/** The entries for the heat cooldown effects (pace and amount), keyed by kind. */
export const HEAT_COOL_ENTRIES: { readonly [K in Kind]: EffectDefinition<Extract<BuyableEffect, { kind: K }>> } = {
  heatCooldownSpeed: {
    traits: sleeveWide,
    validate: factorAtLeastOne,
    sleeve: (acc, e, { owned }) => {
      acc.heatCooldownSpeed *= e.factor ** owned;
    },
  },
  heatCooldownAmountFromSleeveLevel: {
    traits: sleeveWide,
    validate: (e, { where, actionIds, errors }) => {
      if (!(Number.isFinite(e.perLevel) && e.perLevel > 0)) errors.push(`${where}: heat per sleeve level must be > 0`);
      if (!actionIds.has(e.sourceActionId)) errors.push(`${where}: heat per sleeve level refers to unknown action "${e.sourceActionId}"`);
    },
    sleeve: (acc, e, { owned, sleeveLevelOf }) => {
      acc.extraHeatCooldownAmount += e.perLevel * sleeveLevelOf(e.sourceActionId) * owned;
    },
  },
};
