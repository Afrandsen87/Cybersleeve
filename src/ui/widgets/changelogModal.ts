/**
 * @module ui
 *
 * The changelog modal: hidden until opened, closed by its button, a click on the backdrop or Escape.
 *
 * @remarks
 * Called by: `ui/widgets/controls.ts`. Calls: `domKit.ts`.
 */
import type { UiText } from '../uiText';
import { h } from './domKit';

/** One entry of the changelog as the modal needs it (structurally satisfied by `content/changelog.ts`). */
export interface ChangelogEntry {
  readonly version: string;
  readonly changes: readonly string[];
}

/**
 * Builds the changelog modal (hidden until opened). Closes with the Close button, a click on the backdrop or Escape.
 *
 * Called by: {@link mountUi}.
 *
 * @param entries the changelog entries, newest first
 * @param text the display text
 * @returns the modal's root element (to append to the page) and a function that opens it
 */
export function buildChangelogModal(entries: readonly ChangelogEntry[], text: UiText): { root: HTMLElement; open(): void } {
  const backdrop = h('div', 'modal-backdrop');
  backdrop.hidden = true;
  const dialog = h('div', 'modal');
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-label', text.changelog.title);
  const body = h('div', 'modal-body');
  if (entries.length === 0) {
    body.append(h('p', 'modal-empty', text.changelog.empty));
  }
  for (const entry of entries) {
    const list = h('ul');
    for (const change of entry.changes) list.append(h('li', undefined, change));
    body.append(h('h3', undefined, entry.version), list);
  }
  const closeBtn = h('button', 'modal-close', text.changelog.close) as HTMLButtonElement;
  const close = (): void => {
    backdrop.hidden = true;
  };
  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) close();
  });
  backdrop.ownerDocument.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });
  dialog.append(h('h2', undefined, text.changelog.title), body, closeBtn);
  backdrop.append(dialog);
  return {
    root: backdrop,
    open: () => {
      backdrop.hidden = false;
    },
  };
}
