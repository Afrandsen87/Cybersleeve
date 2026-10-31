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
  render(view: InspectorView | null): void;
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
export function mountFirmwareInspector(ctx: UiContext): FirmwareInspectorWidget {
  const element = h('aside', 'firmware-inspector panel');
  const icon = h('div', 'inspector-icon');
  const branch = h('div', 'inspector-branch');
  const name = h('h3', 'inspector-name');
  const status = h('span', 'inspector-status');
  const description = h('div', 'inspector-description');
  const requires = relationSection(ctx.text.firmware.requires, 'inspector-requires');
  const unlocks = relationSection(ctx.text.firmware.unlocksNext, 'inspector-unlocks');
  const cost = h('div', 'inspector-cost');
  const install = h('button', 'firmware-install', ctx.text.firmware.install) as HTMLButtonElement;
  const why = h('div', 'inspector-why');
  let current: InspectorView | null = null;
  install.addEventListener('click', () => {
    if (!current?.canInstall) return;
    ctx.activate(current.id);
    ctx.refresh();
  });
  element.append(icon, branch, name, status, description, requires.section, unlocks.section, cost, install, why);
  return {
    element,
    render(view) {
      current = view;
      setHidden(element, view === null);
      if (!view) return;
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
      renderRelations(requires.list, view.requires);
      renderRelations(unlocks.list, view.unlocksNext);
      setHidden(requires.section, view.requires.length === 0);
      setHidden(unlocks.section, view.unlocksNext.length === 0);
      setText(cost, view.costText ?? '');
      setHidden(cost, view.costText === null || view.state === 'installed');
      setHidden(install, view.state === 'encrypted' || view.state === 'installed');
      install.disabled = !view.canInstall;
      setText(why, view.whyNot ?? '');
      setHidden(why, view.whyNot === null);
    },
  };
}
