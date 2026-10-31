/** @module ui
 * Persistent Auto Burn DOM. Called by: automationWidget. Calls: domKit and AutoBurnControls.
 */
import type { AutoBurnControls } from '../../core';
import type { AutoBurnView, BurnChipView, BurnNotchView, BurnRowView, BurnSwitchView } from '../view/viewTypes';
import { type UiContext, applyIcon, h, setText, syncInput } from './domKit';

/** Mounted panel. Called by: automationWidget. Calls: render helpers. */
export interface AutoBurnPanel {
  readonly element: HTMLElement;
  render(view: AutoBurnView): void;
}

/** Updates a position only when changed. Called by: notch, panel render. Calls: CSS style.
 * @param element positioned element
 * @param percent finite percent position
 */
function positionAt(element: HTMLElement, percent: number): void {
  const value = `${percent}%`;
  if (element.style.left !== value) element.style.left = value;
}

/** Creates an accessible LED wired to the existing command path.
 * Called by: mountAutoBurnPanel. Calls: setSwitch, refresh.
 */
function led(
  view: BurnSwitchView,
  burn: AutoBurnControls,
  refresh: () => void,
): { element: HTMLButtonElement; render(v: BurnSwitchView): void } {
  const element = h('button', 'led') as HTMLButtonElement;
  element.type = 'button';
  element.setAttribute('aria-label', view.name);
  element.addEventListener('click', () => {
    burn.setSwitch(view.name, !burn.rules()[view.name]);
    refresh();
  });
  return {
    element,
    render(v) {
      setText(element, v.text);
      element.classList.toggle('on', v.on);
      element.setAttribute('aria-pressed', String(v.on));
    },
  };
}

/** Target lists rebuild only on identity changes; listeners read the latest chip state.
 * Called by: protocol. Calls: applyIcon, AutoBurnControls, refresh.
 */
function chipList(
  ctx: UiContext,
  burn: AutoBurnControls,
  refresh: () => void,
  group: string,
): { element: HTMLElement; render(chips: readonly BurnChipView[], empty?: string): void } {
  const element = h('div', 'line');
  let key = '';
  let current: readonly BurnChipView[] = [];
  const buttons = new Map<string, HTMLButtonElement>();
  const emptyLine = h('span', 'cond');
  return {
    element,
    render(chips, empty = '') {
      current = chips;
      const next = JSON.stringify(chips.map((c) => c.id));
      if (key !== next) {
        key = next;
        buttons.clear();
        element.replaceChildren(emptyLine);
        for (const chip of chips) {
          const b = h('button', 'chip') as HTMLButtonElement;
          b.type = 'button';
          const icon = h('span', 'ico');
          applyIcon(icon, ctx.icons.urlFor(chip.icon));
          b.append(icon, h('span', undefined, chip.name), h('span', 'kind', chip.kind));
          b.addEventListener('click', () => {
            const value = current.find((c) => c.id === chip.id);
            if (!value) return;
            if (value.switchName) burn.setSwitch(value.switchName, !burn.rules()[value.switchName]);
            else if (group === 'autoRuns') burn.setResumeAutoRun(value.id, !value.on);
            else burn.setResumeOverclock(value.id, !value.on);
            refresh();
          });
          buttons.set(chip.id, b);
          element.append(b);
        }
      }
      emptyLine.hidden = chips.length > 0 || !empty;
      setText(emptyLine, empty);
      for (const chip of chips) {
        const b = buttons.get(chip.id);
        if (b) {
          b.classList.toggle('on', chip.on);
          b.setAttribute('aria-pressed', String(chip.on));
        }
      }
    },
  };
}

/** Builds one persistent protocol row and its restart groups.
 * Called by: mountAutoBurnPanel. Calls: led, chipList, setText.
 */
function protocol(
  ctx: UiContext,
  initial: BurnRowView,
  burn: AutoBurnControls,
  refresh: () => void,
): { element: HTMLElement; render(v: BurnRowView): void } {
  const element = h('div', `rule t-${initial.id}`);
  const tag = h('div', 'tag', initial.tag);
  const caption = h('small', undefined, initial.caption);
  tag.append(caption);
  const body = h('div', 'body');
  const condition = h('span', 'cond');
  const action = h('span', 'act');
  const line = h('div', 'line');
  line.append(condition, h('span', 'arrow', initial.action ? '→' : ''), action);
  const chips = chipList(ctx, burn, refresh, 'failsafe');
  body.append(line, chips.element);
  const toggle = initial.switch ? led(initial.switch, burn, refresh) : null;
  element.append(tag, body, toggle?.element ?? h('span'));
  const groups = initial.subrows.map((sub) => {
    const row = h('div', 'sub');
    const list = chipList(ctx, burn, refresh, sub.id);
    const sw = led(sub.switch, burn, refresh);
    row.append(list.element, sw.element);
    body.append(row);
    return { id: sub.id, row, list, sw };
  });
  return {
    element,
    render(v) {
      element.hidden = !v.visible;
      element.classList.toggle('firing', v.firing);
      element.classList.toggle('off', v.switch?.on === false);
      setText(condition, v.condition);
      setText(action, v.action);
      setText(caption, v.caption);
      if (v.switch) toggle?.render(v.switch);
      chips.render(v.chips);
      for (const group of groups) {
        const sub = v.subrows.find((s) => s.id === group.id);
        if (!sub) continue;
        group.row.hidden = !sub.visible;
        group.row.classList.toggle('off', !sub.switch.on);
        group.sw.render(sub.switch);
        group.list.render(sub.chips, sub.empty);
      }
    },
  };
}

/** Creates a number input that sends changes through its injected command.
 * Called by: mountAutoBurnPanel. Calls: onChange.
 */
function numberInput(label: string, onChange: (value: number) => void): HTMLInputElement {
  const input = h('input') as HTMLInputElement;
  input.type = 'number';
  input.min = '0';
  input.setAttribute('aria-label', label);
  input.addEventListener('change', () => onChange(Number(input.value)));
  return input;
}

/** Persistent fixed/editable notch. Called by: mountAutoBurnPanel. Calls: numberInput, syncInput. */
function notch(
  initial: BurnNotchView,
  name: string,
  change: (value: number) => void,
): { mark: HTMLElement; label: HTMLElement; render(v: BurnNotchView, position: number): void } {
  const mark = h('div', `notch ${name}`);
  const label = h('label', `notch-label ${name}`);
  const fixed = h('span');
  const input = numberInput(initial.label, change);
  label.append(h('span', undefined, initial.label), fixed, input);
  return {
    mark,
    label,
    render(v, position) {
      mark.hidden = !v.visible;
      label.hidden = !v.visible;
      positionAt(mark, position);
      positionAt(label, position);
      fixed.hidden = v.editable;
      input.hidden = !v.editable;
      setText(fixed, String(v.value));
      syncInput(input, v.value);
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
  const inventory = h('span', 'k');
  const reserve = h('label');
  const reserveInput = numberInput(initial.reserve.label, (value) => {
    burn.setReserve(value);
    refresh();
  });
  reserve.append(h('span', 'k', initial.reserve.label), reserveInput);
  status.append(state, reason, heat, leads, reserve, inventory);
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
  return {
    element,
    render(view) {
      status.hidden = !view.status.visible;
      const stateClass = `state s-${view.status.activity}`;
      if (state.className !== stateClass) state.className = stateClass;
      setText(word, view.status.word);
      setText(reason, view.status.reason);
      setText(heat, view.status.heat);
      setText(leads, view.status.leads);
      setText(inventory, view.status.toggle);
      reserve.hidden = !view.reserve.visible;
      syncInput(reserveInput, view.reserve.value);
      wrap.hidden = !view.strip.visible;
      const layout = view.strip.layout;
      zones.forEach((zone, i) => {
        const z = layout.zones[i];
        if (z) {
          positionAt(zone, z.start);
          const width = `${z.end - z.start}%`;
          if (zone.style.width !== width) zone.style.width = width;
        }
      });
      floor.render(view.strip.floor, layout.floor);
      redline.render(view.strip.redline, layout.redline);
      positionAt(marker, layout.marker);
      positionAt(markerLabel, layout.marker);
      marker.classList.toggle('overflow', layout.overflow);
      setText(markerLabel, `${view.strip.heat}${layout.overflow ? ' +' : ''}`);
      rows.forEach((row, i) => {
        const v = view.rows[i];
        if (v) row.render(v);
      });
    },
  };
}
