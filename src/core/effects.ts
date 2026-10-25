/**
 * @module core
 *
 * Translates owned buyables into the effects that apply to one action or to the sleeve as a whole.
 */
import type { BigNum, NumberFactory } from '../numbers';
import { type CurveBeyond, concaveBonus } from './concaveBonus';
import { type ActionAccumulator, definitionOf, type SleeveAccumulator } from './effectRegistry';
import { INFINITY, saturate } from './infinity';
import type { ActionId, BuyableDefinition, GameState, ItemDropRule, SleeveConfig } from './types';

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
  /** ICE Rating: the earned value times the `iceRatingMultiplier` buyables (>= 1). */
  readonly iceRating: BigNum;
  /** Share (0..1) of the heat's effect removed by ICE Rating: `reductionPerOrder * log10(iceRating)`, at most 1. */
  readonly heatReduction: number;
  /** Infamy: each point makes heat cool down more slowly. */
  readonly infamy: number;
  /** Multiplier on what each network node produces, from `nodePayoutMultiplier` buyables (compounding per copy; >= 1). */
  readonly nodePayoutMultiplier: number;
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
  /** Chance (0..1) that a completed run of any action is a critical success: the sum of owned `criticalChance` copies, capped at 1. */
  readonly criticalChance: number;
  /** How strong every Overclock is: 1, plus `perCopy` for each copy of an Overclock strength buyable (>= 1). */
  readonly overclockStrength: number;
  /** Focus slots bought on top of `focus.baseSlots` (>= 0). */
  readonly extraFocusSlots: number;
}

/** Aggregated purchase effects for one action. */
export interface ActionEffects {
  /** The action restarts itself when it completes. */
  readonly autoRun: boolean;
  /** The Overclock toggle of the action is unlocked. */
  readonly overclockUnlocked: boolean;
  /** The Focus toggle of the action is unlocked. */
  readonly focusUnlocked: boolean;
  /** Multiplies the action's own reward per run and nothing else (>= 1). A BigNum: it can grow without bound. */
  readonly rewardMultiplier: BigNum;
  /** Items the action may drop per completed run (one rule per owned `itemDrop` buyable). */
  readonly drops: readonly ItemDropRule[];
  /** The share of each rarity's weight that moves on per order of magnitude of Hacking Proficiency, one entry per owned `rarityShiftFromProficiency` buyable. */
  readonly rarityShifts: readonly number[];
}

/**
 * Collects the effects of all owned buyables that target `actionId`.
 *
 * @remarks
 * An auto-run buyable the player has switched off (`state.autoRunOff`) does not count. An effect applies once per copy owned: a reward multiplier with factor `f` and `n` copies
 * contributes `f^n`. Contributions of different buyables multiply together.
 * Called by: `engine.ts`, `ui/viewModel.ts`.
 *
 * @param buyables all buyable definitions
 * @param state current state (reads `purchased`)
 * @param actionId the action to resolve effects for
 * @param factory number factory
 * @returns the aggregated effects
 */
export function resolveEffects(
  buyables: readonly BuyableDefinition[],
  state: Pick<GameState, 'purchased'> & Partial<Pick<GameState, 'autoRunOff'>>,
  actionId: ActionId,
  factory: NumberFactory,
): ActionEffects {
  const acc: ActionAccumulator = {
    autoRun: false,
    overclockUnlocked: false,
    focusUnlocked: false,
    rewardMultiplier: factory.fromNumber(1),
    drops: [],
    rarityShifts: [],
  };
  for (const b of buyables) {
    const owned = state.purchased[b.id] ?? 0;
    if (owned <= 0 || b.actionId !== actionId) continue;
    definitionOf(b).action?.(acc, b.effect, { owned, switchedOff: state.autoRunOff?.[b.id] === true, factory });
  }
  return acc;
}

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
 * Access level is `sleeve.baseAccessLevel` plus `amount` per owned `accessLevel` copy (copies stack). Heat and Infamy are the current values in the state. ICE Rating is the earned value plus the
 * `iceRatingFromActionLevel` bonuses (`perLevel * action level * copies`), times `factor^copies` of every `iceRatingMultiplier` buyable; the heat reduction is `iceRatingReductionPerOrder` per
 * order of magnitude of it (capped at 100%). The node payout multiplier is `factor^copies` of the `nodePayoutMultiplier` buyables; the node payout bonus
 * earned by actions is a separate amount added to the base value of a node (see `Economy.passiveCreditsPerNode`).
 * Called by: `engine.ts`.
 *
 * @param buyables all buyable definitions
 * @param state current state (reads `purchased`, `heat`, `network`, `hackingProficiency`, `iceRating`, `infamy`)
 * @param sleeve base values of the stats
 * @param factory number factory
 * @param actionLevelOf plain action level of an action (read by effects that scale with one; defaults to level 0 for all)
 * @returns the current stats
 */
export function resolveSleeveStats(
  buyables: readonly BuyableDefinition[],
  state: Pick<
    GameState,
    'purchased' | 'heat' | 'hackingProficiency' | 'network' | 'iceRating' | 'infamy' | 'nodePayoutBonus' | 'inventory'
  >,
  sleeve: SleeveConfig,
  factory: NumberFactory,
  actionLevelOf: (actionId: ActionId) => number = () => 0,
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
    criticalChance: 0,
    overclockStrength: 1,
    extraFocusSlots: 0,
  };
  for (const b of buyables) {
    const owned = state.purchased[b.id] ?? 0;
    if (owned > 0) definitionOf(b).sleeve?.(acc, b.effect, { owned, state, factory, actionLevelOf });
  }
  const { accessLevel, interfaceBoosts, interfaceNetworkFactor } = acc;
  const iceRating = state.iceRating.add(acc.iceRatingBonus).mul(acc.iceRatingFactor);
  const interfaceSkillFactor = acc.interfaceSkillFactor;
  const hackingProficiencyFactor = acc.hackingProficiencyFactor;
  const nodePayoutBuyableFactor = acc.nodePayoutFactor;
  const heatCooldownSpeed = acc.heatCooldownSpeed;
  const heatCooldownBoost = acc.heatCooldownBoost;
  const interfaceBase = sleeve.baseInterfaceSpeed + interfaceBoosts;
  const orders = iceRating.log10();
  const heatReduction = Number.isFinite(orders) && orders > 0 ? Math.min(1, sleeve.iceRatingReductionPerOrder * orders) : 0;
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
    heatReduction,
    infamy: state.infamy,
    nodePayoutMultiplier: saturate(nodePayoutBuyableFactor),
    nodePayoutBonus,
    interfaceSkillFactor: saturate(interfaceSkillFactor),
    hackingProficiencyFactor: saturate(hackingProficiencyFactor),
    heatCooldownSpeed: saturate(heatCooldownSpeed),
    heatCooldownBoost,
    criticalChance: Math.min(1, acc.criticalChance),
    overclockStrength: acc.overclockStrength,
    extraFocusSlots: acc.extraFocusSlots,
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

/**
 * Level bonus an action gets from `levelBonusFromSleeveLevel` buyables: the sleeve level of the source action, per copy owned.
 *
 * @remarks
 * It is added to the action's level when speed is computed; it never changes the action's XP or leveling progress.
 * Called by: `engine.ts`.
 *
 * @param buyables all buyable definitions
 * @param state current state (reads `purchased`)
 * @param actionId the action that receives the bonus
 * @param sleeveLevelOf sleeve level of an action
 * @returns the flat number of levels to add (>= 0)
 */
export function resolveLevelBonus(
  buyables: readonly BuyableDefinition[],
  state: Pick<GameState, 'purchased'>,
  actionId: ActionId,
  sleeveLevelOf: (actionId: ActionId) => number,
): number {
  let bonus = 0;
  for (const b of buyables) {
    const owned = state.purchased[b.id] ?? 0;
    if (owned <= 0 || b.effect.kind !== 'levelBonusFromSleeveLevel' || b.effect.targetActionId !== actionId) continue;
    bonus += sleeveLevelOf(b.effect.sourceActionId) * owned;
  }
  return bonus;
}

/**
 * Fraction of its own size the network gains per second, summed over owned growth buyables: `networkGrowth` adds its fixed
 * `ratePerSecond`; `networkGrowthFromActionLevel` adds `level * percentPerLevel / 100` of its source action's level.
 *
 * Called by: `stats.ts` (`DerivedStats.networkGrowthRate`).
 *
 * @param buyables all buyable definitions
 * @param state current state (reads `purchased`)
 * @param actionLevelOf plain action level of an action (without level bonuses)
 * @returns the growth rate per second (>= 0; 0.000001 means 0.0001 percent)
 */
export function resolveNetworkGrowth(
  buyables: readonly BuyableDefinition[],
  state: Pick<GameState, 'purchased'>,
  actionLevelOf: (actionId: ActionId) => number,
): number {
  let rate = 0;
  for (const b of buyables) {
    const owned = state.purchased[b.id] ?? 0;
    if (owned <= 0) continue;
    if (b.effect.kind === 'networkGrowth') rate += b.effect.ratePerSecond * owned;
    else if (b.effect.kind === 'networkGrowthFromActionLevel') {
      rate += ((actionLevelOf(b.effect.sourceActionId) * b.effect.percentPerLevel) / 100) * owned;
    }
  }
  return rate;
}

/**
 * The factor owned `itemDropChanceMultiplier` buyables apply to the drop chance of an item: `factor^copies`, multiplied over buyables.
 *
 * Called by: `stats.ts` (`DerivedStats.itemDrops`).
 *
 * @param buyables all buyable definitions
 * @param state current state (reads `purchased`)
 * @param itemId the item whose drop chance is asked about
 * @returns a factor >= 1 (1 when none is owned)
 */
export function resolveDropChanceFactor(
  buyables: readonly BuyableDefinition[],
  state: Pick<GameState, 'purchased'>,
  itemId: string,
): number {
  let factor = 1;
  for (const b of buyables) {
    const owned = state.purchased[b.id] ?? 0;
    if (owned > 0 && b.effect.kind === 'itemDropChanceMultiplier' && b.effect.itemId === itemId) factor *= b.effect.factor ** owned;
  }
  return saturate(factor);
}

/** What an owned `backChannel` buyable lets the player do. */
export interface BackChannelRule {
  readonly itemId: string;
  readonly rarityId: string;
  /** Moles one given-up item is worth. */
  readonly molesPerItem: number;
  /** The extra cooldown speed (0.5 = 50 percent) while Moles remain. */
  readonly cooldownBoost: number;
}

/**
 * The back channel the player has unlocked, if any (the first owned `backChannel` buyable).
 *
 * Called by: `stats.ts` (`DerivedStats.backChannel`).
 *
 * @param buyables all buyable definitions
 * @param state current state (reads `purchased`)
 * @returns the rule, or `null` while none is owned
 */
export function resolveBackChannel(buyables: readonly BuyableDefinition[], state: Pick<GameState, 'purchased'>): BackChannelRule | null {
  for (const b of buyables) {
    if ((state.purchased[b.id] ?? 0) > 0 && b.effect.kind === 'backChannel') {
      const { itemId, rarityId, molesPerItem, cooldownBoost } = b.effect;
      return { itemId, rarityId, molesPerItem, cooldownBoost };
    }
  }
  return null;
}
