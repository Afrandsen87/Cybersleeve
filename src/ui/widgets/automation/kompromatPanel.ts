/** Automation context: persistent Kompromat protocol controls. Called by: automationWidget. Calls: domKit, AutomationControls. */
import type { AutomationControls } from '../../../core';
import { type AutomationTarget, saleChip, channelChip } from '../../view/automationTargets';
import type { KompromatView } from '../../view/kompromatViewTypes';
import { type UiContext, applyIcon, h, setClass, setHidden, setText } from '../domKit';

/** Mounted Kompromat controls. Called by: automationWidget. Calls: nothing. */
export interface KompromatPanel {
  readonly element: HTMLElement;
  /** Stable inspector controls. Called by: automation inspector. Calls: nothing. */
  readonly controlTargets: ReadonlyMap<AutomationTarget, HTMLElement>;
  render(view: KompromatView): void;
}

/** Builds each row and switch once; clicks delegate to the automation owner.
 * Called by: buildAutomationWidget. Calls: domKit, AutomationControls.
 * @param ctx icon and wording providers
 * @param initial initial row structure
 * @param controls automation commands
 * @param refresh redraw after a switch
 * @returns persistent controls
 */
export function mountKompromatPanel(
  ctx: UiContext,
  initial: KompromatView,
  controls: AutomationControls,
  refresh: () => void,
): KompromatPanel {
  const controlTargets = new Map<AutomationTarget, HTMLElement>();
  const words = ctx.text.automation.kompromat;
  const element = h('div', 'ab kompromat-protocol');
  const status = h('div', 'status');
  const state = h('span', 'state');
  const stateText = h('span');
  const summary = h('span', 'k');
  state.append(h('span', 'dot'), stateText);
  status.append(state, summary);
  const proto = h('div', 'proto');
  const rows = initial.rows.map((row) => {
    const root = h('div', `rule t-${row.id === 'backchannel' ? 'channel' : 'sale'}`);
    const body = h('div', 'body');
    const line = h('div', 'line');
    const condition = h('span', 'cond');
    line.append(
      condition,
      h('span', 'arrow', words.arrow),
      h('span', 'act', row.id === 'backchannel' ? words.channelAction : words.saleAction),
    );
    const chips = new Map(
      row.chips.map((chip) => {
        const button = h('button', `chip automation-switch rarity-${chip.rarityIndex}`) as HTMLButtonElement;
        controlTargets.set(row.id === 'backchannel' ? channelChip(chip.id) : saleChip(chip.id), button);
        button.dataset['rarity'] = chip.id;
        button.dataset['protocol'] = row.id;
        if (chip.skillId) applyIcon(button, ctx.icons.urlFor(chip.skillId));
        const count = h('span', 'cnt');
        button.append(h('span', 'ld'), h('span', 'nm', chip.name), count);
        button.addEventListener('click', () => {
          if (row.id === 'backchannel') controls.setAutoBackchannel(chip.id, !controls.isAutoBackchannelOn(chip.id));
          else controls.setAutosale(chip.id, !controls.isAutosaleOn(chip.id));
          refresh();
        });
        line.append(button);
        return [chip.id, { button, count }] as const;
      }),
    );
    const note = h('div', 'needs');
    body.append(line, note);
    root.append(h('div', 'tag', row.id === 'backchannel' ? words.backchannel : words.autosale), body, h('span'));
    proto.append(root);
    return { id: row.id, root, condition, note, chips };
  });
  element.append(status, proto);
  return {
    element,
    controlTargets,
    render(view) {
      setText(stateText, view.status);
      setText(summary, view.summary);
      setClass(state, 's-on', view.active);
      setClass(state, 's-off', !view.active);
      for (const row of view.rows) {
        const handle = rows.find((entry) => entry.id === row.id);
        if (!handle) continue;
        setHidden(handle.root, !row.visible);
        setClass(handle.root, 'off', row.dimmed);
        setText(handle.condition, row.condition);
        setText(handle.note, row.note);
        setHidden(handle.note, row.note.length === 0);
        for (const chip of row.chips) {
          const target = handle.chips.get(chip.id);
          if (!target) continue;
          setHidden(target.button, !chip.visible);
          if (chip.skillId && target.button.dataset['skill'] !== chip.skillId) {
            applyIcon(target.button, ctx.icons.urlFor(chip.skillId));
            target.button.dataset['skill'] = chip.skillId;
          }
          setClass(target.button, 'on', chip.on && !chip.disabled);
          if (target.button.disabled !== chip.disabled) target.button.disabled = chip.disabled;
          const pressed = String(chip.on);
          if (target.button.getAttribute('aria-pressed') !== pressed) target.button.setAttribute('aria-pressed', pressed);
          setText(target.count, chip.heldText);
        }
      }
    },
  };
}
