/**
 * @module ui
 * Persistent sideways trees shared by Firmware and Automation; only events touch path highlights.
 * Called by: skillsPanel, automationWidget. Calls: skillTreeEdges, joinSkillLanes, branchSummary, DOM helpers.
 */
import type { SkillLaneView } from '../viewModel';
import { joinSkillLanes } from '../view/skillTreeJoin';
import { branchSummary } from '../view/firmwareBranches';
import { type UiContext, h, setText, setClass, setHidden } from './domKit';
import { type TreeEdge, SVG_NS, STEP_PX, TILE_PX, edgePath, highlightPath } from './skillTreeEdges';
export { STEP_PX, TILE_PX, HALF_TILE, edgePath } from './skillTreeEdges';

/** Tree interaction and geometry choices. Called by: panel widgets. Calls: nothing. */
export interface SkillTreeOptions {
  readonly mode?: 'lanes' | 'joined';
  readonly cards?: boolean;
  readonly onSelect?: (id: string) => void;
  readonly onHover?: (id: string | null) => void;
}
/** Persistent tree handles. Called by: panel widgets. Calls: nothing. */
export interface SkillTreeWidget {
  readonly element: HTMLElement;
  render(lanes: readonly SkillLaneView[]): void;
  select(id: string | null): void;
}
/** Branch header handles. Called by: tree mounting/rendering. Calls: nothing. */
interface Header {
  readonly purpose: HTMLElement;
  readonly count: HTMLElement;
  readonly segments: readonly HTMLElement[];
}

/** Mounts fixed tree geometry and event handlers; rendering only updates existing nodes.
 * Called by: skillsPanel, automationWidget. Calls: joinSkillLanes, edgePath, highlightPath, branchSummary.
 * @param ctx UI commands, icons, text and tooltip registry
 * @param initial initial fixed lane structure
 * @param options optional selection callbacks and Firmware card geometry
 * @returns persistent tree widget
 */
export function mountSkillTree(ctx: UiContext, initial: readonly SkillLaneView[], options: SkillTreeOptions = {}): SkillTreeWidget {
  const element = h('div', 'skill-tree');
  const stepX = options.cards ? 54 : STEP_PX;
  const stepY = options.cards ? 50 : STEP_PX;
  const tile = options.cards ? 38 : TILE_PX;
  element.style.setProperty('--step-x', `${stepX}px`);
  element.style.setProperty('--step-y', `${stepY}px`);
  element.style.setProperty('--tile', `${tile}px`);
  if (options.cards) element.classList.add('firmware-cards');
  const buttons = new Map<string, HTMLButtonElement>();
  const symbols = new Map<string, HTMLElement>();
  const costs = new Map<string, HTMLElement>();
  const labels = new Map<string, HTMLElement>();
  const headers = new Map<string, Header>();
  const previousOwned = new Map<string, number>();
  const edges: TreeEdge[] = [];
  let nodes = initial.flatMap((lane) => lane.nodes);
  let maskedIds = new Set(nodes.filter((node) => node.masked).map((node) => node.view.id));
  const joined = options.mode === 'joined' ? joinSkillLanes(initial) : null;
  let sharedSvg: SVGSVGElement | undefined;
  if (joined) {
    element.classList.add('skill-tree-joined');
    element.style.setProperty('--cols', String(joined.cols));
    element.style.setProperty('--rows', String(joined.rows));
    sharedSvg = document.createElementNS(SVG_NS, 'svg');
    sharedSvg.setAttribute('class', 'lane-edges');
    sharedSvg.setAttribute('viewBox', `0 0 ${joined.cols} ${joined.rows}`);
    sharedSvg.setAttribute('preserveAspectRatio', 'none');
    sharedSvg.setAttribute('aria-hidden', 'true');
    element.append(sharedSvg);
  }
  const drawingLanes = joined
    ? [...joined.bands, { id: joined.trunkBranch, title: '', cols: joined.cols, rows: joined.rows, nodes: [joined.trunk], firstRow: 0 }]
    : initial;
  const globalNodes = new Map(drawingLanes.flatMap((lane) => lane.nodes.map((node) => [node.view.id, node] as const)));
  for (const lane of drawingLanes) {
    const laneEl = h('section', 'skill-lane');
    laneEl.dataset['branch'] = lane.id;
    if (joined) {
      laneEl.style.setProperty('--first-row', String('firstRow' in lane ? lane.firstRow : 0));
      laneEl.style.setProperty('--band-rows', String(lane.rows));
      if (lane.id === joined.trunkBranch) laneEl.classList.add('trunk-lane');
    }
    if (lane.title) {
      const header = h('div', 'lane-header');
      header.append(h('h3', 'lane-title', lane.title));
      if (options.onSelect) {
        const purpose = h('span', 'lane-purpose');
        const count = h('span', 'lane-count');
        const bar = h('span', 'lane-segments');
        const segments = lane.nodes.map(() => h('span'));
        bar.append(...segments);
        bar.setAttribute('aria-hidden', 'true');
        header.append(purpose, count, bar);
        headers.set(lane.id, { purpose, count, segments });
      }
      laneEl.append(header);
    }
    const grid = h('div', 'lane-grid');
    grid.style.setProperty('--cols', String(lane.cols));
    grid.style.setProperty('--rows', String(lane.rows));
    const svg = sharedSvg ?? document.createElementNS(SVG_NS, 'svg');
    if (!sharedSvg) {
      svg.setAttribute('class', 'lane-edges');
      svg.setAttribute('viewBox', `0 0 ${lane.cols} ${lane.rows}`);
      svg.setAttribute('preserveAspectRatio', 'none');
      svg.setAttribute('aria-hidden', 'true');
      grid.append(svg);
    }
    const byId = joined ? globalNodes : new Map(lane.nodes.map((n) => [n.view.id, n]));
    for (const node of lane.nodes) {
      const id = node.view.id;
      const button = h('button', 'upgrade skill-node') as HTMLButtonElement;
      button.dataset['id'] = id;
      button.style.setProperty('--col', String(node.col));
      button.style.setProperty('--row', String(node.row));
      const symbol = h('span', 'node-symbol');
      const cost = h('span', 'node-cost');
      button.append(symbol, cost);
      button.addEventListener('click', () => (options.onSelect ? options.onSelect(id) : ctx.activate(id)));
      button.addEventListener('mouseenter', () => {
        highlightPath(nodes, id, buttons, edges);
        options.onHover?.(id);
      });
      button.addEventListener('focus', () => {
        highlightPath(nodes, id, buttons, edges);
        options.onHover?.(id);
      });
      button.addEventListener('animationend', (event) => {
        if (event.target === button) button.classList.remove('install');
      });
      grid.append(button);
      buttons.set(id, button);
      symbols.set(id, symbol);
      costs.set(id, cost);
      if (joined && lane.id === joined.trunkBranch) {
        const label = h('span', 'trunk-label', ctx.text.firmware.sleeveUp);
        label.style.setProperty('--col', String(node.col));
        label.style.setProperty('--row', String(node.row));
        grid.append(label);
        labels.set(id, label);
      }
      for (const parentId of node.parents) {
        const parent = byId.get(parentId);
        if (!parent) continue;
        const path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute('d', edgePath(parent, node, tile / stepX / 2));
        path.setAttribute('class', 'lane-edge');
        if (joined) path.style.setProperty('--lane', `var(--branch-${lane.id})`);
        path.addEventListener('animationend', () => path.classList.remove('flow'));
        svg.append(path);
        edges.push({ path, parentId, childId: id });
      }
    }
    if (options.cards && !joined) {
      const scroll = h('div', 'lane-scroll');
      scroll.append(grid);
      laneEl.append(scroll);
    } else laneEl.append(grid);
    element.append(laneEl);
  }
  element.addEventListener('mouseleave', () => {
    highlightPath(nodes, null, buttons, edges);
    options.onHover?.(null);
  });
  element.addEventListener('focusout', (event) => {
    if (event.relatedTarget instanceof Node && element.contains(event.relatedTarget)) return;
    highlightPath(nodes, null, buttons, edges);
    options.onHover?.(null);
  });
  return {
    element,
    select(id) {
      for (const [key, button] of buttons) setClass(button, 'sel', key === id && !maskedIds.has(key));
    },
    render(lanes) {
      nodes = lanes.flatMap((lane) => lane.nodes);
      maskedIds = new Set(nodes.filter((node) => node.masked).map((node) => node.view.id));
      const installedNow = new Set<string>();
      for (const lane of lanes) {
        const header = headers.get(lane.id);
        if (!header) continue;
        const summary = branchSummary(lane, ctx.text.firmware);
        setText(header.purpose, summary.purpose ?? '');
        setHidden(header.purpose, !summary.purpose);
        setText(header.count, `${summary.installed}/${summary.total}`);
        header.segments.forEach((segment, i) => {
          setClass(segment, 'filled', i < summary.installed);
        });
      }
      for (const node of nodes) {
        const id = node.view.id;
        const button = buttons.get(id);
        if (!button) continue;
        const before = previousOwned.get(id);
        if (before !== undefined && node.view.owned > before) {
          button.classList.add('install');
          installedNow.add(id);
        }
        previousOwned.set(id, node.view.owned);
        for (const state of ['installed', 'encrypted', 'locked', 'affordable', 'available']) setClass(button, state, node.state === state);
        setClass(button, 'masked', node.state === 'encrypted');
        setClass(button, 'owned', node.state === 'installed');
        button.disabled = options.onSelect ? false : !node.view.clickable;
        if (button.getAttribute('aria-label') !== node.view.name) button.setAttribute('aria-label', node.view.name);
        const icon = node.masked ? null : ctx.icons.urlFor(id);
        setClass(button, 'has-icon', icon !== null);
        if (icon && button.style.getPropertyValue('--icon') !== icon) button.style.setProperty('--icon', icon);
        else if (!icon && button.style.getPropertyValue('--icon')) button.style.removeProperty('--icon');
        const label = labels.get(id);
        if (label) {
          setHidden(label, node.masked);
          setText(label, node.masked ? '' : ctx.text.firmware.sleeveUp);
        }
        setText(symbols.get(id)!, node.masked ? '???' : node.view.symbol);
        const cost = costs.get(id)!;
        const showCost = node.state === 'affordable' || node.state === 'available';
        setText(cost, showCost ? node.view.costText : '');
        setHidden(cost, !showCost);
        ctx.tips.set(button, () => node.view.tip);
      }
      const owned = new Set(nodes.filter((n) => n.view.owned > 0).map((n) => n.view.id));
      for (const edge of edges) {
        setClass(edge.path, 'lit', owned.has(edge.parentId));
        if (installedNow.has(edge.parentId)) edge.path.classList.add('flow');
      }
    },
  };
}
