/**
 * @module ui
 * Pure global layout for a tree whose singleton trunk parents other branches.
 * Called by: `widgets/skillTree.ts`. Calls: nothing.
 */
import type { SkillLaneView, SkillNodeView } from './skillTreeTypes';

/** A coloured band with global node coordinates. Called by: joined drawing. Calls: nothing. */
export interface SkillBandView extends SkillLaneView {
  /** First global row occupied by this band. */
  readonly firstRow: number;
}

/** Global grid and neutral trunk. Called by: joined drawing. Calls: nothing. */
export interface JoinedSkillTree {
  readonly trunk: SkillNodeView;
  readonly trunkBranch: string;
  readonly bands: readonly SkillBandView[];
  readonly cols: number;
  readonly rows: number;
}

/**
 * Joins lanes only when a singleton parentless branch has a child in another lane.
 * Preserves input objects; ordinary trees return null and retain their original layout.
 * Called by: `mountSkillTree`, layout tests. Calls: nothing.
 * @param lanes Local lane layouts, including all parent ids.
 * @returns Global coordinates and contiguous bands, or null without a trunk.
 */
export function joinSkillLanes(lanes: readonly SkillLaneView[]): JoinedSkillTree | null {
  const trunkLane = lanes.find((lane) => {
    const node = lane.nodes[0];
    return (
      lane.nodes.length === 1 &&
      node?.parents.length === 0 &&
      lanes.some((other) => other !== lane && other.nodes.some((child) => child.parents.includes(node.view.id)))
    );
  });
  const trunk = trunkLane?.nodes[0];
  if (!trunkLane || !trunk) return null;
  const paths = lanes.filter((lane) => lane !== trunkLane);
  const rows = paths.reduce((sum, lane) => sum + lane.rows, 0);
  const cols = Math.max(...paths.map((lane) => lane.cols)) + 1;
  let firstRow = 0;
  const bands = paths.map((lane) => {
    const band = { ...lane, firstRow, cols, nodes: lane.nodes.map((node) => ({ ...node, col: node.col + 1, row: node.row + firstRow })) };
    firstRow += lane.rows;
    return band;
  });
  return { trunk: { ...trunk, col: 0, row: (rows - 1) / 2 }, trunkBranch: trunkLane.id, bands, cols, rows };
}
