/**
 * @module ui
 * Shared node-state legend for Firmware and Automation.
 * Called by: skillsPanel, automationWidget. Calls: DOM helpers.
 */
import { type UiContext, h } from './domKit';

/** Builds the shared swatches and optional hint. Called by: panel builders. Calls: h.
 * @param ctx UI wording
 * @param hint include the Firmware interaction hint
 * @returns persistent legend element
 */
export function buildFirmwareLegend(ctx: UiContext, hint = true): HTMLElement {
  const legend = h('div', 'firmware-legend');
  for (const state of ['installed', 'affordable', 'available', 'locked', 'encrypted'] as const) {
    const item = h('span', 'legend-item');
    item.append(h('span', `legend-swatch ${state}`), h('span', undefined, ctx.text.firmware.status[state]));
    legend.append(item);
  }
  if (hint) legend.append(h('span', 'legend-hint', ctx.text.firmware.legendHint));
  return legend;
}
