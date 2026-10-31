/**
 * @module ui
 *
 * The top bar: the credits readout with the income rate, the small heat gauge and the tabs. It only draws `ViewModel.hud` and the
 * tab views; every text and percent comes from the view model.
 *
 * @remarks
 * Called by: `ui/dom.ts`. Calls: `domKit.ts`, `tabBar.ts`.
 */
import { CREDITS_ICON_ID, type IconSource } from '../pixelIcon';
import type { HudView, TabView } from '../viewModel';
import { applyIcon, h, setFill, setText } from './domKit';
import { type TabBar, buildTabBar } from './tabBar';

/** The top bar and its parts. */
export interface Hud {
  /** The `header` element. */
  readonly root: HTMLElement;
  /** The credits balance element (`.credits`), holding only the number. */
  readonly credits: HTMLElement;
  /** The income rate; hidden while the view has none. */
  readonly rate: HTMLElement;
  /** The heat gauge block; hidden while the view has none. */
  readonly heat: HTMLElement;
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

  const heatValue = h('span', 'hud-heat-value');
  const heatTax = h('span', 'hud-heat-tax');
  const heatRow = h('div', 'hud-heat-row');
  heatRow.append(heatValue, heatTax);
  const miniFill = h('i', 'mini-fill');
  const mini = h('div', 'mini');
  mini.append(miniFill);
  const heat = h('div', 'hud-heat');
  heat.append(heatRow, mini);

  const tabBar = buildTabBar(tabs, select);
  root.append(balance, heat, tabBar.root);
  rate.hidden = true;
  heat.hidden = true;
  return {
    root,
    credits,
    rate,
    heat,
    tabBar,
    render(hud) {
      setText(label, hud.creditsLabel);
      setText(credits, hud.creditsText);
      rate.hidden = hud.rateText === null;
      if (hud.rateText !== null) setText(rate, hud.rateText);
      heat.hidden = hud.heat === null;
      if (hud.heat === null) return;
      setText(heatValue, hud.heat.valueText);
      setText(heatTax, hud.heat.taxText);
      setFill(miniFill, hud.heat.fillPercent);
    },
  };
}
