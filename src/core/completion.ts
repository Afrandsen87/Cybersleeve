/**
 * @module core
 *
 * What an action does to the game each time a run completes, besides paying its reward.
 */
import type { NumberFactory } from '../numbers';
import type { BigNum } from '../numbers';
import type { CompletionEffect, GameState } from './types';

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
 * Nodes are whole: each run removes `floor(fraction * nodes)` (see {@link removeNodes}). Adding heat adds `heat` once per run.
 * Called by: `engine.ts` (`GameEngine.completeRuns`).
 *
 * @param effects the effects to apply (nothing happens for `undefined` or an empty list)
 * @param state state to mutate (reads and writes `network` and `heat`)
 * @param runs number of completed runs (>= 1)
 * @param factory number factory
 */
export function applyCompletionEffects(
  effects: readonly CompletionEffect[] | undefined,
  state: Pick<GameState, 'network' | 'heat'>,
  runs: number,
  factory: NumberFactory,
): void {
  for (const effect of effects ?? []) {
    switch (effect.kind) {
      case 'removeNodesFraction':
        state.network = removeNodes(state.network, effect.fraction, runs, factory);
        break;
      case 'addHeat':
        state.heat += effect.heat * runs;
        break;
    }
  }
}
