/**
 * @module testing
 *
 * Test helper: the buyable views of a skill tree, flat, in lane order.
 *
 * @remarks
 * Called by: the skill-tree and skill-tab tests. Calls: nothing.
 */
import type { BuyableView, SkillLaneView } from '../ui/viewModel';

/** The view of every skill in the lanes, lane by lane (a masked skill is its masked view). */
export function skillViews(lanes: readonly SkillLaneView[]): BuyableView[] {
  return lanes.flatMap((lane) => lane.nodes.map((n) => n.view));
}
