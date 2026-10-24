/**
 * @module core
 *
 * Translates owned buyables into the effects that apply to one action.
 */
import type { BigNum, NumberFactory } from '../numbers';
import type { ActionId, BuyableDefinition, GameState, SleeveConfig } from './types';

/** The global sleeve stats after all owned sleeve-wide buyables are applied. */
export interface SleeveStats {
  /** Access level (starts at `sleeve.baseAccessLevel`; an `accessLevel` buyable raises it to its level). */
  readonly accessLevel: number;
  /** Interface speed multiplier (base plus `amount` per owned `interfaceSpeed` copy). */
  readonly interfaceSpeed: number;
  /** Current heat. One point is one percent of credit tax. */
  readonly heat: number;
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
 * An effect applies once per copy owned: an output multiplier with factor `f` and `n` copies
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
  state: Pick<GameState, 'purchased'>,
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
        autoRun = true;
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
 * Interface speed adds `amount` per copy owned; access level takes the highest `level` among owned copies
 * (never below the base). Heat is the current heat in the state.
 * Called by: `engine.ts`.
 *
 * @param buyables all buyable definitions
 * @param state current state (reads `purchased`)
 * @param sleeve base values of the stats
 * @returns the current stats
 */
export function resolveSleeveStats(
  buyables: readonly BuyableDefinition[],
  state: Pick<GameState, 'purchased' | 'heat'>,
  sleeve: SleeveConfig,
): SleeveStats {
  let accessLevel = sleeve.baseAccessLevel;
  let interfaceSpeed = sleeve.baseInterfaceSpeed;
  for (const b of buyables) {
    const owned = state.purchased[b.id] ?? 0;
    if (owned <= 0 || b.actionId !== undefined) continue;
    switch (b.effect.kind) {
      case 'interfaceSpeed':
        interfaceSpeed += b.effect.amount * owned;
        break;
      case 'accessLevel':
        accessLevel = Math.max(accessLevel, b.effect.level);
        break;
      default:
        break;
    }
  }
  return { accessLevel, interfaceSpeed, heat: state.heat };
}
