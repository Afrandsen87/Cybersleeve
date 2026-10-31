/**
 * @module ui
 * Branch-header summaries from existing tree views, including visible encrypted places.
 * Called by: Firmware panel and tests. Calls: nothing.
 */
import type { FirmwareText } from '../firmwareText';
import type { SkillLaneView } from './skillTreeTypes';

/** Header counts and safe purpose text. Called by: branchSummary and widgets. Calls: nothing. */
export interface BranchSummary {
  readonly installed: number;
  readonly total: number;
  readonly purpose: string | null;
}

/**
 * Counts visible node places; encrypted places are public under the tree reveal exception.
 * Called by: Firmware branch headers. Calls: nothing.
 * @param lane Existing branch view.
 * @param text Purpose wording.
 * @returns Owned-node count, total places and purpose only when some node is readable.
 */
export function branchSummary(lane: SkillLaneView, text: FirmwareText): BranchSummary {
  return {
    installed: lane.nodes.filter((node) => node.view.owned > 0).length,
    total: lane.nodes.length,
    purpose: lane.nodes.some((node) => !node.masked) ? (text.branchPurpose[lane.id] ?? null) : null,
  };
}
