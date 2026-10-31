/**
 * @module ui
 * Automation context: daemon panel composition and shared point legend.
 * Called by: ui/dom. Calls: daemonPanel, protocol panels, firmwareLegend.
 */
import type { AutomationControls, AutomationFeature } from '../../core';
import type { AutomationView } from '../viewModel';
import { type UiContext, h, setText, setClass } from './domKit';
import { mountAutoBurnPanel } from './autoBurnPanel';
import { buildFirmwareLegend } from './firmwareLegend';
import { mountDaemonPanel } from './automation/daemonPanel';
import { mountKompromatPanel } from './automation/kompromatPanel';
import { mountDispersalPanel } from './automation/dispersalPanel';
import { mountDockedInspector, type DockedRow } from './automation/dockedInspector';

/** Persistent daemon handle. Called by: automationWidget. Calls: mountDaemonPanel. */
export type AutomationFeatureHandle = ReturnType<typeof mountDaemonPanel>;
/** Persistent tab handles. Called by: ui/dom. Calls: panel renderers. */
export interface AutomationWidget {
  readonly root: HTMLElement;
  readonly points: HTMLElement;
  readonly number: HTMLElement;
  readonly features: ReadonlyMap<AutomationFeature, AutomationFeatureHandle>;
  readonly autoBurn: ReturnType<typeof mountAutoBurnPanel>;
  readonly kompromat: ReturnType<typeof mountKompromatPanel>;
  readonly dispersal: ReturnType<typeof mountDispersalPanel>;
  readonly inspector: ReturnType<typeof mountDockedInspector>;
  update(view: AutomationView, shown: boolean): void;
}

/** Builds controls once; nodes select and the shared inspector buys through ctx.activate.
 * Called by: mountUi. Calls: panel builders, buildFirmwareLegend.
 * @param ctx UI commands, icons and wording
 * @param view initial fixed structure
 * @param controls automation command owner
 * @param refresh redraw after commands
 * @returns persistent tab widget
 */
export function buildAutomationWidget(
  ctx: UiContext,
  view: AutomationView,
  controls: AutomationControls,
  refresh: () => void,
): AutomationWidget {
  const root = h('aside', 'automation-widget');
  const legend = buildFirmwareLegend(ctx, false);
  const points = h('span', 'skills-points firmware-points');
  const number = h('span', 'n');
  points.append(number, h('span', 'l', ctx.text.automation.pointsLabel));
  legend.append(points);
  root.append(legend);
  const autoBurn = mountAutoBurnPanel(ctx, view.autoBurn, controls.autoBurn(), refresh);
  const kompromat = mountKompromatPanel(ctx, view.kompromat, controls, refresh);
  const dispersal = mountDispersalPanel(ctx, view.dispersal, controls, refresh);
  const panels = { autoBurn: autoBurn.element, autosale: kompromat.element, dispersal: dispersal.element };
  const features = new Map<AutomationFeature, AutomationFeatureHandle>();
  const rows = new Map<string, DockedRow>();
  let inspector: ReturnType<typeof mountDockedInspector>;
  for (const feature of view.features) {
    const body = h('div', 'automation-controls');
    body.append(panels[feature.id]);
    const panel = mountDaemonPanel(ctx, feature, body, { onSelect: (id) => inspector.select(id) });
    features.set(feature.id, panel);
    const row = h('div', 'automation-feat');
    row.style.setProperty('--lane', `var(--branch-${feature.id})`);
    row.dataset['feature'] = feature.id;
    const slot = h('div', 'automation-slot');
    row.append(panel.box, slot);
    rows.set(feature.id, { element: row, slot, tree: panel.tree });
    root.append(row);
  }
  const targets = new Map([...autoBurn.controlTargets, ...kompromat.controlTargets, ...dispersal.controlTargets]);
  for (const control of targets.values())
    control.addEventListener('animationend', (event) => {
      if (event.target === control) control.classList.remove('fresh');
    });
  inspector = mountDockedInspector(ctx, root, rows, view, targets);
  let lastPoints: number | null = null;
  return {
    root,
    points,
    number,
    features,
    autoBurn,
    kompromat,
    dispersal,
    inspector,
    update(next, shown) {
      setText(number, next.pointsValueText);
      setClass(points, 'zero', next.points === 0);
      let changed = lastPoints !== next.points;
      for (const feature of next.features) changed = (features.get(feature.id)?.render(feature) ?? false) || changed;
      autoBurn.render(next.autoBurn);
      kompromat.render(next.kompromat);
      dispersal.render(next.dispersal);
      inspector.render(next, changed, shown);
      lastPoints = next.points;
    },
  };
}

/** Updates existing daemon elements. Called by: ui/dom. Calls: panel renderers, DOM helpers.
 * @param widget mounted tab
 * @param view current owner-sourced state
 */
export function renderAutomation(widget: AutomationWidget, view: AutomationView, shown = true): void {
  widget.update(view, shown);
}
