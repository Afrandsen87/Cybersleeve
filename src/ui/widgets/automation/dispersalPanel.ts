/**
 * @module ui
 * Persistent Automation-context dispersal protocol DOM.
 * Called by: automationWidget. Calls: domKit, AutomationControls.setDispersalTarget.
 */
import type { AutomationControls } from '../../../core';
import type { DispersalView } from '../../view/dispersalViewTypes';
import { h, setClass, setHidden, setText, type UiContext } from '../domKit';

/** Mounted dispersal protocol with stable target buttons. Called by: automationWidget. Calls: nothing. */
export interface DispersalPanel {
  readonly element: HTMLElement;
  readonly targets: ReadonlyMap<string, HTMLButtonElement>;
  render(view: DispersalView): void;
}

/** Builds status, permit pills and target chips once; clicks delegate to the automation owner.
 * Called by: automationWidget. Calls: domKit, AutomationControls.
 * @param ctx interface text and icons
 * @param initial initial stable content
 * @param controls automation commands
 * @param refresh redraw after a command
 * @returns persistent panel and render function
 */
export function mountDispersalPanel(
  ctx: UiContext,
  initial: DispersalView,
  controls: AutomationControls,
  refresh: () => void,
): DispersalPanel {
  const text = ctx.text.automation.dispersal;
  const element = h('div', 'ab dispersal-protocol');
  const status = h('div', 'status');
  const state = h('span', 'state');
  const word = h('span');
  state.append(h('span', 'dot'), word);
  const summary = h('span', 'k');
  const meter = h('span', 'slots');
  const cells = Array.from({ length: initial.maxSlots }, () => h('i'));
  meter.append(...cells);
  const count = h('span', 'automation-dispersal-count');
  const slotReadout = h('span', 'slot-readout');
  slotReadout.append(h('span', 'k', text.targets), meter, count);
  status.append(state, summary, slotReadout);
  const proto = h('div', 'proto');
  const permitRow = h('div', 'rule t-permit');
  const permitLine = h('div', 'line automation-dispersal-rarities');
  permitLine.append(h('span', 'cond', text.permitCondition));
  // Every configured rarity is mounted once, even if its permission is not yet known.
  const permits = new Map(
    initial.rarityOptions.map((rarity, index) => {
      const pill = h('span', `pill rarity-${index}`, rarity.name);
      permitLine.append(pill);
      return [rarity.id, pill] as const;
    }),
  );
  const permitBody = h('div', 'body');
  permitBody.append(permitLine);
  permitRow.append(h('div', 'tag', text.permits), permitBody, h('span'));
  const targetRow = h('div', 'rule t-target');
  const targetBody = h('div', 'body');
  const targetLine = h('div', 'line');
  targetLine.append(h('span', 'cond', text.targetCondition), h('span', 'arrow', text.arrow));
  const targets = new Map<string, HTMLButtonElement>();
  for (const action of initial.actions) {
    const button = h('button', 'chip automation-switch') as HTMLButtonElement;
    button.append(h('span', 'ld'), h('span', undefined, action.name));
    button.addEventListener('click', () => {
      controls.setDispersalTarget(action.id, !controls.dispersalTargets().includes(action.id));
      refresh();
    });
    targets.set(action.id, button);
    targetLine.append(button);
  }
  const fullNote = h('div', 'needs');
  targetBody.append(targetLine, fullNote);
  targetRow.append(h('div', 'tag', text.targetTag), targetBody, h('span'));
  proto.append(permitRow, targetRow);
  element.append(status, proto);
  return {
    element,
    targets,
    render(view) {
      setText(word, view.word);
      setClass(state, 's-on', view.active);
      setClass(state, 's-off', !view.active);
      setText(summary, view.summary);
      setText(count, view.count);
      for (const [index, cell] of cells.entries()) {
        setHidden(cell, index >= view.slots);
        setClass(cell, 'on', index < view.used);
      }
      setHidden(permitRow, view.permits.length === 0);
      for (const [id, pill] of permits) setHidden(pill, !view.permits.some((rarity) => rarity.id === id));
      setClass(targetRow, 'firing', view.active);
      setText(fullNote, view.fullSlotsNote);
      setHidden(fullNote, view.fullSlotsNote.length === 0);
      for (const action of view.actions) {
        const button = targets.get(action.id);
        if (!button) continue;
        setHidden(button, !action.visible);
        if (button.disabled !== action.disabled) button.disabled = action.disabled;
        setClass(button, 'on', action.selected);
        const pressed = String(action.selected);
        if (button.getAttribute('aria-pressed') !== pressed) button.setAttribute('aria-pressed', pressed);
      }
    },
  };
}
