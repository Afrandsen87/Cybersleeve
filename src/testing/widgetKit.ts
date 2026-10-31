/**
 * @module testing
 *
 * Shared setup for the DOM tests of the main-screen widgets (tab bar, stat widget, heat gauge, HUD): small view-model literals so a
 * test states only the field it is about. The widgets only draw these views, so no engine is needed.
 *
 * Called by: `ui/*.dom.test.ts` (happy-dom). Calls: nothing.
 */
import type { HeatGaugeView, HudView, StatGroupView, StatRowView, TabView } from '../ui/viewModel';

/** A stat row view with defaults; pass the fields the test is about. */
export function statRow(id: StatRowView['id'], overrides: Partial<StatRowView> = {}): StatRowView {
  return { id, label: id, text: '0', hasTip: false, tip: null, bar: null, hidden: false, ...overrides };
}

/** A group view over the given stat ids. */
export function statGroup(id: StatGroupView['id'], statIds: StatRowView['id'][], hidden = false): StatGroupView {
  return { id, title: id.toUpperCase(), statIds, hidden };
}

/** A heat gauge view; the strip fields default to a half-full gauge with the tax zone at 70%. */
export function gaugeView(strip: Partial<HeatGaugeView['strip']> = {}): HeatGaugeView {
  return {
    strip: { fillPercent: 50, taxStartPercent: 70, markerPercents: [], overflow: false, ...strip },
    valueText: 'HEAT 5',
    zoneText: 'FULLY TAXED ZONE',
    legendText: 'all credits taxed ≥ 10',
  };
}

/** A tab view. */
export function tabView(id: TabView['id'], count: number | null, visible = true): TabView {
  return { id, label: id, count, visible, attention: false };
}

/** A HUD view with no rate and no heat; pass what the test is about. */
export function hudView(overrides: Partial<HudView> = {}): HudView {
  return { creditsLabel: 'CREDITS', creditsText: '12', rateText: null, heat: null, ...overrides };
}
