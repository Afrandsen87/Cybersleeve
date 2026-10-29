/**
 * @module core
 *
 * The registry entries of the newer re-sleeve skill effects (see `resleeveEffectTypes.ts`).
 *
 * @remarks
 * These belong in {@link EFFECTS} like every other kind; they live in their own file only to keep `effectRegistry.ts` small. The
 * registry spreads {@link RESLEEVE_EFFECTS} into its table, so the compiler still demands an entry for every kind.
 */
import type { EffectDefinition } from '../effects/effectTypes';
import type { ResleeveEffect } from './resleeveEffectTypes';

type Kind = ResleeveEffect['kind'];

const sleeveWide = { needsAction: false, toggleable: false } as const;

/** The entries for the newer re-sleeve skills, keyed by kind. Called by: `effectRegistry.ts` (spread into `EFFECTS`). */
export const RESLEEVE_EFFECTS: { readonly [K in Kind]: EffectDefinition<Extract<ResleeveEffect, { kind: K }>> } = {
  // read only by BuyableCaps, which looks at the content directly
  buyableCapBonus: {
    traits: sleeveWide,
    validate: (e, { where, buyableIds, errors }) => {
      if (!(Number.isInteger(e.extra) && e.extra >= 1)) errors.push(`${where}: buyableCapBonus extra must be an integer >= 1`);
      if (!buyableIds.has(e.targetId)) errors.push(`${where}: buyableCapBonus refers to unknown buyable "${e.targetId}"`);
    },
  },
  focusStacking: {
    traits: sleeveWide,
    validate: () => {},
    sleeve: (acc) => {
      acc.focusStacking = true;
    },
  },
  // read only by SynthSleeves, which looks at the content directly
  synthsPerResleeve: {
    traits: sleeveWide,
    validate: (e, { where, errors }) => {
      if (!(Number.isInteger(e.count) && e.count >= 2)) errors.push(`${where}: synthsPerResleeve count must be an integer >= 2`);
    },
  },
  interfaceSpeedPerLnSynths: {
    traits: sleeveWide,
    validate: (e, { where, errors }) => {
      if (!(Number.isFinite(e.perLn) && e.perLn > 0)) errors.push(`${where}: interfaceSpeedPerLnSynths perLn must be > 0`);
    },
    sleeve: (acc, e, { owned, state }) => {
      acc.interfaceSkillFactor *= (1 + e.perLn * Math.log1p(state.wallet.synths.length)) ** owned;
    },
  },
  synthXpBoost: {
    traits: sleeveWide,
    validate: (e, { where, errors }) => {
      if (!(Number.isFinite(e.factor) && e.factor > 1)) errors.push(`${where}: synthXpBoost factor must be > 1`);
    },
    sleeve: (acc, e) => {
      acc.synthXpFactor = Math.max(acc.synthXpFactor, e.factor);
    },
  },
  // read only by SynthSleeves
  perfectCopies: { traits: sleeveWide, validate: () => {} },
  // read only by Corporation
  corporationSpeedPerLnSynths: {
    traits: sleeveWide,
    validate: (e, { where, errors }) => {
      if (!(Number.isFinite(e.perLn) && e.perLn > 0)) errors.push(`${where}: corporationSpeedPerLnSynths perLn must be > 0`);
    },
  },
  unlocksSynthPurchase: { traits: sleeveWide, validate: () => {} },
  // read only by ReflexArchive and resleeveCarry.ts
  autoRepurchase: { traits: sleeveWide, validate: () => {} },
  keepsAutomation: { traits: sleeveWide, validate: () => {} },
  carriesProficiency: {
    traits: sleeveWide,
    validate: (e, { where, errors }) => {
      if (!(Number.isFinite(e.scale) && e.scale > 0)) errors.push(`${where}: carriesProficiency scale must be > 0`);
    },
  },
  carriesIceRating: {
    traits: sleeveWide,
    validate: (e, { where, errors }) => {
      if (!(Number.isFinite(e.share) && e.share > 0 && e.share <= 1)) errors.push(`${where}: carriesIceRating share must be in (0, 1]`);
    },
  },
};
