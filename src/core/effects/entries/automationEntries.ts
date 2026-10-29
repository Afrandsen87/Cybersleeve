import { AUTOMATION_FEATURES } from '../../automation/automation';
import type { BuyableEffect } from '../../types';
import { sleeveWide } from '../effectHelpers';
import type { EffectDefinition } from '../effectTypes';

type Kind = 'automationPoints' | 'unlocksAutomation';

/** The entries for the automation effects, keyed by kind. */
export const AUTOMATION_ENTRIES: { readonly [K in Kind]: EffectDefinition<Extract<BuyableEffect, { kind: K }>> } = {
  automationPoints: {
    // read only by the Automation unit, which sums the copies itself
    traits: sleeveWide,
    validate: (e, { where, errors }) => {
      if (!(Number.isInteger(e.perCopy) && e.perCopy >= 1)) errors.push(`${where}: automationPoints perCopy must be an integer >= 1`);
    },
  },
  unlocksAutomation: {
    // read only by the Automation unit, which looks for the owned buyable of each feature
    traits: sleeveWide,
    validate: (e, { where, errors }) => {
      if (!AUTOMATION_FEATURES.includes(e.feature))
        errors.push(`${where}: unlocksAutomation names an unknown feature "${String(e.feature)}"`);
    },
  },
};
