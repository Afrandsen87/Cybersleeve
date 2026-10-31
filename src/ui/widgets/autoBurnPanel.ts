/**
 * @module ui
 *
 * The Auto Burn panel's DOM: the status line, the heat strip and the protocol rows. Built once; `render` only flips `hidden`, `.on`,
 * `.firing`, `.live` and changed text or positions, so nothing is rebuilt per frame.
 *
 * @remarks
 * Called by: `automationWidget.ts`. Calls: `autoBurnParts.ts`, `domKit`, `AutoBurnControls`.
 */
import { type AutomationTarget, burnRowTargets, targets } from '../view/automationTargets';
import type { AutoBurnControls } from '../../core';
import type { AutoBurnView, BurnRowView } from '../view/viewTypes';
import { chipList, led, notch, numberInput, positionAt } from './autoBurnParts';
import { type UiContext, h, setText, syncInput } from './domKit';

/** The mounted panel. */
export interface AutoBurnPanel {
  readonly element: HTMLElement;
  /** Stable inspector targets. Called by: automation inspector. Calls: nothing. */
  readonly controlTargets: ReadonlyMap<AutomationTarget, HTMLElement>;
  render(view: AutoBurnView): void;
}

/**
 * One protocol row (REDLINE, THROTTLE, FAILSAFE or RESTART) with its LED, chips and, for RESTART, the two resume groups.
 *
 * Called by: {@link mountAutoBurnPanel}. Calls: `led`, `chipList`, `setText`.
 *
 * @param ctx gives the icon URLs
 * @param initial the row as first shown (its id, tag, switch and groups are fixed)
 * @param burn the Auto Burn commands
 * @param refresh redraws the screen after a command
 * @returns the row element and its renderer
 */
function protocol(
  ctx: UiContext,
  initial: BurnRowView,
  burn: AutoBurnControls,
  refresh: () => void,
): { element: HTMLElement; controlTargets: ReadonlyMap<AutomationTarget, HTMLElement>; render(v: BurnRowView): void } {
  const element = h('div', `rule t-${initial.id}`);
  const controlTargets = new Map<AutomationTarget, HTMLElement>();
  const rowTarget = burnRowTargets[initial.id];
  if (rowTarget) controlTargets.set(rowTarget, element);
  const tag = h('div', 'tag', initial.tag);
  const body = h('div', 'body');
  const condition = h('span', 'cond');
  const action = h('span', 'act');
  const line = h('div', 'line');
  const arrow = h('span', 'arrow');
  line.append(condition, arrow, action);
  const chips = chipList(ctx, burn, refresh, 'failsafe');
  if (initial.id === 'failsafe') controlTargets.set(targets.offActions, chips.offActionsTarget);
  body.append(line, chips.element);
  const toggle = initial.switch ? led(initial.switch, burn, refresh) : null;
  element.append(tag, body, toggle?.element ?? h('span'));
  const groups = initial.subrows.map((sub) => {
    const row = h('div', 'sub');
    const list = chipList(ctx, burn, refresh, sub.id);
    const sw = led(sub.switch, burn, refresh);
    row.append(list.element, sw.element);
    body.append(row);
    if (sub.id === 'overclocks') controlTargets.set(targets.restartOc, row);
    return { id: sub.id, row, list, sw };
  });
  return {
    element,
    controlTargets,
    render(v) {
      element.hidden = !v.visible;
      element.classList.toggle('firing', v.firing);
      element.classList.toggle('off', v.switch?.on === false);
      setText(condition, v.condition);
      setText(arrow, v.arrow);
      setText(action, v.action);
      if (v.switch) toggle?.render(v.switch);
      chips.render({ chips: v.chips });
      for (const group of groups) {
        const sub = v.subrows.find((s) => s.id === group.id);
        if (!sub) continue;
        group.row.hidden = !sub.visible;
        group.row.classList.toggle('off', !sub.switch.on);
        group.sw.render(sub.switch);
        group.list.render({ chips: sub.chips, empty: sub.empty });
      }
    },
  };
}

/** Mounts the status, strip and protocol DOM once; renders only state changes.
 * Called by: buildAutomationWidget. Calls: protocol, notch, numberInput, AutoBurnControls.
 * @param ctx icon source and UI dependencies
 * @param initial initial panel data
 * @param burn existing automation command owner
 * @param refresh redraw after commands
 * @returns persistent panel and renderer
 */
export function mountAutoBurnPanel(ctx: UiContext, initial: AutoBurnView, burn: AutoBurnControls, refresh: () => void): AutoBurnPanel {
  const element = h('div', 'ab');
  const status = h('div', 'status');
  const state = h('span', 'state');
  const word = h('span');
  state.append(h('span', 'dot'), word);
  const reason = h('span', 'k');
  const heat = h('span');
  const leads = h('span');
  const reserve = h('label');
  const reserveInput = numberInput(initial.reserve.label, (value) => {
    burn.setReserve(value);
    refresh();
  });
  reserve.append(h('span', 'k', initial.reserve.label), reserveInput);
  status.append(state, reason, heat, leads, reserve);
  const wrap = h('div', 'strip-wrap');
  const strip = h('div', 'strip');
  const zones = initial.strip.zones.map((text, i) => h('div', `zone ${['z-cold', 'z-band', 'z-red'][i]}`, text));
  const floor = notch(initial.strip.floor, 'floor', (value) => {
    burn.setThresholds(value, burn.rules().upperAt);
    refresh();
  });
  const redline = notch(initial.strip.redline, 'redline', (value) => {
    burn.setThresholds(burn.rules().lower, value);
    refresh();
  });
  const marker = h('div', 'heat-marker');
  const markerLabel = h('div', 'heat-label');
  strip.append(...zones, floor.mark, floor.label, redline.mark, redline.label, marker, markerLabel);
  wrap.append(strip);
  const proto = h('div', 'proto');
  const rows = initial.rows.map((row) => protocol(ctx, row, burn, refresh));
  proto.append(...rows.map((r) => r.element));
  element.append(status, wrap, proto);
  const controlTargets = new Map<AutomationTarget, HTMLElement>([
    [targets.burnStatus, status],
    [targets.strip, wrap],
    [targets.reserve, reserve],
    ...rows.flatMap((row) => [...row.controlTargets]),
  ]);
  return {
    element,
    controlTargets,
    render(view) {
      status.hidden = !view.status.visible;
      const stateClass = `state s-${view.status.activity}`;
      if (state.className !== stateClass) state.className = stateClass;
      setText(word, view.status.word);
      setText(reason, view.status.reason);
      setText(heat, view.status.heat);
      setText(leads, view.status.leads);
      reserve.hidden = !view.reserve.visible;
      syncInput(reserveInput, view.reserve.value);
      wrap.hidden = !view.strip.visible;
      const layout = view.strip.layout;
      zones.forEach((zone, i) => {
        const z = layout.zones[i];
        if (z) {
          zone.hidden = !z.visible;
          zone.classList.toggle('live', z.live);
          positionAt(zone, z.start);
          const width = `${z.end - z.start}%`;
          if (zone.style.width !== width) zone.style.width = width;
        }
      });
      floor.render(view.strip.floor, layout.floor);
      redline.render(view.strip.redline, layout.redline);
      positionAt(marker, layout.marker);
      if (layout.overflow) {
        if (markerLabel.style.left !== 'auto') markerLabel.style.left = 'auto';
      } else positionAt(markerLabel, layout.marker);
      marker.classList.toggle('overflow', layout.overflow);
      markerLabel.classList.toggle('overflow', layout.overflow);
      setText(markerLabel, view.strip.heat);
      rows.forEach((row, i) => {
        const v = view.rows[i];
        if (v) row.render(v);
      });
    },
  };
}
