/**
 * @module ui
 * Firmware tab cards, joined persistent tree and pinned/hover inspector.
 * Called by: ui/dom. Calls: mountSkillTree, mountFirmwareInspector, buildInspectorView.
 */
import type { SkillsView } from '../viewModel';
import { buildInspectorView, defaultSelection } from '../view/firmwareInspector';
import { type UiContext, h, setText, setClass, setHidden } from './domKit';
import { mountSkillTree } from './skillTree';
import { mountFirmwareInspector } from './firmwareInspector';

/** Mounted Firmware tab. Called by: ui/dom. Calls: nothing. */
export interface SkillsPanel {
  readonly root: HTMLElement;
  render(view: SkillsView): void;
}

/** Creates the panel header with separate formatted number and currency label.
 * Called by: mountSkillsPanel. Calls: h.
 * @param title panel title
 * @param label currency wording
 * @param persistent sleeve pool chrome
 * @param ctx UI wording
 * @returns persistent panel and readout
 */
function poolPanel(title: string, label: string, persistent: boolean, ctx: UiContext) {
  const panel = h('section', `skills-widget panel${persistent ? ' resleeve-skills' : ''}`);
  const header = h('h2', 'ph');
  header.append(h('span', undefined, title));
  if (persistent)
    header.append(h('span', 'firmware-persistent', ctx.text.firmware.persistent), h('span', 'firmware-kept', ctx.text.firmware.kept));
  const points = h('span', 'skills-points firmware-points');
  const number = h('span', 'n');
  points.append(number, h('span', 'l', label));
  header.append(points);
  panel.append(header);
  return { panel, points, number };
}

/** Mounts Firmware click-to-select trees. Hover previews are local, pins live only in UiSelection.
 * Called by: mountUi. Calls: poolPanel, mountSkillTree, buildInspectorView, mountFirmwareInspector.
 * @param ctx UI commands and selection memory
 * @param initial initial tree structure
 * @returns persistent panel
 */
export function mountSkillsPanel(ctx: UiContext, initial: SkillsView): SkillsPanel {
  let view = initial;
  let hover: string | null = null;
  let shownBefore = false; // false until the first render while the tab is shown, and again after it was hidden
  let inspectedKey = '';
  const inspector = mountFirmwareInspector(ctx);
  const main = poolPanel(initial.title, ctx.text.firmware.pointsLabel, false, ctx);
  const sleeve = poolPanel(initial.resleeve.title, ctx.text.firmware.sleevePointsLabel, true, ctx);
  /** Updates inspector and selection outlines without rebuilding trees.
   * Called by: render and tree events. Calls: buildInspectorView, tree.select.
   */
  function inspect(): void {
    const sleeveLanes = view.resleeve.visible ? view.resleeve.lanes : [];
    const all = [...view.lanes, ...sleeveLanes];
    const pinned = all.some((lane) => lane.nodes.some((node) => node.view.id === ctx.selection.firmwareSelected))
      ? ctx.selection.firmwareSelected
      : defaultSelection(all);
    const selectedId = hover ?? pinned;
    inspector.render(
      buildInspectorView({
        selectedId,
        lanes: view.lanes,
        sleeveLanes,
        pointsText: view.pointsValueText,
        sleevePointsText: view.resleeve.pointsValueText,
        text: ctx.text.firmware,
      }),
    );
    const branch = all.find((lane) => lane.nodes.some((node) => node.view.id === selectedId));
    const colour = branch ? `var(--branch-${branch.id}, var(--cyan))` : 'var(--cyan)';
    if (inspector.element.style.getPropertyValue('--lane') !== colour) inspector.element.style.setProperty('--lane', colour);
    skillsTree.select(pinned);
    resleeveTree.select(pinned);
  }
  const interaction = {
    onSelect(id: string) {
      ctx.selection.firmwareSelected = id;
      hover = null;
      inspect();
    },
    onHover(id: string | null) {
      hover = id;
      inspect();
    },
  };
  const skillsTree = mountSkillTree(ctx, initial.lanes, { ...interaction, cards: true });
  const resleeveTree = mountSkillTree(ctx, initial.resleeve.lanes, { ...interaction, mode: 'joined' });
  main.panel.append(skillsTree.element);
  const sleeveScroll = h('div', 'sleeve-tree-scroll');
  sleeveScroll.append(resleeveTree.element);
  sleeve.panel.append(sleeveScroll);
  const legend = h('div', 'firmware-legend');
  for (const state of ['installed', 'affordable', 'available', 'locked', 'encrypted'] as const) {
    const item = h('span', 'legend-item');
    item.append(h('span', `legend-swatch ${state}`), h('span', undefined, ctx.text.firmware.status[state]));
    legend.append(item);
  }
  legend.append(h('span', 'legend-hint', ctx.text.firmware.legendHint));
  const panels = h('div', 'firmware-panels');
  panels.append(main.panel, sleeve.panel);
  const layout = h('div', 'firmware-layout');
  layout.append(panels, inspector.element);
  const root = h('div', 'tab-panel skills-panel');
  root.append(legend, layout);
  return {
    root,
    render(next) {
      view = next;
      // A hidden tab draws nothing; a hover in progress when the tab was left is dropped, so it never comes back stale.
      if (root.hidden) {
        if (hover !== null || shownBefore) {
          hover = null;
          skillsTree.clearHover();
          resleeveTree.clearHover();
        }
        shownBefore = false;
        return;
      }
      setHidden(legend, !view.legendVisible);
      setText(main.number, view.pointsValueText);
      setClass(main.points, 'zero', view.points === 0);
      const mainChanged = skillsTree.render(view.lanes);
      setHidden(sleeve.panel, !view.resleeve.visible);
      setText(sleeve.number, view.resleeve.pointsValueText);
      setClass(sleeve.points, 'zero', view.resleeve.points === 0);
      const sleeveChanged = resleeveTree.render(view.resleeve.lanes);
      // The inspector reads only node states, owned counts and the points, so it is rebuilt when one of them moved (or the tab just opened).
      const key = `${view.pointsValueText}|${view.resleeve.pointsValueText}|${view.resleeve.visible}`;
      if (mainChanged || sleeveChanged || key !== inspectedKey || !shownBefore) inspect();
      inspectedKey = key;
      shownBefore = true;
    },
  };
}
