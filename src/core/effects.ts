/**
 * @module core
 *
 * Translates owned buyables into the effects that apply to one action or to the sleeve as a whole.
 */
import type { BigNum, NumberFactory } from '../numbers';
import type { ActionId, BuyableDefinition, GameState, SleeveConfig } from './types';

/** The global sleeve stats after all owned sleeve-wide buyables are applied. */
export interface SleeveStats {
  /** Access level (starts at `sleeve.baseAccessLevel`; an `accessLevel` buyable raises it to its level). */
  readonly accessLevel: number;
  /** Interface speed multiplier: `interfaceBase * interfaceNetworkFactor * interfaceEarnedFactor`. */
  readonly interfaceSpeed: number;
  /** Base interface speed plus `amount` per owned `interfaceSpeed` copy. */
  readonly interfaceBase: number;
  /** Factor from `interfaceSpeedPerLnNodes` buyables (>= 1). */
  readonly interfaceNetworkFactor: number;
  /** `1 + the bonus earned by actions`. */
  readonly interfaceEarnedFactor: number;
  /** Current heat. One point is one percent of credit tax before Circumvention. */
  readonly heat: number;
  /** Circumvention: the earned value times the `circumventionMultiplier` buyables (>= 1). */
  readonly circumvention: BigNum;
  /** Share (0..1) of the heat's effect removed by Circumvention: `reductionPerOrder * log10(circumvention)`, at most 1. */
  readonly heatReduction: number;
  /** Infamy: each point makes heat cool down more slowly. */
  readonly infamy: number;
  /** Multiplier on what each network node produces: `nodePayoutBuyableFactor * nodePayoutEarnedFactor` (>= 1). */
  readonly nodePayoutMultiplier: number;
  /** Part of the node payout multiplier from `nodePayoutMultiplier` buyables (compounding per copy; >= 1). */
  readonly nodePayoutBuyableFactor: number;
  /** Part of the node payout multiplier earned by actions: `1 + the node payout bonus`. */
  readonly nodePayoutEarnedFactor: number;
}

/** Aggregated purchase effects for one action. */
export interface ActionEffects {
  /** The action restarts itself when it completes. */
  readonly autoRun: boolean;
  /** Multiplies credits, XP and the number of runs counted per cycle (>= 1). A BigNum: it can grow without bound. */
  readonly outputMultiplier: BigNum;
}

/**
 * Collects the effects of all owned buyables that target `actionId`.
 *
 * @remarks
 * An auto-run buyable the player has switched off (`state.autoRunOff`) does not count. An effect applies once per copy owned: an output multiplier with factor `f` and `n` copies
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
  let autoRun = false;
  let outputMultiplier = factory.fromNumber(1);
  for (const b of buyables) {
    const owned = state.purchased[b.id] ?? 0;
    if (owned <= 0 || b.actionId !== actionId) continue;
    switch (b.effect.kind) {
      case 'autoRun':
        if (!state.autoRunOff?.[b.id]) autoRun = true;
        break;
      case 'outputMultiplier':
        outputMultiplier = outputMultiplier.mul(factory.fromNumber(b.effect.factor).pow(owned));
        break;
      default:
        break; // sleeve-wide effects have no actionId and never reach this point
    }
  }
  return { autoRun, outputMultiplier };
}

/**
 * Collects the effects of all owned sleeve-wide buyables.
 *
 * @remarks
 * Interface speed is `(base + amounts) * networkFactor * (1 + earned)`: `base` is `sleeve.baseInterfaceSpeed`, `amounts` is
 * `amount` per owned `interfaceSpeed` copy, `networkFactor` is `(1 + perLn * ln(nodes))` per owned
 * `interfaceSpeedPerLnNodes` copy (never below 1), and `earned` is the bonus earned by actions. Each run adds the same
 * amount to `earned`, so every doubling takes more runs than the last. Access level takes the highest `level` among owned
 * copies (never below the base). Heat and Infamy are the current values in the state. Circumvention is the earned value times
 * `factor^copies` of every `circumventionMultiplier` buyable; the heat reduction is `circumventionReductionPerOrder` per
 * order of magnitude of it (capped at 100%). The node payout multiplier is `factor^copies` of the `nodePayoutMultiplier` buyables times
 * `(1 + the node payout bonus earned by actions)`.
 * Called by: `engine.ts`.
 *
 * @param buyables all buyable definitions
 * @param state current state (reads `purchased`, `heat`, `network`, `interfaceSpeedBonus`, `circumvention`, `infamy`)
 * @param sleeve base values of the stats
 * @param factory number factory
 * @returns the current stats
 */
export function resolveSleeveStats(
  buyables: readonly BuyableDefinition[],
  state: Pick<GameState, 'purchased' | 'heat' | 'interfaceSpeedBonus' | 'network' | 'circumvention' | 'infamy' | 'nodePayoutBonus'>,
  sleeve: SleeveConfig,
  factory: NumberFactory,
): SleeveStats {
  let accessLevel = sleeve.baseAccessLevel;
  let interfaceBase = sleeve.baseInterfaceSpeed;
  let interfaceNetworkFactor = 1;
  let circumvention = state.circumvention;
  let nodePayoutBuyableFactor = 1;
  for (const b of buyables) {
    const owned = state.purchased[b.id] ?? 0;
    if (owned <= 0) continue;
    switch (b.effect.kind) {
      case 'interfaceSpeed':
        interfaceBase += b.effect.amount * owned;
        break;
      case 'interfaceSpeedPerLnNodes':
        interfaceNetworkFactor *= (1 + b.effect.perLn * naturalLog(state.network)) ** owned;
        break;
      case 'accessLevel':
        accessLevel = Math.max(accessLevel, b.effect.level);
        break;
      case 'nodePayoutMultiplier':
        nodePayoutBuyableFactor *= b.effect.factor ** owned;
        break;
      case 'circumventionMultiplier':
        circumvention = circumvention.mul(factory.fromNumber(b.effect.factor).pow(owned));
        break;
      default:
        break;
    }
  }
  const orders = circumvention.log10();
  const heatReduction = Number.isFinite(orders) && orders > 0 ? Math.min(1, sleeve.circumventionReductionPerOrder * orders) : 0;
  const interfaceEarnedFactor = 1 + state.interfaceSpeedBonus;
  return {
    accessLevel,
    interfaceSpeed: interfaceBase * interfaceNetworkFactor * interfaceEarnedFactor,
    interfaceBase,
    interfaceNetworkFactor,
    interfaceEarnedFactor,
    heat: state.heat,
    circumvention,
    heatReduction,
    infamy: state.infamy,
    nodePayoutMultiplier: nodePayoutBuyableFactor * (1 + state.nodePayoutBonus),
    nodePayoutBuyableFactor,
    nodePayoutEarnedFactor: 1 + state.nodePayoutBonus,
  };
}

/** `ln(n)`, but never below 0 (so a network of 0 or 1 nodes adds nothing). */
function naturalLog(n: BigNum): number {
  const ln = n.log10() * Math.LN10;
  return Number.isFinite(ln) && ln > 0 ? ln : 0;
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
 * Fraction of its own size the network gains per second, summed over owned `networkGrowth` buyables.
 *
 * Called by: `engine.ts`.
 *
 * @param buyables all buyable definitions
 * @param state current state (reads `purchased`)
 * @returns the growth rate per second (>= 0; 0.000001 means 0.0001 percent)
 */
export function resolveNetworkGrowth(buyables: readonly BuyableDefinition[], state: Pick<GameState, 'purchased'>): number {
  let rate = 0;
  for (const b of buyables) {
    const owned = state.purchased[b.id] ?? 0;
    if (owned > 0 && b.effect.kind === 'networkGrowth') rate += b.effect.ratePerSecond * owned;
  }
  return rate;
}
