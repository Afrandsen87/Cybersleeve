/**
 * @module core/effects
 * Heat/effects contexts: sleeve-skill heat-tax scaling and its carried ownership trait.
 * Called by: effectRegistry. Calls: the injected sleeve-skill count.
 */
import type { BuyableEffect } from '../../types';
import { sleeveWideCarried } from '../effectHelpers';
import type { EffectDefinition } from '../effectTypes';

/** Heat/effects contexts: the registry entry for compounded sleeve-skill heat reduction. */
export const HEAT_SKILL_ENTRIES: {
  readonly heatReductionPerSleeveSkill: EffectDefinition<Extract<BuyableEffect, { kind: 'heatReductionPerSleeveSkill' }>>;
} = {
  heatReductionPerSleeveSkill: {
    traits: sleeveWideCarried,
    validate: (e, { where, errors }) => {
      if (!(Number.isFinite(e.perSkill) && e.perSkill >= 0 && e.perSkill < 1))
        errors.push(where + ': heat reduction per sleeve skill must be in [0, 1)');
    },
    sleeve: (acc, e, { sleeveSkillsOwned }) => {
      const count = Math.max(0, sleeveSkillsOwned() || 0);
      if (e.perSkill > 0) acc.heatTaxScale *= (1 - e.perSkill) ** count;
    },
  },
};
