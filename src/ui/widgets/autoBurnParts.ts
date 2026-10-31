/**
 * @module ui
 *
 * Building blocks of the Auto Burn panel: LED switches, chip lists, number inputs and strip notches. Each is built once and has a `render`
 * that only changes what differs; clicks go straight to the `AutoBurnControls` commands, then ask for a redraw.
 *
 * @remarks
 * Called by: `autoBurnPanel.ts`. Calls: `domKit` (`h`, `setText`, `syncInput`, `applyIcon`), `AutoBurnControls`.
 */
import type { AutoBurnControls } from '../../core';
import type { BurnChipView, BurnNotchView, BurnSwitchView } from '../view/viewTypes';
import { type UiContext, applyIcon, h, setText, syncInput } from './domKit';

/** A built element and the function that draws its view into it. */
export interface Part<E extends HTMLElement, V> {
  readonly element: E;
  render(view: V): void;
}

/**
 * Moves an element along the strip; writes the style only when the position changed.
 *
 * Called by: {@link notch}, `mountAutoBurnPanel`. Calls: nothing.
 *
 * @param element the positioned element (mutated: `style.left`)
 * @param percent a finite percent of the strip
 */
export function positionAt(element: HTMLElement, percent: number): void {
  const value = `${percent}%`;
  if (element.style.left !== value) element.style.left = value;
}

/**
 * An ON/OFF LED pill for one Auto Burn switch.
 *
 * Called by: `protocol` (in `autoBurnPanel.ts`). Calls: `AutoBurnControls.setSwitch`, `.rules`.
 *
 * @param view the switch as first shown (its name is fixed)
 * @param burn the Auto Burn commands
 * @param refresh redraws the screen after a click
 * @returns the button and its renderer
 */
export function led(view: BurnSwitchView, burn: AutoBurnControls, refresh: () => void): Part<HTMLButtonElement, BurnSwitchView> {
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

/** What a chip list draws: its chips and the line shown when there are none. */
export interface ChipListView {
  readonly chips: readonly BurnChipView[];
  readonly empty?: string;
}

/**
 * A row of toggle chips. The buttons are rebuilt only when the list of chip ids changes; clicks read the latest chip state.
 * A chip with `switchName` sets that switch; otherwise it ticks an Auto-run (`group` 'autoRuns') or an Overclock for the resume rule.
 *
 * Called by: `protocol` (in `autoBurnPanel.ts`). Calls: `applyIcon`, `AutoBurnControls.setSwitch`, `.setResumeAutoRun`, `.setResumeOverclock`.
 *
 * @param ctx gives the icon URLs
 * @param burn the Auto Burn commands
 * @param refresh redraws the screen after a click
 * @param group 'autoRuns' for the Auto-run resume list; any other value ticks Overclocks (switch chips ignore it)
 * @returns the list element and its renderer
 */
export function chipList(ctx: UiContext, burn: AutoBurnControls, refresh: () => void, group: string): Part<HTMLElement, ChipListView> {
  const element = h('div', 'line');
  let key = '';
  let current: readonly BurnChipView[] = [];
  const buttons = new Map<string, HTMLButtonElement>();
  const emptyLine = h('span', 'cond');
  const build = (chips: readonly BurnChipView[]): void => {
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
  };
  return {
    element,
    render({ chips, empty = '' }) {
      current = chips;
      const next = chips.map((c) => c.id).join('\n');
      if (key !== next) {
        key = next;
        build(chips);
      }
      emptyLine.hidden = chips.length > 0 || !empty;
      setText(emptyLine, empty);
      for (const chip of chips) {
        const b = buttons.get(chip.id);
        if (!b) continue;
        b.classList.toggle('on', chip.on);
        b.setAttribute('aria-pressed', String(chip.on));
      }
    },
  };
}

/**
 * A number input (>= 0) that sends its value on change.
 *
 * Called by: {@link notch}, `mountAutoBurnPanel` (the Reserve field). Calls: `onChange`.
 *
 * @param label the accessible name
 * @param onChange receives the typed number (the command validates it)
 * @returns the input
 */
export function numberInput(label: string, onChange: (value: number) => void): HTMLInputElement {
  const input = h('input') as HTMLInputElement;
  input.type = 'number';
  input.min = '0';
  input.setAttribute('aria-label', label);
  input.addEventListener('change', () => onChange(Number(input.value)));
  return input;
}

/** A strip notch: the mark on the strip and its label above it. */
export interface Notch {
  readonly mark: HTMLElement;
  readonly label: HTMLElement;
  /** Draws the notch at `position` (percent): a plain number, or an input once Tune Thresholds is owned. */
  render(view: BurnNotchView, position: number): void;
}

/**
 * A Floor or Redline notch.
 *
 * Called by: `mountAutoBurnPanel`. Calls: {@link numberInput}, {@link positionAt}, `syncInput`.
 *
 * @param initial the notch as first shown (its label is fixed)
 * @param name the CSS modifier ('floor' or 'redline')
 * @param change receives a typed threshold
 * @returns the notch's elements and renderer
 */
export function notch(initial: BurnNotchView, name: string, change: (value: number) => void): Notch {
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
      setText(fixed, v.text);
      syncInput(input, v.value);
    },
  };
}
