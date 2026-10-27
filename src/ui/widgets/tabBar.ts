/**
 * @module ui
 *
 * The tabs on the credits line.
 *
 * @remarks
 * Called by: `ui/dom.ts`. Calls: `domKit.ts`.
 */
import type { TabView } from '../viewModel';
import { h, setText } from './domKit';

/** The row of tab buttons. */
export interface TabBar {
  readonly root: HTMLElement;
  /** Updates the labels, visibility, active tab and attention blink. */
  render(tabs: readonly TabView[], active: TabView['id']): void;
}

/**
 * Builds the tab buttons once.
 *
 * Called by: {@link mountUi}.
 *
 * @param initial the tabs as the first refresh sees them
 * @param select called with the id of the tab the player clicked
 */
export function buildTabBar(initial: readonly TabView[], select: (id: TabView['id']) => void): TabBar {
  const buttons = new Map<TabView['id'], HTMLButtonElement>();
  const root = h('nav', 'tabs');
  for (const tab of initial) {
    const button = h('button', 'tab') as HTMLButtonElement;
    button.addEventListener('click', () => select(tab.id));
    root.append(button);
    buttons.set(tab.id, button);
  }
  return {
    root,
    render(tabs, active) {
      for (const tab of tabs) {
        const button = buttons.get(tab.id);
        if (!button) continue;
        setText(button, tab.label);
        button.hidden = !tab.visible;
        button.classList.toggle('active', tab.id === active);
        button.classList.toggle('attention', tab.attention);
      }
      root.hidden = !tabs.some((t) => t.visible);
    },
  };
}
