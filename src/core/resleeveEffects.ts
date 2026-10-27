/**
 * @module core
 *
 * The registry entries of the newer re-sleeve skill effects (see `resleeveEffectTypes.ts`).
 *
 * @remarks
 * These belong in {@link EFFECTS} like every other kind; they live in their own file only to keep `effectRegistry.ts` small. The
 * registry spreads {@link RESLEEVE_EFFECTS} into its table, so the compiler still demands an entry for every kind.
 */
import type { EffectDefinition } from './effectRegistry';
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
};
