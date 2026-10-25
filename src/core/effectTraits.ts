/**
 * @module core
 *
 * What each kind of buyable effect IS, as data: whether it needs an action and whether the player can switch it.
 *
 * @remarks
 * One entry per kind of {@link BuyableEffect}. The mapped type makes the compiler demand an entry for every kind, so a new
 * effect cannot be added without saying what it is. Code that needs to know (the config validator, the shop UI, the
 * save format, the engine's click handling) asks here instead of comparing against a kind name.
 */
import type { BuyableDefinition, BuyableEffect } from './types';

/** Facts about one kind of effect. */
export interface EffectTraits {
  /** The effect changes the action the buyable belongs to, so the buyable must name an `actionId`. */
  readonly needsAction: boolean;
  /** Once owned, clicking the buyable switches the effect on or off instead of buying another copy. */
  readonly toggleable: boolean;
}

const sleeveWide: EffectTraits = { needsAction: false, toggleable: false };
const perAction: EffectTraits = { needsAction: true, toggleable: false };

/** The traits of every effect kind. */
export const EFFECT_TRAITS: { readonly [K in BuyableEffect['kind']]: EffectTraits } = {
  autoRun: { needsAction: true, toggleable: true },
  rewardMultiplier: perAction,
  itemDrop: perAction,
  rarityShiftFromProficiency: perAction,
  interfaceSpeedMultiplier: sleeveWide,
  heatCooldownSpeed: sleeveWide,
  hackingProficiencyMultiplier: sleeveWide,
  actionXpReduction: sleeveWide,
  itemDropChanceMultiplier: sleeveWide,
  nodePayoutFromItems: sleeveWide,
  backChannel: sleeveWide,
  interfaceSpeed: sleeveWide,
  accessLevel: sleeveWide,
  nodePayoutMultiplier: sleeveWide,
  iceRatingMultiplier: sleeveWide,
  unlock: sleeveWide,
  networkGrowth: sleeveWide,
  networkGrowthFromActionLevel: sleeveWide,
  interfaceSpeedPerLnNodes: sleeveWide,
  levelBonusFromSleeveLevel: sleeveWide,
  sleeveXpReduction: sleeveWide,
};

/**
 * Traits of a buyable's effect.
 *
 * Called by: `config.ts`, `engine.ts`, `serialization.ts`, `ui/viewModel.ts`.
 *
 * @param buyable the buyable
 */
export function traitsOf(buyable: Pick<BuyableDefinition, 'effect'>): EffectTraits {
  return EFFECT_TRAITS[buyable.effect.kind];
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
