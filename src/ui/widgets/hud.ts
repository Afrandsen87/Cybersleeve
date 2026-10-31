/**
 * @module ui
 *
 * The top bar: the credits readout with the income rate, and the tabs. It only draws `ViewModel.hud` and the
 * tab views; every text comes from the view model.
 *
 * @remarks
 * Called by: `ui/dom.ts`. Calls: `domKit.ts`, `tabBar.ts`.
 */
import { CREDITS_ICON_ID, type IconSource } from '../pixelIcon';
import type { HudView, TabView } from '../viewModel';
import { applyIcon, h, setText } from './domKit';
import { type TabBar, buildTabBar } from './tabBar';

/** The top bar and its parts. */
export interface Hud {
  /** The `header` element. */
  readonly root: HTMLElement;
  /** The credits balance element (`.credits`), holding only the number. */
  readonly credits: HTMLElement;
  /** The income rate; hidden while the view has none. */
  readonly rate: HTMLElement;
  readonly tabBar: TabBar;
  /** Writes the HUD view into the bar. */
  render(hud: HudView): void;
}

/**
 * Builds the top bar once.
 *
 * Called by: {@link mountUi}. Calls: {@link buildTabBar}, {@link applyIcon}.
 *
 * @param icons where the credits icon comes from
 * @param tabs the tabs as the first refresh sees them
 * @param select called with the id of the tab the player clicked
 */
export function buildHud(icons: IconSource, tabs: readonly TabView[], select: (id: TabView['id']) => void): Hud {
  const root = h('header', 'hud');
  const label = h('span', 'credits-label');
  const credits = h('div', 'credits');
  applyIcon(credits, icons.urlFor(CREDITS_ICON_ID));
  const rate = h('span', 'rate');
  const balance = h('div', 'hud-credits');
  balance.append(label, credits, rate);

  const tabBar = buildTabBar(tabs, select);
  root.append(balance, tabBar.root);
  rate.hidden = true;
  return {
    root,
    credits,
    rate,
    tabBar,
    render(hud) {
      setText(label, hud.creditsLabel);
      setText(credits, hud.creditsText);
      rate.hidden = hud.rateText === null;
      if (hud.rateText !== null) setText(rate, hud.rateText);
    },
  };
}
