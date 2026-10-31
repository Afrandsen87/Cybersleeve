/**
 * @module ui
 *
 * The tabs on the credits line: a label and a count badge per tab. The badge colour is chosen in CSS by the button's `data-tab`.
 *
 * @remarks
 * Called by: `ui/widgets/hud.ts`. Calls: `domKit.ts`.
 */
import type { TabView } from '../viewModel';
import { h, setText } from './domKit';

/** The row of tab buttons. */
export interface TabBar {
  readonly root: HTMLElement;
  /** Updates the labels, badges, visibility, active tab and attention blink. */
  render(tabs: readonly TabView[], active: TabView['id']): void;
}

/** The parts of one tab button. */
interface TabParts {
  readonly button: HTMLButtonElement;
  readonly label: HTMLElement;
  readonly badge: HTMLElement;
}

/**
 * Builds the tab buttons once.
 *
 * Called by: {@link buildHud}.
 *
 * @param initial the tabs as the first refresh sees them
 * @param select called with the id of the tab the player clicked
 */
export function buildTabBar(initial: readonly TabView[], select: (id: TabView['id']) => void): TabBar {
  const parts = new Map<TabView['id'], TabParts>();
  const root = h('nav', 'tabs');
  for (const tab of initial) {
    const button = h('button', 'tab') as HTMLButtonElement;
    button.dataset['tab'] = tab.id;
    button.addEventListener('click', () => select(tab.id));
    const label = h('span', 'tab-label');
    const badge = h('span', 'tab-badge');
    badge.hidden = true;
    button.append(label, badge);
    root.append(button);
    parts.set(tab.id, { button, label, badge });
  }
  return {
    root,
    render(tabs, active) {
      for (const tab of tabs) {
        const part = parts.get(tab.id);
        if (!part) continue;
        setText(part.label, tab.label);
        part.badge.hidden = tab.count === null;
        setText(part.badge, tab.count === null ? '' : String(tab.count));
        part.button.hidden = !tab.visible;
        part.button.classList.toggle('active', tab.id === active);
        part.button.classList.toggle('attention', tab.attention);
      }
      root.hidden = !tabs.some((t) => t.visible);
    },
  };
}
