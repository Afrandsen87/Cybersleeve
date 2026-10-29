import type { BuyableEffect } from '../../types';
import { factorAtLeastOne, none, perAction, sleeveWide } from '../effectHelpers';
import type { EffectDefinition } from '../effectTypes';

type Kind =
  | 'autoRun'
  | 'overclockUnlock'
  | 'overclockChain'
  | 'focusUnlock'
  | 'overclockStrength'
  | 'focusSlots'
  | 'startCostReduction'
  | 'creditSiphon'
  | 'overclockHeatFactor'
  | 'paysActionReward'
  | 'rewardMultiplier'
  | 'rewardMultiplierFromActionLevel';

/** The entries for the action-level effects: auto-run, Overclock, Focus, start cost, reward levers and linked payouts, keyed by kind. */
export const ACTION_ENTRIES: { readonly [K in Kind]: EffectDefinition<Extract<BuyableEffect, { kind: K }>> } = {
  autoRun: {
    traits: { needsAction: true, toggleable: true },
    validate: none,
    action: (acc, _e, { switchedOff }) => {
      if (!switchedOff) acc.autoRun = true;
    },
  },
  overclockUnlock: {
    traits: perAction,
    validate: none,
    action: (acc) => {
      acc.overclockUnlocked = true;
    },
  },
  overclockChain: {
    traits: perAction,
    validate: ({ chain }, { where, errors }) => {
      if (!(Number.isInteger(chain.maxLinks) && chain.maxLinks >= 1)) errors.push(`${where}: chain maxLinks must be an integer >= 1`);
      if (!(Number.isFinite(chain.rewardPerLink) && chain.rewardPerLink > 0)) errors.push(`${where}: chain rewardPerLink must be > 0`);
      if (!(Number.isFinite(chain.nodesPerLink) && chain.nodesPerLink >= 0)) errors.push(`${where}: chain nodesPerLink must be >= 0`);
    },
    action: (acc, e) => {
      acc.chain = e.chain;
    },
  },
  focusUnlock: {
    traits: perAction,
    validate: none,
    action: (acc) => {
      acc.focusUnlocked = true;
    },
  },
  overclockStrength: {
    traits: sleeveWide,
    validate: (e, { where, errors }) => {
      if (!(Number.isFinite(e.perCopy) && e.perCopy > 0)) errors.push(`${where}: overclockStrength perCopy must be > 0`);
    },
    sleeve: (acc, e, { owned }) => {
      acc.overclockStrength += e.perCopy * owned;
    },
  },
  focusSlots: {
    traits: sleeveWide,
    validate: (e, { where, errors }) => {
      if (!(Number.isInteger(e.perCopy) && e.perCopy >= 1)) errors.push(`${where}: focusSlots perCopy must be an integer >= 1`);
    },
    sleeve: (acc, e, { owned }) => {
      acc.extraFocusSlots += e.perCopy * owned;
    },
  },
  startCostReduction: {
    traits: perAction,
    validate: (e, { where, errors }) => {
      if (!(Number.isFinite(e.perLevel) && e.perLevel > 0 && e.perLevel < 1))
        errors.push(`${where}: startCostReduction perLevel must be in (0, 1)`);
    },
    action: (acc, e) => {
      acc.startCostReductions.push(e.perLevel);
    },
  },
  creditSiphon: {
    traits: perAction,
    validate: (e, { where, errors }) => {
      if (!(Number.isFinite(e.seconds) && e.seconds > 0)) errors.push(`${where}: creditSiphon seconds must be > 0`);
    },
    action: (acc, e) => {
      acc.siphonSeconds += e.seconds;
    },
  },
  overclockHeatFactor: {
    traits: sleeveWide,
    validate: (e, ctx) => {
      factorAtLeastOne(e, ctx);
      if (!ctx.actionIds.has(e.targetActionId))
        ctx.errors.push(`${ctx.where}: overclockHeatFactor refers to unknown action "${e.targetActionId}"`);
    },
    sleeve: (acc, e) => {
      acc.overclockHeatFactors[e.targetActionId] = Math.min(acc.overclockHeatFactors[e.targetActionId] ?? Infinity, e.factor);
    },
  },
  paysActionReward: {
    traits: sleeveWide,
    validate: (e, { where, actionIds, errors }) => {
      for (const id of [e.sourceActionId, e.targetActionId]) {
        if (!actionIds.has(id)) errors.push(`${where}: paysActionReward refers to unknown action "${id}"`);
      }
      if (!(Number.isFinite(e.chance) && e.chance > 0 && e.chance <= 1)) errors.push(`${where}: paysActionReward chance must be in (0, 1]`);
    },
    sleeve: (acc, e) => {
      acc.paysActions.push({ sourceActionId: e.sourceActionId, targetActionId: e.targetActionId, chance: e.chance });
    },
  },
  rewardMultiplier: {
    traits: perAction,
    validate: factorAtLeastOne,
    action: (acc, e, { owned, factory }) => {
      acc.rewardMultiplier = acc.rewardMultiplier.mul(factory.fromNumber(e.factor).pow(owned));
    },
  },
  rewardMultiplierFromActionLevel: {
    // read only by `levelRewardFactor.ts` (through `DerivedStats.rewardMultiplier`)
    traits: sleeveWide,
    validate: (e, { where, actionIds, errors }) => {
      for (const id of [e.sourceActionId, e.targetActionId]) {
        if (!actionIds.has(id)) errors.push(`${where}: rewardMultiplierFromActionLevel refers to unknown action "${id}"`);
      }
      if (!(Number.isFinite(e.coefficient) && e.coefficient > 0))
        errors.push(`${where}: rewardMultiplierFromActionLevel coefficient must be > 0`);
      if (!(Number.isFinite(e.scale) && e.scale > 0)) errors.push(`${where}: rewardMultiplierFromActionLevel scale must be > 0`);
    },
  },
};
