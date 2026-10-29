/**
 * @module core
 *
 * Translates owned buyables into the effects that apply to one action.
 *
 * Called by: `engine/*`, `ui/viewModel.ts`. Calls: `effectRegistry.definitionOf` (the action hooks).
 */
import type { BigNum, NumberFactory } from '../../numbers';
import { type ActionAccumulator, definitionOf } from './effectRegistry';
import type { ActionId, BuyableDefinition, ChainRule, GameState, ItemDropRule } from '../types';

/** Aggregated purchase effects for one action. */
export interface ActionEffects {
  /** The action restarts itself when it completes. */
  readonly autoRun: boolean;
  /** The Overclock toggle of the action is unlocked. */
  readonly overclockUnlocked: boolean;
  /** The Focus toggle of the action is unlocked. */
  readonly focusUnlocked: boolean;
  /** The chain an owned `overclockChain` buyable adds to the action's Overclock, or `null`. */
  readonly chain: ChainRule | null;
  /** Multiplies the action's own reward per run and nothing else (>= 1). A BigNum: it can grow without bound. */
  readonly rewardMultiplier: BigNum;
  /** What the critical success multipliers of the action are multiplied by (>= 1; `criticalBoost` buyables). */
  readonly criticalFactor: number;
  /** The actions every critical run of this action banks a guaranteed critical success for (`criticalLink` buyables). */
  readonly criticalLinks: readonly ActionId[];
  /** The `perLevel` of every owned `startCostReduction` buyable of the action (the share is multiplied by `(1 - perLevel)^level` for each). */
  readonly startCostReductions: readonly number[];
  /** Seconds of node income paid per node the start cost destroys (`creditSiphon` buyables; 0 without one). */
  readonly siphonSeconds: number;
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
    chain: null,
    rewardMultiplier: factory.fromNumber(1),
    criticalFactor: 1,
    criticalLinks: [],
    startCostReductions: [],
    siphonSeconds: 0,
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
