/**
 * @module ui
 *
 * Thin DOM binding. Builds the screen once, then only updates text/attributes each frame.
 * All decisions about WHAT to show live in `viewModel.ts` (tested) and all wording in `uiText.ts`; this file only places the
 * widgets of `ui/widgets/`.
 */
import type { GameCommands, GameQueries } from '../core';
import { CREDITS_ICON_ID, type IconSource, noIcons } from './pixelIcon';
import { installTooltips, TipRegistry } from './tooltip';
import { type UiText, uiText as defaultText } from './uiText';
import { buildViewModel, type TabView } from './viewModel';
import { mountActionCards } from './widgets/actionCards';
import { buildAutomationWidget, renderAutomation } from './widgets/automationWidget';
import type { ChangelogEntry } from './widgets/changelogModal';
import { buildDebugControls, buildResleeveRow, buildSaveRow } from './widgets/controls';
import { mountCorporationPanel } from './widgets/corporationPanel';
import { applyIcon, h, setText, type UiContext, type UiSelection } from './widgets/domKit';
import { buildInventoryWidget, inventoryActions, renderInventory } from './widgets/inventoryWidget';
import { mountSkillsPanel } from './widgets/skillsPanel';
import { mountSleeveWidgets } from './widgets/sleeveWidgets';
import { mountStatsPanel } from './widgets/statsPanel';
import { buildStatWidget, renderStats } from './widgets/statWidget';
import { buildTabBar } from './widgets/tabBar';

export type { ChangelogEntry };

/** The fast-forward switch as the UI sees it (satisfied by `SpeedToggle`). */
export interface SpeedControl {
  readonly enabled: boolean;
  readonly factor: number;
  toggle(): boolean;
}

/** Optional settings of {@link mountUi}. */
export interface MountOptions {
  /** The display text (default: the placeholder text of the game). */
  readonly text?: UiText;
  /** Show the test aids bar at the top (Test drop, Reset save and the fast-forward toggle). Default: true. */
  readonly debugControls?: boolean;
  /** The icons shown beside actions, items and the credits (default: none). */
  readonly icons?: IconSource;
  /** Export and import of the save as text; the buttons are shown only when given. */
  readonly saveTransfer?: { exportSave(): void; importSave(): void };
  /** The entries of the changelog modal, newest first (default: none, which the modal says). */
  readonly changelog?: readonly ChangelogEntry[];
}

/**
 * Shows a message over the game (an alert for assistive technology).
 *
 * Called by: `main.ts`.
 *
 * @param root the element the game is mounted in
 * @param message the text to show
 */
export function showNotice(root: HTMLElement, message: string): void {
  const notice = root.ownerDocument.createElement('div');
  notice.className = 'notice';
  notice.setAttribute('role', 'alert');
  notice.textContent = message;
  root.prepend(notice);
}

/**
 * Mounts the game UI into `root` and returns a function that refreshes it.
 *
 * Called by: `main.ts`. Calls: `buildViewModel`, the widgets in `ui/widgets/`.
 *
 * @param root container element
 * @param engine the engine to display and command
 * @param speed the test fast-forward switch shown in the test aids bar
 * @param onResetSave called when the temporary "Reset save" button is pressed; must wipe the game and the stored save
 * @param options display text and whether the test aids are shown
 * @returns `render`, to be called after every tick
 */
export function mountUi(
  root: HTMLElement,
  engine: GameQueries & GameCommands,
  speed: SpeedControl,
  onResetSave: () => void,
  options: MountOptions = {},
): () => void {
  const text = options.text ?? defaultText;
  const icons = options.icons ?? noIcons;
  const selection: UiSelection = { augmentRarityId: null, revealAll: false };
  const initial = buildViewModel(engine, undefined, text, selection);
  root.innerHTML = '';
  const tips = new TipRegistry();
  const tooltips = installTooltips(root.ownerDocument, tips);
  const ctx: UiContext = { engine, text, icons, tips, selection, activate: (id) => engine.activateBuyable(id), refresh: () => render() };

  const header = h('header');
  const credits = h('div', 'credits');
  applyIcon(credits, icons.urlFor(CREDITS_ICON_ID));
  header.append(credits);

  const actions = mountActionCards(ctx, initial.actions);
  const sleeve = mountSleeveWidgets(ctx, initial.sleeve);
  const resleeveRow = buildResleeveRow(ctx);
  const networkWidget = buildStatWidget('network-widget', initial.network.title, initial.network.stats);
  const inventoryWidget = buildInventoryWidget(
    initial.inventory,
    icons,
    text,
    inventoryActions(engine, () => render()),
    selection,
  );
  const corporation = mountCorporationPanel(ctx, initial.corporation);
  const skills = mountSkillsPanel(ctx, initial.skills);
  const stats = mountStatsPanel(ctx, initial.runs);
  const saveRow = buildSaveRow(ctx, options.saveTransfer, options.changelog ?? []);
  root.append(saveRow.modal);

  // Top band: Sleeve on the left; to its right Network beside the sleeve-wide purchases, with Inventory under both. A line splits it from the actions.
  const right = h('div', 'dashboard-right');
  right.append(networkWidget.root, sleeve.upgrades, sleeve.exploitation, inventoryWidget.root);
  const dashboard = h('div', 'dashboard');
  dashboard.append(sleeve.stats.root, right);
  const layout = h('div', 'layout');
  layout.append(dashboard, h('hr', 'divider'), actions.root);
  // The test aids bar is appended before the header, so it is the first thing in the page and sits above the tabs.
  const debug = (options.debugControls ?? true) ? buildDebugControls(ctx, root, speed, onResetSave) : null;
  if (debug) root.append(debug.root);

  // The tabs sit on the credits line, to the right of the balance: the character's actions are on the Character tab, the corporation's on the Corporation tab.
  let activeTab: TabView['id'] = 'character';
  const tabBar = buildTabBar(initial.tabs, (id) => {
    activeTab = id;
    render();
  });
  const characterPanel = h('div', 'tab-panel character-panel');
  characterPanel.append(layout, saveRow.row);
  sleeve.stats.root.append(resleeveRow.root); // the bottom of the Sleeve widget
  const automationWidget = buildAutomationWidget(initial.automation, engine.automation(), text, () => render());
  const automationPanel = h('div', 'tab-panel automation-panel');
  automationPanel.append(automationWidget.root);
  header.append(tabBar.root);
  root.append(header, characterPanel, corporation.root, skills.root, automationPanel, stats.root);

  function render(): void {
    const vm = buildViewModel(engine, undefined, text, selection);
    setText(credits, vm.creditsLine);
    renderStats(networkWidget, vm.network.stats, tips);
    renderInventory(inventoryWidget, vm.inventory, tips, selection);
    // The corporation can close again (a new game): its tab then gives way to the Character tab.
    if (activeTab === 'corporation' && !vm.tabs.some((t) => t.id === 'corporation' && t.visible)) activeTab = 'character';
    tabBar.render(vm.tabs, activeTab);
    characterPanel.hidden = activeTab !== 'character';
    corporation.root.hidden = activeTab !== 'corporation';
    skills.root.hidden = activeTab !== 'skills';
    stats.root.hidden = activeTab !== 'stats';
    automationPanel.hidden = activeTab !== 'automation';
    renderAutomation(automationWidget, vm.automation);
    skills.render(vm.skills);
    if (!stats.root.hidden) stats.render(vm.runs.rows);
    actions.render(vm.actions);
    corporation.render(vm.corporation);
    sleeve.render(vm.sleeve);
    resleeveRow.render({ canResleeve: vm.canResleeve, shown: vm.resleeveShown, buy: vm.resleeveBuy });
    debug?.render();
    tooltips.refresh();
  }
  render();
  return render;
}
