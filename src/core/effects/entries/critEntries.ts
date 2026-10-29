import type { BuyableEffect } from '../../types';
import { factorAtLeastOne, perAction, sleeveWide } from '../effectHelpers';
import type { EffectDefinition } from '../effectTypes';

type Kind = 'criticalChance' | 'criticalBoost' | 'criticalLink' | 'criticalExtraChance' | 'criticalRewardMultiplier';

/** The entries for the critical success effects, keyed by kind. */
export const CRIT_ENTRIES: { readonly [K in Kind]: EffectDefinition<Extract<BuyableEffect, { kind: K }>> } = {
  criticalChance: {
    traits: sleeveWide,
    validate: (e, { where, errors }) => {
      if (!(Number.isFinite(e.chance) && e.chance > 0 && e.chance <= 1)) errors.push(`${where}: criticalChance chance must be in (0, 1]`);
    },
    sleeve: (acc, e, { owned }) => {
      acc.criticalChance += e.chance * owned;
    },
  },
  criticalBoost: {
    traits: perAction,
    validate: factorAtLeastOne,
    action: (acc, e) => {
      acc.criticalFactor *= e.factor;
    },
  },
  criticalLink: {
    traits: perAction,
    validate: (e, { where, actionIds, errors }) => {
      if (!actionIds.has(e.targetActionId)) errors.push(`${where}: criticalLink refers to unknown action "${e.targetActionId}"`);
    },
    action: (acc, e) => {
      acc.criticalLinks.push(e.targetActionId);
    },
  },
  criticalExtraChance: {
    traits: sleeveWide,
    validate: (e, { where, errors }) => {
      if (!(Number.isFinite(e.chance) && e.chance > 0 && e.chance <= 1))
        errors.push(`${where}: criticalExtraChance chance must be in (0, 1]`);
    },
    sleeve: (acc, e, { owned }) => {
      acc.criticalExtraChance = Math.min(1, acc.criticalExtraChance + e.chance * owned);
    },
  },
  criticalRewardMultiplier: {
    traits: sleeveWide,
    validate: factorAtLeastOne,
    sleeve: (acc, e, { owned }) => {
      acc.criticalRewardFactor *= e.factor ** owned;
    },
  },
};
