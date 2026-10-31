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
}

/** Builds controls once; nodes keep buying through ctx.activate.
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
  for (const feature of view.features) {
    const body = h('div', 'automation-controls');
    body.append(panels[feature.id]);
    const panel = mountDaemonPanel(ctx, feature, body);
    features.set(feature.id, panel);
    root.append(panel.box);
  }
  return { root, points, number, features, autoBurn, kompromat, dispersal };
}

/** Updates existing daemon elements. Called by: ui/dom. Calls: panel renderers, DOM helpers.
 * @param widget mounted tab
 * @param view current owner-sourced state
 */
export function renderAutomation(widget: AutomationWidget, view: AutomationView): void {
  setText(widget.number, view.pointsValueText);
  setClass(widget.points, 'zero', view.points === 0);
  for (const feature of view.features) widget.features.get(feature.id)?.render(feature);
  widget.autoBurn.render(view.autoBurn);
  widget.kompromat.render(view.kompromat);
  widget.dispersal.render(view.dispersal);
}
