/**
 * @module ui
 *
 * A skill tree drawn sideways: one lane per branch, the roots on the left, each skill to the right of the ones it needs, with a line
 * from every parent to its child.
 *
 * @remarks
 * Called by: `skillsPanel.ts` (the skills and the re-sleeve skills). Calls: `upgradeButtons.ts`, `domKit.ts`.
 *
 * The grid is fixed by the content, so everything is built once: nodes are placed with the CSS variables `--col` and `--row`, the lines
 * are SVG paths in grid units (no measuring of the page), and a refresh only toggles classes and text.
 */
import type { SkillLaneView, SkillNodeView } from '../viewModel';
import { type UiContext, h, setText } from './domKit';
import { renderUpgrades } from './upgradeButtons';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** A drawn skill tree. */
export interface SkillTreeWidget {
  /** The tree's element, to place in a box. */
  readonly element: HTMLElement;
  /** Writes the lanes into the tree: text, masking, locked and owned looks, and which lines are lit. */
  render(lanes: readonly SkillLaneView[]): void;
}

/** One parent-to-child line, lit once the parent is owned. */
interface Edge {
  readonly path: SVGPathElement;
  readonly parentId: string;
}

/**
 * Builds a skill tree once, with a button for every node of every lane.
 *
 * Called by: `mountSkillsPanel`. Calls: {@link edgePath}.
 *
 * @param ctx what the tree needs from the screen (icons, tips, the buy command)
 * @param initial the lanes as the first refresh sees them (decides which nodes exist; the tree's shape does not change afterwards)
 */
export function mountSkillTree(ctx: UiContext, initial: readonly SkillLaneView[]): SkillTreeWidget {
  const element = h('div', 'skill-tree');
  const buttons = new Map<string, HTMLButtonElement>();
  const edges: Edge[] = [];

  for (const lane of initial) {
    const laneEl = h('section', 'skill-lane');
    laneEl.dataset['branch'] = lane.id;
    if (lane.title) laneEl.append(h('h3', 'lane-title', lane.title));
    const grid = h('div', 'lane-grid');
    grid.style.setProperty('--cols', String(lane.cols));
    grid.style.setProperty('--rows', String(lane.rows));
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'lane-edges');
    svg.setAttribute('viewBox', `0 0 ${lane.cols} ${lane.rows}`);
    svg.setAttribute('aria-hidden', 'true');
    grid.append(svg);

    const byId = new Map(lane.nodes.map((n) => [n.view.id, n]));
    for (const node of lane.nodes) {
      const button = h('button', 'upgrade skill-node') as HTMLButtonElement;
      button.style.setProperty('--col', String(node.col));
      button.style.setProperty('--row', String(node.row));
      const icon = ctx.icons.urlFor(node.view.id);
      if (icon !== null) {
        button.classList.add('has-icon');
        button.style.setProperty('--icon', icon);
      }
      button.addEventListener('click', () => ctx.activate(node.view.id));
      grid.append(button);
      buttons.set(node.view.id, button);
      for (const parentId of node.parents) {
        const parent = byId.get(parentId);
        if (!parent) continue;
        const path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute('d', edgePath(parent, node));
        path.setAttribute('class', 'lane-edge');
        svg.append(path);
        edges.push({ path, parentId });
      }
    }
    laneEl.append(grid);
    element.append(laneEl);
  }

  return {
    element,
    render(lanes) {
      const nodes = lanes.flatMap((lane) => lane.nodes);
      const owned = new Map(nodes.map((n) => [n.view.id, n.view.owned > 0]));
      // every node is always shown: only its text and looks change
      renderUpgrades(
        buttons,
        nodes.map((n) => ({ ...n.view, available: true })),
        ctx.tips,
      );
      for (const n of nodes) {
        const button = buttons.get(n.view.id);
        if (!button) continue;
        setText(button, n.view.symbol);
        button.setAttribute('aria-label', n.view.name);
        button.classList.toggle('masked', n.masked);
        button.classList.toggle('locked', n.locked);
      }
      for (const edge of edges) edge.path.classList.toggle('lit', owned.get(edge.parentId) === true);
    },
  };
}

/**
 * The line from a parent to a child in grid units: out of the parent's right side, across to the middle of the gap, up or down to the
 * child's row, and into the child's left side. Nodes are one unit wide, centred in their cell.
 *
 * Called by: {@link mountSkillTree}.
 *
 * @param parent the parent node
 * @param child the child node (further right than the parent)
 */
function edgePath(parent: SkillNodeView, child: SkillNodeView): string {
  const y1 = parent.row + 0.5;
  const y2 = child.row + 0.5;
  const x1 = parent.col + 0.5;
  const x2 = child.col + 0.5;
  const mid = (x1 + x2) / 2;
  return `M ${x1} ${y1} H ${mid} V ${y2} H ${x2}`;
}
