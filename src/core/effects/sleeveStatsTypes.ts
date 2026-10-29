/**
 * @module core
 *
 * The shapes the sleeve resolver returns: the sleeve-wide stats after every owned buyable is applied.
 *
 * Called by: `effects/sleeveResolver.ts`, `engine/*`, `ui/viewModel.ts`. Calls: nothing.
 */
import type { BigNum } from '../../numbers';
import type { ActionId, PaysActionRule } from '../types';

/** One owned buyable's share of a multiplier. */
export interface FactorTerm {
  /** The buyable that contributes the factor. */
  readonly buyableId: string;
  /** What it multiplies by (1 means it changes nothing right now). */
  readonly factor: number;
}

/** The global sleeve stats after all owned sleeve-wide buyables are applied. */
export interface SleeveStats {
  /** Access level (starts at `sleeve.baseAccessLevel`; each owned copy of an `accessLevel` buyable adds its `amount`). */
  readonly accessLevel: number;
  /** Interface speed multiplier: `interfaceBase * interfaceNetworkFactor * hackingMultiplier`. */
  readonly interfaceSpeed: number;
  /** Base interface speed plus `amount` per owned `interfaceSpeed` copy (`sleeve.baseInterfaceSpeed + interfaceBoosts`). */
  readonly interfaceBase: number;
  /** The part of {@link SleeveStats.interfaceBase} that owned `interfaceSpeed` buyables add (`amount` per copy). */
  readonly interfaceBoosts: number;
  /** Factor from `interfaceSpeedPerLnNodes` buyables (>= 1). */
  readonly interfaceNetworkFactor: number;
  /** The hacking multiplier: `1 +` Hacking Proficiency after the concave curve (see `concaveBonus`). Always >= 1. */
  readonly hackingMultiplier: number;
  /** Current heat. One point is one percent of credit tax before ICE Rating. */
  readonly heat: number;
  /** ICE Rating: the earned value plus the action-level bonuses, times the `iceRatingMultiplier` buyables (>= 1). */
  readonly iceRating: BigNum;
  /** The part of ICE Rating earned by runs (before bonuses and multipliers). */
  readonly iceRatingEarned: BigNum;
  /** Base ICE Rating added by `iceRatingFromActionLevel` buyables (added to the earned value before the multipliers). */
  readonly iceRatingBonus: BigNum;
  /** What each owned buyable that multiplies ICE Rating contributes, in configuration order. Their product is the total multiplier. */
  readonly iceRatingTerms: readonly FactorTerm[];
  /** Share (0..1) of the heat's effect removed by ICE Rating: `reductionPerOrder * log10(iceRating)`, at most 1. */
  readonly heatReduction: number;
  /** Legend: each point makes heat cool down faster. */
  readonly legend: number;
  /** Multiplier on what each network node produces, from `nodePayoutMultiplier` buyables (compounding per copy; >= 1). */
  readonly nodePayoutMultiplier: number;
  /** What each owned buyable that multiplies the node payout contributes, in configuration order. Their product is {@link SleeveStats.nodePayoutMultiplier}. */
  readonly nodePayoutTerms: readonly FactorTerm[];
  /** Credits per second added to the BASE value of every node, earned by actions paying `nodePayout` (>= 0). Buyables multiply the sum. */
  readonly nodePayoutBonus: number;
  /** Factor from `interfaceSpeedMultiplier` buyables, already part of `interfaceSpeed` (>= 1). */
  readonly interfaceSkillFactor: number;
  /** Factor from `hackingProficiencyMultiplier` buyables: Hacking Proficiency counts this many times as much (>= 1). */
  readonly hackingProficiencyFactor: number;
  /** How many times as fast heat cools from `heatCooldownSpeed` buyables (>= 1). The boost from Moles comes on top. */
  readonly heatCooldownSpeed: number;
  /** The extra cooldown speed (0.5 = 50 percent) that applies while Moles remain, from `backChannel` buyables (0 without one). */
  readonly heatCooldownBoost: number;
  /** Heat removed by each completed cooldown cycle: `sleeve.heatCooldownAmount` plus `heatCooldownAmountFromSleeveLevel` buyables (> 0). */
  readonly heatCooldownAmount: number;
  /** Heat each Burn lead takes away on top of its percentage, from `burnLeadFlatHeat` buyables (>= 0). */
  readonly burnLeadFlatHeat: number;
  /** How many times as fast heat cools while no action is in progress, from `idleHeatCooldown` buyables (>= 1). */
  readonly idleHeatCooldown: number;
  /** Actions that count as "no action in progress" while they run without Overclock (`idleHeatCooldownAction` buyables). */
  readonly idleHeatCooldownActions: readonly ActionId[];
  /** Heat cooling gained per order of magnitude of Moles held, or `null` while Moles are still spent (`moleAggregation`). */
  readonly moleAggregation: number | null;
  /** The largest share of node income the heat tax may take (1 = no cap), from `heatTaxCap` buyables. */
  readonly heatTaxCap: number;
  /** Chance that a completed run of any action is a critical success: the sum of owned `criticalChance` copies. It may exceed 1 (150% is one sure success and a 50% chance of a second). */
  readonly criticalChance: number;
  /** What each completed run of an action may also pay: one reward of another action, by chance (`paysActionReward` buyables). */
  readonly paysActions: readonly PaysActionRule[];
  /** Chance (0..1) that a critical success brings one extra critical success (`criticalExtraChance` buyables). */
  readonly criticalExtraChance: number;
  /** What the reward of every critical success is multiplied by (`criticalRewardMultiplier` buyables, >= 1). */
  readonly criticalRewardFactor: number;
  /** How strong every Overclock is: 1, plus `perCopy` for each copy of an Overclock strength buyable (>= 1). */
  readonly overclockStrength: number;
  /** Focus slots bought on top of `focus.baseSlots` (>= 0). */
  readonly extraFocusSlots: number;
  /** Several Focus slots may sit on one action. */
  readonly focusStacking: boolean;
  /** What an action's XP per run is multiplied by while its level is below the best synthetic sleeve's level on it (1 without Neural Mirror). */
  readonly synthXpFactor: number;
  /** The heat factor `overclockHeatFactor` buyables set for an action's Overclock (lowest wins); an action without an entry keeps its rule's own factor. */
  readonly overclockHeatFactors: Readonly<Record<ActionId, number>>;
}
