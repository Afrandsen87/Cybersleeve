/**
 * @module ui
 *
 * Skill branches that stay out of the Skills tab (the lane, its title and every node) until a stat is revealed.
 *
 * @remarks
 * Called by: `panelViews.ts`. Calls: `statReveal.ts`. Pure.
 * The rules are data (`BRANCH_REVEAL_STAT`): gating another branch adds one entry. This overrides the "skills always show every node"
 * rule for the branches listed here, because their whole subject (heat) is not known to the player yet.
 */
import type { GameConfig, SleeveStats, StateSliceView } from '../../core';
import { BRANCH_ANONYMITY } from '../../content/ids';
import { heatOrIceMoved, isStatHidden, type RevealableStat } from './statReveal';

/** Branch id to the stat that must be revealed before the branch shows. */
export const BRANCH_REVEAL_STAT: Readonly<Record<string, RevealableStat>> = {
  [BRANCH_ANONYMITY]: 'heat',
};

/**
 * Builds the question "is this branch hidden right now?".
 *
 * Called by: `skillsView`. Calls: {@link isStatHidden}.
 *
 * @param config game configuration
 * @param state the game state (reads `purchased`)
 * @param stats the sleeve stats now (access level, heat, ICE Rating)
 * @returns a function from a branch id to `true` when the branch must not be shown; branches without a rule are never hidden
 */
export function branchHiddenFn(config: GameConfig, state: StateSliceView<'purchased'>, stats: SleeveStats): (branchId: string) => boolean {
  const reveal = { config, accessLevel: stats.accessLevel, owned: (id: string): number => state.sleeve.purchased[id] ?? 0 };
  const moved = heatOrIceMoved(stats, config);
  return (branchId) => {
    const stat = BRANCH_REVEAL_STAT[branchId];
    return stat !== undefined && isStatHidden(stat, reveal, moved);
  };
}
