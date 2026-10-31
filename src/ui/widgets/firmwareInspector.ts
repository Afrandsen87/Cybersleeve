/**
 * @module ui
 * Persistent DOM for the reveal-safe Firmware inspector and its single install command.
 * Called by: skillsPanel. Calls: DOM helpers, ctx.activate, ctx.refresh.
 */
import type { InspectorView, InspectorRelation } from '../view/firmwareInspector';
import { type UiContext, h, setText, setClass, setHidden } from './domKit';

/** Mounted inspector handles. Called by: skillsPanel. Calls: nothing. */
export interface FirmwareInspectorWidget {
  readonly element: HTMLElement;
  render(view: InspectorView | null, mode?: 'preview' | 'pinned', hasPin?: boolean): void;
}

/** Optional Automation docking behavior; omitted for the unchanged Firmware pane.
 * Called by: automation inspector controller. Calls: onClose, onInstall callbacks.
 */
export interface FirmwareInspectorOptions {
  readonly docked?: boolean;
  readonly onClose?: () => void;
  readonly onInstall?: (id: string) => void;
}

/** Builds a labelled relationship section. Called by: mountFirmwareInspector. Calls: h.
 * @param title localized heading
 * @param className section CSS class
 * @returns persistent section and list
 */
function relationSection(title: string, className: string): { section: HTMLElement; list: HTMLElement } {
  const section = h('div', className);
  const list = h('div', 'inspector-list');
  section.append(h('div', 'inspector-key', title), list);
  return { section, list };
}

/** Writes a relationship list only when its values change. Called by: inspector render. Calls: h.
 * @param list persistent container
 * @param values already-masked relationship names
 */
function renderRelations(list: HTMLElement, values: readonly InspectorRelation[]): void {
  const key = JSON.stringify(values);
  if (list.dataset['values'] === key) return;
  list.dataset['values'] = key;
  list.replaceChildren(
    ...values.map((value) => h('span', value.installed ? 'installed' : '', `${value.installed ? '✓ ' : ''}${value.name}`)),
  );
}

/** Mounts the inspector. INSTALL uses the existing activation command exactly once, then refreshes.
 * Called by: skillsPanel. Calls: relationSection, renderRelations, ctx.activate, ctx.refresh.
 * @param ctx UI text, icons and commands
 * @returns persistent inspector
 */
export function mountFirmwareInspector(ctx: UiContext, options: FirmwareInspectorOptions = {}): FirmwareInspectorWidget {
  const element = h('aside', 'firmware-inspector panel');
  const header = h('div', 'inspector-header');
  const modeLabel = h('span', 'inspector-mode');
  const close = h('button', 'inspector-close', ctx.text.firmware.close) as HTMLButtonElement;
  close.type = 'button';
  close.addEventListener('click', () => options.onClose?.());
  header.append(h('span', 'inspector-heading', ctx.text.firmware.inspector), modeLabel, close);
  if (options.docked) {
    element.classList.add('inspector-docked');
    element.append(header);
  }
  const icon = h('div', 'inspector-icon');
  const branch = h('div', 'inspector-branch');
  const name = h('h3', 'inspector-name');
  const status = h('span', 'inspector-status');
  const description = h('div', 'inspector-description');
  const requires = relationSection(ctx.text.firmware.requires, 'inspector-requires');
  const unlocks = relationSection(ctx.text.firmware.unlocksNext, 'inspector-unlocks');
  const adds = h('div', 'inspector-adds');
  const addsText = h('div', 'inspector-adds-text');
  adds.append(h('div', 'inspector-key', ctx.text.firmware.adds), addsText);
  const cost = h('div', 'inspector-cost');
  const install = h('button', 'firmware-install', ctx.text.firmware.install) as HTMLButtonElement;
  const why = h('div', 'inspector-why');
  let current: InspectorView | null = null;
  install.addEventListener('click', () => {
    if (!current?.canInstall) return;
    options.onInstall?.(current.id);
    ctx.activate(current.id);
    ctx.refresh();
  });
  if (options.docked) {
    const top = h('div', 'inspector-top');
    const labels = h('div', 'inspector-labels');
    labels.append(branch, name, status);
    top.append(icon, labels);
    const buy = h('div', 'inspector-buy');
    buy.append(cost, install, why);
    element.append(top, description, adds, requires.section, unlocks.section, buy);
  } else element.append(icon, branch, name, status, description, adds, requires.section, unlocks.section, cost, install, why);
  return {
    element,
    render(view, mode = 'preview', hasPin = false) {
      current = view;
      setHidden(element, view === null);
      if (!view) return;
      if (options.docked) {
        setText(modeLabel, ctx.text.firmware[mode]);
        setHidden(close, !hasPin);
      }
      setText(addsText, view.adds ?? '');
      setHidden(adds, view.adds === null);
      setText(branch, `${view.branchTitle}${view.persistent ? ` · ${ctx.text.firmware.persistent}` : ''}`);
      setText(name, view.name);
      setText(status, view.status);
      const statusClass = `inspector-status ${view.state}`;
      if (status.className !== statusClass) status.className = statusClass;
      setText(description, view.description);
      const url = view.iconId ? ctx.icons.urlFor(view.iconId) : null;
      setClass(icon, 'has-icon', url !== null);
      if (url && icon.style.getPropertyValue('--icon') !== url) icon.style.setProperty('--icon', url);
      else if (!url && icon.style.getPropertyValue('--icon')) icon.style.removeProperty('--icon');
      setText(icon, url ? '' : view.state === 'encrypted' ? ctx.text.firmware.hidden : '');
      renderRelations(
        requires.list,
        options.docked && view.requires.length === 0
          ? [{ id: '', name: ctx.text.firmware.firstFirmware, installed: false }]
          : view.requires,
      );
      renderRelations(
        unlocks.list,
        options.docked && view.unlocksNext.length === 0
          ? [{ id: '', name: ctx.text.firmware.endOfTree, installed: false }]
          : view.unlocksNext,
      );
      setHidden(requires.section, !options.docked && view.requires.length === 0);
      setHidden(unlocks.section, !options.docked && view.unlocksNext.length === 0);
      setText(cost, view.costText ?? '');
      setHidden(cost, !options.docked && (view.costText === null || view.state === 'installed'));
      setHidden(install, !options.docked && (view.state === 'encrypted' || view.state === 'installed'));
      setText(install, options.docked && view.state === 'installed' ? ctx.text.firmware.installed : ctx.text.firmware.install);
      install.disabled = !view.canInstall;
      const whyText = options.docked && view.state === 'installed' ? ctx.text.firmware.alreadyRunning : view.whyNot;
      setText(why, whyText ?? '');
      setHidden(why, whyText === null);
    },
  };
}
