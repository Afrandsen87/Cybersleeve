/**
 * @module ui
 * SVG geometry and event-driven tree highlighting, without page measurements.
 * Called by: `skillTree.ts`. Calls: `pathToRoot`, `childrenOf`, DOM APIs.
 */
import type { SkillNodeView } from '../view/skillTreeTypes';
import { childrenOf, pathToRoot } from '../view/skillTreePaths';

/** Default Automation geometry. Called by: tree widget and geometry tests. Calls: nothing. */
export const STEP_PX = 76;
/** Default Automation tile width. Called by: tree widget and tests. Calls: nothing. */
export const TILE_PX = 44;
/** Default half tile in horizontal grid units. Called by: geometry tests. Calls: nothing. */
export const HALF_TILE = TILE_PX / STEP_PX / 2;
/** SVG namespace. Called by: tree widget. Calls: nothing. */
export const SVG_NS = 'http://www.w3.org/2000/svg';

/** Persistent parent/child edge handles. Called by: tree widget. Calls: nothing. */
export interface TreeEdge {
  readonly path: SVGPathElement;
  readonly parentId: string;
  readonly childId: string;
}

/** Computes an orthogonal path in grid units from the tile edges.
 * Called by: tree widget. Calls: nothing.
 * @param parent source position
 * @param child destination position
 * @param halfTile horizontal tile radius in grid units
 * @returns SVG path data
 */
export function edgePath(parent: SkillNodeView, child: SkillNodeView, halfTile = HALF_TILE): string {
  const y1 = parent.row + 0.5;
  const y2 = child.row + 0.5;
  const x1 = parent.col + 0.5 + halfTile;
  const x2 = child.col + 0.5 - halfTile;
  return `M ${x1} ${y1} H ${(x1 + x2) / 2} V ${y2} H ${x2}`;
}

/** Toggles visible ancestor and child highlights on a hover event; encrypted nodes never glow.
 * Called by: tree hover handlers. Calls: pathToRoot, childrenOf, classList.toggle.
 * @param nodes current views
 * @param id preview id or null to clear
 * @param buttons persistent nodes
 * @param edges persistent SVG paths
 */
export function highlightPath(
  nodes: readonly SkillNodeView[],
  id: string | null,
  buttons: ReadonlyMap<string, HTMLButtonElement>,
  edges: readonly TreeEdge[],
): void {
  const readable = new Set(nodes.filter((n) => !n.masked).map((n) => n.view.id));
  const path = new Set(id && readable.has(id) ? pathToRoot(nodes, id).filter((key) => readable.has(key)) : []);
  const next = new Set(
    id && readable.has(id)
      ? childrenOf(nodes, id)
          .filter((n) => !n.masked)
          .map((n) => n.view.id)
      : [],
  );
  for (const [key, button] of buttons) {
    button.classList.toggle('onpath', path.has(key));
    button.classList.toggle('next', next.has(key));
  }
  for (const edge of edges) edge.path.classList.toggle('onpath', path.has(edge.parentId) && path.has(edge.childId));
}
