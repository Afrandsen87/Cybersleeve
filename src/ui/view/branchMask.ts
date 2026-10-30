/**
 * @module ui
 *
 * Skill branches whose skills all read `???` until a stat is revealed. The lane and its nodes stay visible; only the text is masked.
 *
 * @remarks
 * Called by: `panelViews.ts`, `skillTree.ts` (through `SkillTreeInput.branchMasked`). Calls: `statReveal.ts`. Pure.
 * The rules are data (`BRANCH_REVEAL_STAT`): masking another branch adds one entry. The branch's whole subject (heat) is not known to the
 * player yet, so none of its skills may talk about it.
 */
import type { GameConfig, SleeveStats, StateSliceView } from '../../core';
import { BRANCH_ANONYMITY } from '../../content/ids';
import { heatOrIceMoved, isStatHidden, type RevealableStat } from './statReveal';

/** Branch id to the stat that must be revealed before the text of its skills is readable. */
export const BRANCH_REVEAL_STAT: Readonly<Record<string, RevealableStat>> = {
  [BRANCH_ANONYMITY]: 'heat',
};

/**
 * Builds the question "is the text of this branch masked right now?".
 *
 * Called by: `skillsView`. Calls: {@link isStatHidden}.
 *
 * @param config game configuration
 * @param state the game state (reads `purchased`)
 * @param stats the sleeve stats now (access level, heat, ICE Rating)
 * @returns a function from a branch id to `true` when every skill of the branch must read as hidden; branches without a rule are never masked
 */
export function branchMaskedFn(config: GameConfig, state: StateSliceView<'purchased'>, stats: SleeveStats): (branchId: string) => boolean {
  const reveal = { config, accessLevel: stats.accessLevel, owned: (id: string): number => state.sleeve.purchased[id] ?? 0 };
  const moved = heatOrIceMoved(stats, config);
  return (branchId) => {
    const stat = BRANCH_REVEAL_STAT[branchId];
    return stat !== undefined && isStatHidden(stat, reveal, moved);
  };
}
