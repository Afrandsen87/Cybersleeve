/**
 * @module core
 *
 * Facts about buyable effects, read from the effect registry (`effectRegistry.ts`), plus the exhaustiveness helper.
 */
import { definitionOf, EFFECTS, type EffectTraits } from './effectRegistry';
import type { BuyableDefinition, BuyableEffect } from './types';

export type { EffectTraits };

/** The traits of every effect kind (a view of the registry). */
export const EFFECT_TRAITS = Object.fromEntries(Object.entries(EFFECTS).map(([kind, def]) => [kind, def.traits])) as {
  readonly [K in BuyableEffect['kind']]: EffectTraits;
};

/**
 * Traits of a buyable's effect.
 *
 * Called by: `config.ts`, `shop.ts`, `serialization.ts`, `ui/viewModel.ts`.
 *
 * @param buyable the buyable
 */
export function traitsOf(buyable: Pick<BuyableDefinition, 'effect'>): EffectTraits {
  return definitionOf(buyable).traits;
}

/**
 * Compile-time proof that a `switch` handled every case: passing a value that can still be something is a type error.
 *
 * @param value the value left over after all cases (type `never`)
 * @throws Error always (only reachable when the types were bypassed)
 */
export function assertNever(value: never): never {
  throw new Error(`Unhandled case: ${JSON.stringify(value)}`);
}
