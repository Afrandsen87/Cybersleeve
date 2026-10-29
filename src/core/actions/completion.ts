/**
 * @module core
 *
 * What an action does to the game each time a run completes, besides paying its reward.
 */
import type { BigNum, NumberFactory } from '../../numbers';
import { assertNever } from '../effects/effectTraits';
import type { CompletionEffect, StateSlice } from '../types';

/** Runs that remove nodes one run at a time (each rounded down); any further runs of one batch use the closed form. */
const SEQUENTIAL_RUN_LIMIT = 10_000;

/**
 * Removes `fraction` of the nodes for each of `runs` runs, rounding each removal down to whole nodes (so a few nodes are
 * never removed). Stops early once a run would remove nothing. Beyond `SEQUENTIAL_RUN_LIMIT` runs the rest is applied in
 * closed form, which only matters for configurations where rounding is irrelevant (huge networks).
 */
function removeNodes(nodes: BigNum, fraction: number, runs: number, factory: NumberFactory): BigNum {
  const share = factory.fromNumber(fraction);
  let remaining = runs;
  for (let i = 0; i < Math.min(runs, SEQUENTIAL_RUN_LIMIT); i++) {
    const removed = nodes.mul(share).floor();
    if (removed.isZero()) return nodes;
    nodes = nodes.sub(removed);
    remaining--;
  }
  return remaining > 0 ? nodes.mul(factory.fromNumber(1 - fraction).pow(remaining)).floor() : nodes;
}

/**
 * Applies an action's completion effects for `runs` completed runs, in the order they are listed.
 *
 * @remarks
 * Nodes are whole: each run of `removeNodesFraction` removes `floor(fraction * nodes)` (see {@link removeNodes}); `removeNodes` removes
 * a fixed number per run, in closed form, and stops at 0. Heat is not an effect: actions add
 * heat through `ActionDefinition.heatPerRun`.
 * Called by: `actionRunner.ts` (`ActionRunner.completeRuns`).
 *
 * @param effects the effects to apply (nothing happens for `undefined` or an empty list)
 * @param state state to mutate (reads and writes `network`)
 * @param runs number of completed runs (>= 1)
 * @param factory number factory
 */
export function applyCompletionEffects(
  effects: readonly CompletionEffect[] | undefined,
  state: StateSlice<'network'>,
  runs: number,
  factory: NumberFactory,
): void {
  for (const effect of effects ?? []) {
    switch (effect.kind) {
      case 'removeNodesFraction':
        state.sleeve.network = removeNodes(state.sleeve.network, effect.fraction, runs, factory);
        break;
      case 'removeNodes': {
        const left = state.sleeve.network.sub(factory.fromNumber(effect.amount).mul(factory.fromNumber(runs)));
        state.sleeve.network = left.isNegative() ? factory.fromNumber(0) : left;
        break;
      }
      default:
        assertNever(effect);
    }
  }
}
