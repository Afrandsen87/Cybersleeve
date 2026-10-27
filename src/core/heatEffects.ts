/**
 * @module core
 *
 * The registry entries of the buyable effects that shape heat (Burn lead strength, idle cooling, Mole aggregation, the tax cap).
 *
 * @remarks
 * These belong in {@link EFFECTS} like every other kind; they live in their own file only to keep `effectRegistry.ts` small. The
 * registry spreads {@link HEAT_EFFECTS} into its table, so the compiler still demands an entry for every kind. Each entry fills one
 * field of the sleeve accumulator; `effects.ts` copies the fields to `SleeveStats`; `engine.ts` (cooling pace), `burnLeads.ts` and
 * `economy.ts` (tax cap) read them.
 */
import type { EffectContext, EffectDefinition } from './effectRegistry';
import type { BuyableEffect } from './types';

type Kind = 'burnLeadFlatHeat' | 'idleHeatCooldown' | 'idleHeatCooldownAction' | 'moleAggregation' | 'heatTaxCap';

/** Reports `effect[field]` unless it is a finite number above 0. */
function positive(field: string, value: number, { where, errors }: EffectContext): void {
  if (!(Number.isFinite(value) && value > 0)) errors.push(`${where}: ${field} must be > 0`);
}

/** The entries for the heat effects, keyed by kind. Called by: `effectRegistry.ts` (spread into `EFFECTS`). */
export const HEAT_EFFECTS: { readonly [K in Kind]: EffectDefinition<Extract<BuyableEffect, { kind: K }>> } = {
  burnLeadFlatHeat: {
    traits: { needsAction: false, toggleable: false },
    validate: (e, ctx) => positive('burnLeadFlatHeat amount', e.amount, ctx),
    sleeve: (acc, e, { owned }) => {
      acc.burnLeadFlatHeat += e.amount * owned;
    },
  },
  idleHeatCooldown: {
    traits: { needsAction: false, toggleable: false },
    validate: (e, { where, errors }) => {
      if (!(Number.isFinite(e.factor) && e.factor >= 1)) errors.push(`${where}: idleHeatCooldown factor must be >= 1`);
    },
    sleeve: (acc, e, { owned }) => {
      acc.idleHeatCooldown *= e.factor ** owned;
    },
  },
  idleHeatCooldownAction: {
    traits: { needsAction: false, toggleable: false },
    validate: (e, { where, actionIds, errors }) => {
      if (!actionIds.has(e.actionId)) errors.push(`${where}: idleHeatCooldownAction refers to unknown action "${e.actionId}"`);
    },
    sleeve: (acc, e) => {
      acc.idleHeatCooldownActions.push(e.actionId);
    },
  },
  moleAggregation: {
    traits: { needsAction: false, toggleable: false },
    validate: (e, ctx) => positive('moleAggregation bonusPerOrder', e.bonusPerOrder, ctx),
    sleeve: (acc, e) => {
      acc.moleAggregation = Math.max(acc.moleAggregation ?? 0, e.bonusPerOrder);
    },
  },
  heatTaxCap: {
    traits: { needsAction: false, toggleable: false },
    validate: (e, { where, errors }) => {
      if (!(Number.isFinite(e.maxShare) && e.maxShare > 0 && e.maxShare < 1))
        errors.push(`${where}: heatTaxCap maxShare must be in (0, 1)`);
    },
    sleeve: (acc, e) => {
      acc.heatTaxCap = Math.min(acc.heatTaxCap, e.maxShare);
    },
  },
};
