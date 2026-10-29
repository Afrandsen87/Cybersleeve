import type { BuyableEffect } from '../../types';
import { factorAtLeastOne, naturalLog, sleeveWide } from '../effectHelpers';
import type { EffectDefinition } from '../effectTypes';

type Kind =
  | 'interfaceSpeedMultiplier'
  | 'actionXpReductionFromSleeveLevel'
  | 'hackingProficiencyMultiplier'
  | 'actionXpReduction'
  | 'runsPerSleeveXpReduction'
  | 'interfaceSpeed'
  | 'accessLevel'
  | 'iceRatingMultiplier'
  | 'iceRatingFromActionLevel'
  | 'interfaceSpeedPerLnNodes'
  | 'levelBonusFromSleeveLevel'
  | 'sleeveXpReduction';

/** The entries for the sleeve-stat effects: speed, access, ICE Rating, proficiency, XP reductions, keyed by kind. */
export const SLEEVE_ENTRIES: { readonly [K in Kind]: EffectDefinition<Extract<BuyableEffect, { kind: K }>> } = {
  interfaceSpeedMultiplier: {
    traits: sleeveWide,
    validate: factorAtLeastOne,
    sleeve: (acc, e, { owned }) => {
      acc.interfaceSkillFactor *= e.factor ** owned;
    },
  },
  actionXpReductionFromSleeveLevel: {
    traits: sleeveWide,
    validate: (e, { where, errors }) => {
      if (!(Number.isFinite(e.remainingPerOrder) && e.remainingPerOrder > 0 && e.remainingPerOrder < 1))
        errors.push(`${where}: actionXpReductionFromSleeveLevel remainingPerOrder must be in (0, 1)`);
      if (!(Number.isFinite(e.maxReduction) && e.maxReduction >= 0 && e.maxReduction < 1))
        errors.push(`${where}: actionXpReductionFromSleeveLevel maxReduction must be in [0, 1)`);
    },
  },
  hackingProficiencyMultiplier: {
    traits: sleeveWide,
    validate: factorAtLeastOne,
    sleeve: (acc, e, { owned }) => {
      acc.hackingProficiencyFactor *= e.factor ** owned;
    },
  },
  actionXpReduction: {
    traits: sleeveWide,
    validate: (e, { where, errors }) => {
      if (!(Number.isFinite(e.amount) && e.amount > 0 && e.amount < 1)) errors.push(`${where}: actionXpReduction amount must be in (0, 1)`);
    },
  },
  runsPerSleeveXpReduction: {
    traits: sleeveWide,
    validate: (e, { where, errors }) => {
      if (!(Number.isInteger(e.perCopy) && e.perCopy >= 1))
        errors.push(`${where}: runsPerSleeveXpReduction perCopy must be an integer >= 1`);
      if (!(Number.isInteger(e.minRuns) && e.minRuns >= 1))
        errors.push(`${where}: runsPerSleeveXpReduction minRuns must be an integer >= 1`);
    },
  },
  interfaceSpeed: {
    traits: sleeveWide,
    validate: (e, { where, errors }) => {
      if (!(Number.isFinite(e.amount) && e.amount >= 0)) errors.push(`${where}: interface speed amount must be >= 0`);
    },
    sleeve: (acc, e, { owned }) => {
      acc.interfaceBoosts += e.amount * owned;
    },
  },
  accessLevel: {
    traits: sleeveWide,
    validate: (e, { where, errors }) => {
      if (!(Number.isInteger(e.amount) && e.amount >= 1)) errors.push(`${where}: access level amount must be an integer >= 1`);
    },
    sleeve: (acc, e, { owned }) => {
      acc.accessLevel += e.amount * owned;
    },
  },
  iceRatingMultiplier: {
    traits: sleeveWide,
    validate: factorAtLeastOne,
    sleeve: (acc, e, { owned, factory }) => {
      acc.iceRatingFactor = acc.iceRatingFactor.mul(factory.fromNumber(e.factor).pow(owned));
    },
  },
  iceRatingFromActionLevel: {
    traits: sleeveWide,
    validate: (e, { where, actionIds, errors }) => {
      if (!(Number.isFinite(e.perLevel) && e.perLevel > 0)) errors.push(`${where}: ICE Rating per level must be > 0`);
      if (!actionIds.has(e.sourceActionId)) errors.push(`${where}: ICE Rating refers to unknown action "${e.sourceActionId}"`);
    },
    sleeve: (acc, e, { owned, factory, actionLevelOf }) => {
      acc.iceRatingBonus = acc.iceRatingBonus.add(factory.fromNumber(e.perLevel * actionLevelOf(e.sourceActionId) * owned));
    },
  },
  interfaceSpeedPerLnNodes: {
    traits: sleeveWide,
    validate: (e, { where, errors }) => {
      if (!(Number.isFinite(e.perLn) && e.perLn >= 0)) errors.push(`${where}: perLn must be >= 0`);
    },
    sleeve: (acc, e, { owned, state }) => {
      acc.interfaceNetworkFactor *= (1 + e.perLn * naturalLog(state.network)) ** owned;
    },
  },
  levelBonusFromSleeveLevel: {
    traits: sleeveWide,
    validate: (e, { where, actionIds, errors }) => {
      for (const id of [e.sourceActionId, e.targetActionId]) {
        if (!actionIds.has(id)) errors.push(`${where}: level bonus refers to unknown action "${id}"`);
      }
    },
  },
  sleeveXpReduction: {
    traits: sleeveWide,
    validate: (e, { where, actionIds, errors }) => {
      if (!actionIds.has(e.sourceActionId)) errors.push(`${where}: XP reduction refers to unknown action "${e.sourceActionId}"`);
      if (!(Number.isFinite(e.perLevel) && e.perLevel > 0)) errors.push(`${where}: XP reduction perLevel must be > 0`);
      if (!(Number.isFinite(e.maxReduction) && e.maxReduction >= 0 && e.maxReduction < 1)) {
        errors.push(`${where}: XP reduction maxReduction must be in [0, 1)`);
      }
    },
  },
};
