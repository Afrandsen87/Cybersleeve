/**
 * @module core
 *
 * Translates owned buyables into the sleeve-wide stats (interface speed, ICE Rating, heat, critical chance, ...).
 *
 * Called by: `engine/*`, `ui/viewModel.ts`. Calls: `effectRegistry.definitionOf` (the sleeve hooks), `kernel/concaveBonus`, `kernel/curves`.
 */
import type { BigNum, NumberFactory } from '../../numbers';
import { type CurveBeyond, concaveBonus } from '../kernel/concaveBonus';
import { bigOrders } from '../kernel/curves';
import { definitionOf, type SleeveAccumulator } from './effectRegistry';
import { INFINITY, saturate } from '../kernel/infinity';
import type { ActionId, BuyableDefinition, GameState, SleeveConfig } from '../types';
import type { FactorTerm, SleeveStats } from './sleeveStatsTypes';

/**
 * The second shape of the Hacking Proficiency curve, if the configuration has one.
 *
 * Called by: {@link resolveSleeveStats}, `ui/viewModel.ts`.
 *
 * @param sleeve the sleeve configuration (reads `earnedSpeedKnee` and `earnedSpeedExponentBeyond`)
 * @returns the knee and the shape past it, or `undefined` for one curve all the way
 */
export function earnedSpeedBeyond(sleeve: Pick<SleeveConfig, 'earnedSpeedKnee' | 'earnedSpeedExponentBeyond'>): CurveBeyond | undefined {
  if (sleeve.earnedSpeedExponentBeyond === undefined) return undefined;
  return { knee: sleeve.earnedSpeedKnee ?? 1, exponent: sleeve.earnedSpeedExponentBeyond };
}

/**
 * Collects the effects of all owned sleeve-wide buyables.
 *
 * @remarks
 * Interface speed is `(base + amounts) * networkFactor * (1 + earned)`: `base` is `sleeve.baseInterfaceSpeed`, `amounts` is
 * `amount` per owned `interfaceSpeed` copy, `networkFactor` is `(1 + perLn * ln(nodes))` per owned
 * `interfaceSpeedPerLnNodes` copy (never below 1), and `earned` is the bonus earned by actions. Each run adds the same
 * amount to the stored total, but `earned` is that total passed through {@link concaveBonus}
 * (`sleeve.earnedSpeedScale`, `sleeve.earnedSpeedExponent`, and past `sleeve.earnedSpeedKnee` the flatter
 * `sleeve.earnedSpeedExponentBeyond`), so every further run is worth less than the one before.
 * Access level is `sleeve.baseAccessLevel` plus `amount` per owned `accessLevel` copy (copies stack). Heat and Legend are the current values in the state. ICE Rating is the earned value plus the
 * `iceRatingFromActionLevel` bonuses (`perLevel * action level * copies`), times `factor^copies` of every `iceRatingMultiplier` buyable; the heat reduction is `iceRatingReductionPerOrder` per
 * order of magnitude of it (capped at 100%). The node payout multiplier is `factor^copies` of the `nodePayoutMultiplier` buyables; the node payout bonus
 * earned by actions is a separate amount added to the base value of a node (see `Economy.passiveCreditsPerNode`).
 * Called by: `engine.ts`.
 *
 * @param buyables all buyable definitions
 * @param state current state (reads `purchased`, `heat`, `network`, `hackingProficiency`, `iceRating`, `legend`)
 * @param sleeve base values of the stats
 * @param factory number factory
 * @param actionLevelOf plain action level of an action (read by effects that scale with one; defaults to level 0 for all)
 * @param sleeveLevelOf sleeve level of an action (read by effects that scale with one; defaults to level 0 for all)
 * @param augmentRaritiesHeld how many distinct rarities have an augment applied on any action (defaults to 0)
 * @returns the current stats
 */
export function resolveSleeveStats(
  buyables: readonly BuyableDefinition[],
  state: Pick<
    GameState,
    'purchased' | 'heat' | 'hackingProficiency' | 'network' | 'iceRating' | 'legend' | 'nodePayoutBonus' | 'inventory' | 'synths'
  >,
  sleeve: SleeveConfig,
  factory: NumberFactory,
  actionLevelOf: (actionId: ActionId) => number = () => 0,
  sleeveLevelOf: (actionId: ActionId) => number = () => 0,
  augmentRaritiesHeld: () => number = () => 0,
): SleeveStats {
  const acc: SleeveAccumulator = {
    accessLevel: sleeve.baseAccessLevel,
    interfaceBoosts: 0,
    interfaceNetworkFactor: 1,
    iceRatingBonus: factory.fromNumber(0),
    iceRatingFactor: factory.fromNumber(1),
    nodePayoutFactor: 1,
    interfaceSkillFactor: 1,
    hackingProficiencyFactor: 1,
    heatCooldownSpeed: 1,
    heatCooldownBoost: 0,
    extraHeatCooldownAmount: 0,
    burnLeadFlatHeat: 0,
    idleHeatCooldown: 1,
    idleHeatCooldownActions: [],
    moleAggregation: null,
    heatTaxCap: 1,
    criticalChance: 0,
    paysActions: [],
    criticalExtraChance: 0,
    criticalRewardFactor: 1,
    overclockStrength: 1,
    extraFocusSlots: 0,
    focusStacking: false,
    synthXpFactor: 1,
    overclockHeatFactors: {},
  };
  const nodePayoutTerms: FactorTerm[] = [];
  const iceRatingTerms: FactorTerm[] = [];
  for (const b of buyables) {
    const owned = state.purchased[b.id] ?? 0;
    if (owned <= 0) continue;
    const payoutBefore = acc.nodePayoutFactor;
    const iceBefore = acc.iceRatingFactor;
    definitionOf(b).sleeve?.(acc, b.effect, { owned, state, factory, actionLevelOf, sleeveLevelOf, augmentRaritiesHeld });
    // A buyable's term is how much it moved the running product, so every effect kind reports itself without extra code.
    if (acc.nodePayoutFactor !== payoutBefore)
      nodePayoutTerms.push({ buyableId: b.id, factor: saturate(acc.nodePayoutFactor / payoutBefore) });
    if (!acc.iceRatingFactor.eq(iceBefore)) {
      iceRatingTerms.push({ buyableId: b.id, factor: saturatingNumber(acc.iceRatingFactor.div(iceBefore)) });
    }
  }
  const { accessLevel, interfaceBoosts, interfaceNetworkFactor } = acc;
  const iceRating = state.iceRating.add(acc.iceRatingBonus).mul(acc.iceRatingFactor);
  const interfaceSkillFactor = acc.interfaceSkillFactor;
  const hackingProficiencyFactor = acc.hackingProficiencyFactor;
  const nodePayoutBuyableFactor = acc.nodePayoutFactor;
  const heatCooldownSpeed = acc.heatCooldownSpeed;
  const heatCooldownBoost = acc.heatCooldownBoost;
  const interfaceBase = sleeve.baseInterfaceSpeed + interfaceBoosts;
  const heatReduction = Math.min(1, sleeve.iceRatingReductionPerOrder * bigOrders(iceRating));
  const hackingMultiplier = saturate(
    1 +
      concaveBonus(
        saturate(saturatingNumber(state.hackingProficiency) * saturate(hackingProficiencyFactor)),
        sleeve.earnedSpeedScale,
        sleeve.earnedSpeedExponent,
        earnedSpeedBeyond(sleeve),
      ),
  );
  const nodePayoutBonus = saturatingNumber(state.nodePayoutBonus);
  return {
    accessLevel,
    interfaceSpeed: saturate(
      saturate(interfaceBase) * saturate(interfaceNetworkFactor) * hackingMultiplier * saturate(interfaceSkillFactor),
    ),
    interfaceBase,
    interfaceBoosts,
    interfaceNetworkFactor,
    hackingMultiplier,
    heat: state.heat,
    iceRating,
    iceRatingEarned: state.iceRating,
    iceRatingBonus: acc.iceRatingBonus,
    iceRatingTerms,
    heatReduction,
    legend: state.legend,
    nodePayoutMultiplier: saturate(nodePayoutBuyableFactor),
    nodePayoutTerms,
    nodePayoutBonus,
    interfaceSkillFactor: saturate(interfaceSkillFactor),
    hackingProficiencyFactor: saturate(hackingProficiencyFactor),
    heatCooldownSpeed: saturate(heatCooldownSpeed),
    heatCooldownBoost,
    heatCooldownAmount: saturate(sleeve.heatCooldownAmount + acc.extraHeatCooldownAmount),
    burnLeadFlatHeat: acc.burnLeadFlatHeat,
    idleHeatCooldown: saturate(acc.idleHeatCooldown),
    idleHeatCooldownActions: acc.idleHeatCooldownActions,
    moleAggregation: acc.moleAggregation,
    heatTaxCap: acc.heatTaxCap,
    criticalChance: acc.criticalChance,
    paysActions: acc.paysActions,
    criticalExtraChance: acc.criticalExtraChance,
    criticalRewardFactor: saturate(acc.criticalRewardFactor),
    overclockStrength: acc.overclockStrength,
    extraFocusSlots: acc.extraFocusSlots,
    focusStacking: acc.focusStacking,
    synthXpFactor: acc.synthXpFactor,
    overclockHeatFactors: acc.overclockHeatFactors,
  };
}

/**
 * A `BigNum` as a JS number for the factors that multiply speed and payouts. The bonuses are held at or below the game's infinity
 * (see `infinity.ts`); the factors derived from them are doubles and saturate there.
 */
function saturatingNumber(n: BigNum): number {
  const v = n.toNumber();
  return Number.isNaN(v) ? 0 : Math.min(v, INFINITY);
}
