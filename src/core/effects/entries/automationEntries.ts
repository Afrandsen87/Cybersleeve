import { AUTOMATION_FEATURES } from '../../automation/automation';
import { AUTO_BURN_STEPS } from '../../automation/autoBurnTypes';
import type { BuyableEffect } from '../../types';
import { sleeveWide } from '../effectHelpers';
import type { EffectDefinition } from '../effectTypes';

type Kind = 'automationPoints' | 'unlocksAutomation' | 'autoBurnStep' | 'allowsAutosale' | 'allowsAutoBackchannel';

/** The entries for the automation effects, keyed by kind. */
export const AUTOMATION_ENTRIES: { readonly [K in Kind]: EffectDefinition<Extract<BuyableEffect, { kind: K }>> } = {
  automationPoints: {
    // read only by the Automation unit, which sums the copies itself
    traits: { ...sleeveWide, automationPurchase: true },
    validate: (e, { where, errors }) => {
      if (!(Number.isInteger(e.perCopy) && e.perCopy >= 1)) errors.push(`${where}: automationPoints perCopy must be an integer >= 1`);
    },
  },
  unlocksAutomation: {
    // read only by the Automation unit, which looks for the owned buyable of each feature
    traits: sleeveWide,
    validate: (e, { rarityIds, where, errors }) => {
      if (e.allowsAutosale !== undefined && !rarityIds.has(e.allowsAutosale))
        errors.push(`${where}: unlocksAutomation names an unknown rarity`);
      if (!AUTOMATION_FEATURES.includes(e.feature))
        errors.push(`${where}: unlocksAutomation names an unknown feature "${String(e.feature)}"`);
    },
  },
  allowsAutosale: {
    traits: sleeveWide,
    validate: (e, { rarityIds, where, errors }) => {
      if (!rarityIds.has(e.rarity)) errors.push(`${where}: allowsAutosale names an unknown rarity`);
    },
  },
  allowsAutoBackchannel: {
    traits: sleeveWide,
    validate: (e, { rarityIds, where, errors }) => {
      if (!rarityIds.has(e.rarity)) errors.push(`${where}: allowsAutoBackchannel names an unknown rarity`);
    },
  },
  autoBurnStep: {
    // read only by Auto Burn (autoBurnRules.ts), which asks whether the owned buyable of each step exists
    traits: sleeveWide,
    validate: (e, { where, errors }) => {
      if (!AUTO_BURN_STEPS.includes(e.step)) errors.push(`${where}: autoBurnStep names an unknown step "${String(e.step)}"`);
    },
  },
};
