/**
 * @module core
 *
 * The registry of buyable effects: everything the game knows about one kind of effect, in one place.
 *
 * @remarks
 * One entry per kind of {@link BuyableEffect}, and the mapped type of {@link EFFECTS} makes the compiler demand an entry for every
 * kind. An entry says what the effect IS ({@link EffectTraits}), how its numbers are validated, and how it contributes to the two
 * things that buyables change directly: one action ({@link ActionAccumulator}) or the sleeve ({@link SleeveAccumulator}). The
 * resolvers in `actionResolver.ts` / `sleeveResolver.ts` loop over the owned buyables and call the hooks, so they contain no `switch` over kinds: adding a kind
 * means one union member in `effects/kinds/<family>.ts` and one entry here (in `effects/entries/<family>Entries.ts`, or `heat/heatEffects.ts` / `resleeve/resleeveEffects.ts`; the table below spreads them together). A kind whose only consumer is a dedicated query (network growth, the
 * level bonus, XP reductions, drop chance, the back channel) leaves both hooks out and is read by that query.
 */
import { HEAT_EFFECTS } from '../heat/heatEffects';
import { RESLEEVE_EFFECTS } from '../resleeve/resleeveEffects';
import type { BuyableDefinition, BuyableEffect } from '../types';
import { ACTION_ENTRIES } from './entries/actionEntries';
import { CRIT_ENTRIES } from './entries/critEntries';
import { ITEM_ENTRIES } from './entries/itemEntries';
import { SLEEVE_ENTRIES } from './entries/sleeveEntries';
import { ECONOMY_ENTRIES } from './entries/economyEntries';
import { AUTOMATION_ENTRIES } from './entries/automationEntries';
import { HEAT_COOL_ENTRIES } from './entries/heatCoolEntries';
import { corporate, none, sleeveWide } from './effectHelpers';
import type { EffectDefinition } from './effectTypes';

export type * from './effectTypes';

/** Every kind of effect, with its facts, validator and hooks. */
export const EFFECTS: { readonly [K in BuyableEffect['kind']]: EffectDefinition<Extract<BuyableEffect, { kind: K }>> } = {
  ...HEAT_EFFECTS,
  ...RESLEEVE_EFFECTS,
  ...ACTION_ENTRIES,
  ...CRIT_ENTRIES,
  ...ITEM_ENTRIES,
  ...SLEEVE_ENTRIES,
  ...ECONOMY_ENTRIES,
  ...AUTOMATION_ENTRIES,
  ...HEAT_COOL_ENTRIES,
  synthSleeves: { traits: sleeveWide, validate: none },
  unlockSleeveLevels: { traits: sleeveWide, validate: none },
  unlocksCorporation: { traits: sleeveWide, validate: none },
  addsCorporationEffect: { traits: corporate, validate: none },
  corporateRank: {
    traits: corporate,
    validate: (e, { where, errors }) => {
      if (!(Number.isInteger(e.amount) && e.amount >= 1)) errors.push(`${where}: corporate rank amount must be an integer >= 1`);
    },
  },
  placeholder: { traits: sleeveWide, validate: none },
};

/**
 * The registry entry of a buyable's effect, typed loosely so a hook can be called without knowing the kind.
 *
 * Called by: `actionResolver.ts`, `sleeveResolver.ts`, `effectTraits.ts`, `config.ts`.
 *
 * @param buyable the buyable
 */
export function definitionOf(buyable: Pick<BuyableDefinition, 'effect'>): EffectDefinition<BuyableEffect> {
  return EFFECTS[buyable.effect.kind] as EffectDefinition<BuyableEffect>;
}
