/**
 * @module ui
 *
 * Thin DOM binding. Builds the screen once, then only updates text/attributes each frame.
 * All decisions about WHAT to show live in `viewModel.ts` (tested) and all wording in `uiText.ts`; this file only places it.
 */
import type { GameCommands, GameQueries } from '../core';
import { ConfirmGate } from './confirmGate';
import { installTooltips, TipRegistry } from './tooltip';
import { type UiText, uiText as defaultText, type StatId } from './uiText';
import { buildViewModel, type BuyableView, type InventoryView, type SleeveSection, type StatRowView, type TabView } from './viewModel';

/** Number of cells in the action grid (3 columns x 2 rows). Cells without an action are shown empty. */
const ACTION_GRID_SLOTS = 6;

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
  /** Show the test aids in the corner (Test drop, Reset save and the fast-forward toggle). Default: true. */
  readonly debugControls?: boolean;
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

/** Handles to update one action card. */
interface ActionCard {
  /** The whole card (a container, because it holds several buttons). */
  readonly root: HTMLElement;
  /** The clickable area that starts the action. */
  readonly button: HTMLButtonElement;
  readonly title: HTMLElement;
  readonly info: HTMLElement;
  readonly bar: HTMLElement;
  readonly reward: HTMLElement;
  readonly levelXp: XpBar;
  readonly sleeveXp: XpBar;
  /** Square purchase buttons of this action, by buyable id. */
  readonly buyables: ReadonlyMap<string, HTMLButtonElement>;
  /** The Augment button in the top right corner of the card. */
  readonly augment: HTMLButtonElement;
}

/** Handles to update one small experience bar with its label. */
interface XpBar {
  readonly root: HTMLElement;
  readonly label: HTMLElement;
  readonly fill: HTMLElement;
}

/** Handles to update one stat row. */
interface StatHandle {
  readonly row: HTMLElement;
  readonly value: HTMLElement;
  readonly bar: XpBar | null;
}

/** Handles to update the Inventory widget. */
interface InventoryWidget {
  readonly root: HTMLElement;
  readonly empty: HTMLElement;
  /** One entry per item and rarity, by `itemId/rarityId`. */
  readonly rows: ReadonlyMap<
    string,
    { readonly row: HTMLElement; readonly count: HTMLElement; readonly backChannel: HTMLElement; readonly sell: readonly HTMLElement[] }
  >;
}

/** A widget made of stat rows (the Sleeve and the Network). */
interface StatWidget {
  readonly root: HTMLElement;
  readonly rows: ReadonlyMap<StatId, StatHandle>;
}

/**
 * Mounts the game UI into `root` and returns a function that refreshes it.
 *
 * Called by: `main.ts`. Calls: `buildViewModel`, {@link GameCommands} (`startAction`, `activateBuyable`, `sellItems`, `resleeve`).
 *
 * @param root container element
 * @param engine the engine to display and command
 * @param speed the test fast-forward switch shown in the corner
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
  const initial = buildViewModel(engine, undefined, text);
  root.innerHTML = '';
  const tips = new TipRegistry();
  const tooltips = installTooltips(root.ownerDocument, tips);

  const header = h('header');
  const credits = h('div', 'credits');
  header.append(credits);

  /** A click on a purchase: the engine decides whether it buys or switches an auto-run. */
  const activate = (id: string): unknown => engine.activateBuyable(id);

  const actionsEl = h('section', 'actions');
  const cards = new Map<string, ActionCard>();
  for (const a of initial.actions) {
    const root = h('div', 'action');
    const button = h('button', 'action-main') as HTMLButtonElement;
    const title = h('div', 'action-title');
    const info = h('div', 'action-info');
    const bar = h('div', 'bar-fill');
    const track = h('div', 'bar');
    track.append(bar);
    const reward = h('div', 'action-reward');
    button.append(title, info, track, reward);
    button.addEventListener('click', () => engine.startAction(a.id));

    const levelXp = xpBar();
    const sleeveXp = xpBar();

    const { element: upgrades, buttons: buyables } = upgradeRow(a.buyables, activate);

    // The Augment button sits in the top right corner of the card, next to (not inside) the button that starts the action.
    const augment = h('button', 'augment', a.augment?.label ?? '') as HTMLButtonElement;
    augment.hidden = a.augment === null;
    augment.addEventListener('click', () => {
      engine.augmentAction(a.id);
      render();
    });

    root.append(button, augment, levelXp.root, sleeveXp.root, upgrades);
    actionsEl.append(root);
    cards.set(a.id, { root, button, title, info, bar, reward, levelXp, sleeveXp, buyables, augment });
  }

  for (let i = initial.actions.length; i < ACTION_GRID_SLOTS; i++) actionsEl.append(h('div', 'action empty'));

  const sleeveWidget = buildStatWidget('sleeve-widget', initial.sleeve.title, initial.sleeve.stats);
  const sleeveButtons = new Map<string, HTMLButtonElement>();
  // The sleeve-wide purchases live in two widgets beside Network: the ones paid in nodes in Network Exploitation, the rest in
  // Sleeve Improvements.
  const upgradesWidget = h('aside', 'upgrades-widget');
  upgradesWidget.append(h('h2', undefined, text.titles.upgrades));
  const exploitationWidget = h('aside', 'exploitation-widget');
  exploitationWidget.append(h('h2', undefined, text.titles.exploitation));
  for (const section of initial.sleeve.sections) {
    if (section.id === 'nodes') addSection(exploitationWidget, section, activate, sleeveButtons, false);
    else addSection(upgradesWidget, section, activate, sleeveButtons, section.id !== 'rebuyable'); // the rebuyables are the widget's main content
  }
  const networkWidget = buildStatWidget('network-widget', initial.network.title, initial.network.stats);
  const inventoryWidget = buildInventoryWidget(
    initial.inventory,
    text,
    (itemId, rarityId, amount) => {
      engine.sellItems(itemId, rarityId, amount);
      render();
    },
    (itemId, rarityId) => {
      engine.giveUpForMoles(itemId, rarityId, 1);
      render();
    },
  );

  // The Skills tab: a box holding the skills (bought with skill points).
  const skillsWidget = h('aside', 'skills-widget');
  const skillsPoints = h('div', 'skills-points');
  const skillButtons = new Map<string, HTMLButtonElement>();
  const skillsRow = upgradeRow(initial.skills.buyables, activate);
  for (const [id, button] of skillsRow.buttons) skillButtons.set(id, button);
  skillsWidget.append(h('h2', undefined, initial.skills.title), skillsPoints, skillsRow.element);

  // Re-sleeving wipes most progress, so it takes two clicks: the first arms the gate, the second confirms.
  const resleeveGate = new ConfirmGate();
  const resleeveBtn = h('button', 'resleeve') as HTMLButtonElement;
  resleeveBtn.addEventListener('click', () => {
    if (!engine.canResleeve()) resleeveGate.cancel();
    else if (resleeveGate.request()) engine.resleeve();
    render();
  });
  const resleeveCancel = h('button', 'resleeve-cancel', text.resleeve.cancel) as HTMLButtonElement;
  resleeveCancel.addEventListener('click', () => {
    resleeveGate.cancel();
    render();
  });
  const resleeveRow = h('div', 'resleeve-row');
  resleeveRow.append(resleeveBtn, resleeveCancel);

  const speedBtn = h('button', 'speed-toggle') as HTMLButtonElement;
  speedBtn.title = text.controls.speedToggleTip;
  speedBtn.addEventListener('click', () => speed.toggle());

  const dropBtn = h('button', 'test-drop', text.controls.testDrop) as HTMLButtonElement;
  dropBtn.title = text.controls.testDropTip;
  dropBtn.addEventListener('click', () => {
    engine.dropTestItem();
    render();
  });

  const resetBtn = h('button', 'reset-save', text.controls.resetSave) as HTMLButtonElement;
  resetBtn.title = text.controls.resetSaveTip;
  resetBtn.addEventListener('click', () => {
    onResetSave();
    render();
  });

  // Top band: Sleeve on the left; to its right Network beside the sleeve-wide purchases, with Inventory under both. A line splits it from the actions.
  const right = h('div', 'dashboard-right');
  right.append(networkWidget.root, upgradesWidget, exploitationWidget, inventoryWidget.root);
  const dashboard = h('div', 'dashboard');
  dashboard.append(sleeveWidget.root, right);
  const divider = h('hr', 'divider');
  const layout = h('div', 'layout');
  layout.append(dashboard, divider, actionsEl);
  if (options.debugControls ?? true) {
    const corner = h('div', 'corner-controls');
    corner.append(dropBtn, resetBtn, speedBtn);
    root.append(corner);
  }
  // The tabs at the top, centered: everything so far is on the Character tab, the skills are on the Skills tab.
  const tabButtons = new Map<TabView['id'], HTMLButtonElement>();
  const tabBar = h('nav', 'tabs');
  for (const tab of initial.tabs) {
    const button = h('button', 'tab') as HTMLButtonElement;
    button.addEventListener('click', () => {
      activeTab = tab.id;
      render();
    });
    tabBar.append(button);
    tabButtons.set(tab.id, button);
  }
  let activeTab: TabView['id'] = 'character';
  const characterPanel = h('div', 'tab-panel character-panel');
  characterPanel.append(layout, resleeveRow);
  const skillsPanel = h('div', 'tab-panel skills-panel');
  skillsPanel.append(skillsWidget);
  root.append(tabBar, header, characterPanel, skillsPanel);

  function render(): void {
    const vm = buildViewModel(engine, undefined, text);
    setText(credits, vm.creditsLine);
    renderStats(networkWidget, vm.network.stats, tips);
    renderInventory(inventoryWidget, vm.inventory, tips);
    for (const tab of vm.tabs) {
      const button = tabButtons.get(tab.id);
      if (!button) continue;
      setText(button, tab.label);
      button.classList.toggle('active', tab.id === activeTab);
    }
    characterPanel.hidden = activeTab !== 'character';
    skillsPanel.hidden = activeTab !== 'skills';
    setText(skillsPoints, vm.skills.pointsText);
    renderUpgrades(skillButtons, vm.skills.buyables, tips);
    for (const a of vm.actions) {
      const card = cards.get(a.id);
      if (!card) continue;
      setText(card.title, a.name);
      setText(card.info, a.infoText);
      tips.set(card.info, a.unlocked ? () => a.speedTip : null);
      setXpBar(card.levelXp, a.levelBarText, a.levelProgressPercent);
      setXpBar(card.sleeveXp, a.sleeveBarText, a.sleeve.progressPercent);
      setText(card.reward, a.rewardLine);
      card.button.disabled = !a.unlocked;
      card.root.classList.toggle('locked', !a.unlocked);
      setFill(card.bar, a.progressPercent);
      card.root.classList.toggle('running', a.running);
      renderUpgrades(card.buyables, a.buyables, tips);
      card.augment.hidden = a.augment === null;
      if (a.augment) {
        setText(card.augment, a.augment.label);
        card.augment.disabled = !a.augment.enabled;
        card.augment.classList.toggle('applied', a.augment.applied > 0);
        const { augment } = a;
        tips.set(card.augment, () => augment.tip);
      }
    }
    renderStats(sleeveWidget, vm.sleeve.stats, tips);
    renderUpgrades(sleeveButtons, vm.sleeve.buyables, tips);
    const armed = resleeveGate.isArmed && vm.canResleeve;
    resleeveBtn.disabled = !vm.canResleeve;
    setText(resleeveBtn, armed ? text.resleeve.armed : text.resleeve.idle);
    resleeveBtn.classList.toggle('armed', armed);
    resleeveCancel.hidden = !armed;
    setText(speedBtn, text.controls.speedToggle(speed.factor));
    speedBtn.classList.toggle('on', speed.enabled);
    tooltips.refresh();
  }
  render();
  return render;
}

/** Builds a row of square purchase buttons; clicking one calls `buy(id)`. */
function upgradeRow(
  views: readonly BuyableView[],
  buy: (id: string) => unknown,
): { element: HTMLElement; buttons: Map<string, HTMLButtonElement> } {
  const element = h('div', 'upgrades');
  const buttons = new Map<string, HTMLButtonElement>();
  for (const b of views) {
    const upgrade = h('button', 'upgrade', b.symbol) as HTMLButtonElement;
    upgrade.setAttribute('aria-label', b.name);
    upgrade.addEventListener('click', () => buy(b.id));
    element.append(upgrade);
    buttons.set(b.id, upgrade);
  }
  return { element, buttons };
}

/** Adds one row of purchase buttons (with its title, unless the widget's own heading already says it) to a widget and registers its buttons. */
function addSection(
  widget: HTMLElement,
  section: SleeveSection,
  buy: (id: string) => unknown,
  into: Map<string, HTMLButtonElement>,
  withTitle = true,
): void {
  const row = upgradeRow(section.buyables, buy);
  if (withTitle) widget.append(h('h3', 'section-title', section.title));
  widget.append(row.element);
  for (const [id, button] of row.buttons) into.set(id, button);
}

/** Updates square purchase buttons (visibility, enabled state, hover tooltip text) from their view data. */
function renderUpgrades(buttons: ReadonlyMap<string, HTMLButtonElement>, views: readonly BuyableView[], tips: TipRegistry): void {
  for (const b of views) {
    const upgrade = buttons.get(b.id);
    if (!upgrade) continue;
    upgrade.hidden = !b.available;
    upgrade.disabled = !b.clickable;
    upgrade.classList.toggle('owned', b.owned > 0);
    upgrade.classList.toggle('off', b.toggleable && b.owned > 0 && !b.enabled);
    upgrade.classList.toggle('ready', b.ready);
    tips.set(upgrade, () => b.tip);
  }
}

/** Builds a widget (title and one row per stat, with a cycle bar under the rows that have one). */
function buildStatWidget(className: string, title: string, stats: readonly StatRowView[]): StatWidget {
  const root = h('aside', className);
  const list = h('div', 'stats');
  const rows = new Map<StatId, StatHandle>();
  for (const stat of stats) {
    const row = h('div', 'stat');
    const value = h('span', 'stat-value');
    row.append(h('span', 'stat-label', stat.label), value);
    list.append(row);
    let bar: XpBar | null = null;
    if (stat.bar) {
      bar = xpBar();
      list.append(bar.root);
    }
    rows.set(stat.id, { row, value, bar });
  }
  root.append(h('h2', undefined, title), list);
  return { root, rows };
}

/** Writes the stat rows of the view model into a widget. */
function renderStats(widget: StatWidget, stats: readonly StatRowView[], tips: TipRegistry): void {
  for (const stat of stats) {
    const handle = widget.rows.get(stat.id);
    if (!handle) continue;
    handle.row.hidden = stat.hidden;
    if (handle.bar) handle.bar.root.hidden = stat.hidden;
    setText(handle.value, stat.text);
    tips.set(handle.row, stat.hasTip ? () => stat.tip ?? '' : null);
    if (stat.bar && handle.bar) setXpBar(handle.bar, stat.bar.label, stat.bar.percent);
  }
}

/**
 * Builds the Inventory widget: a row per item and rarity with its count and two sell buttons. Rows start hidden.
 *
 * Called by: {@link mountUi}.
 *
 * @param view the initial view data (decides which rows exist)
 * @param text the display text (button labels)
 * @param sell called with the item, the rarity and how many to sell when a sell button is pressed
 */
function buildInventoryWidget(
  view: InventoryView,
  text: UiText,
  sell: (itemId: string, rarityId: string, amount: number | 'all') => void,
  giveUp: (itemId: string, rarityId: string) => void,
): InventoryWidget {
  const root = h('aside', 'inventory-widget');
  const list = h('div', 'inventory');
  const empty = h('div', 'inventory-empty', view.emptyText);
  const rows = new Map<string, { row: HTMLElement; count: HTMLElement; backChannel: HTMLElement; sell: HTMLElement[] }>();
  for (const r of view.rows) {
    const row = h('div', 'inventory-row');
    const label = h('span', 'inventory-label', r.label);
    const count = h('span', 'inventory-count');
    const sellOne = h('button', 'inventory-sell', text.inventory.sellOne);
    const sellAll = h('button', 'inventory-sell', text.inventory.sellAll);
    sellOne.addEventListener('click', () => sell(r.itemId, r.rarityId, 1));
    sellAll.addEventListener('click', () => sell(r.itemId, r.rarityId, 'all'));
    const backChannel = h('button', 'inventory-sell inventory-back-channel', text.inventory.backChannel);
    backChannel.addEventListener('click', () => giveUp(r.itemId, r.rarityId));
    backChannel.hidden = true;
    row.append(label, count, sellOne, sellAll, backChannel);
    row.hidden = true;
    list.append(row);
    rows.set(`${r.itemId}/${r.rarityId}`, { row, count, backChannel, sell: [sellOne, sellAll] });
  }
  root.append(h('h2', undefined, view.title), list, empty);
  root.hidden = !view.visible;
  return { root, empty, rows };
}

/** Writes the inventory view into its widget: hides the widget and the empty stacks. */
function renderInventory(widget: InventoryWidget, view: InventoryView, tips: TipRegistry): void {
  widget.root.hidden = !view.visible;
  widget.empty.hidden = view.rows.some((r) => r.count > 0);
  for (const r of view.rows) {
    const handle = widget.rows.get(`${r.itemId}/${r.rarityId}`);
    if (!handle) continue;
    handle.row.hidden = r.count <= 0;
    setText(handle.count, r.countText);
    handle.backChannel.hidden = !r.backChannel;
    for (const button of handle.sell) button.hidden = !r.sellable;
    tips.set(handle.backChannel, r.backChannel ? () => r.backChannelTip : null);
    tips.set(handle.row, () => r.tip);
  }
}

/** Builds an empty small experience bar (label above a thin grey/teal bar). */
function xpBar(): XpBar {
  const label = h('div', 'xp-label');
  const fill = h('div', 'xp-fill');
  const track = h('div', 'xp-bar');
  track.append(fill);
  const root = h('div', 'xp');
  root.append(label, track);
  return { root, label, fill };
}

function setXpBar(bar: XpBar, label: string, percent: number): void {
  setText(bar.label, label);
  setFill(bar.fill, percent);
}

/** Sets an element's text only when it changed, so an unchanged frame touches nothing in the DOM. */
function setText(el: HTMLElement, text: string): void {
  if (el.textContent !== text) el.textContent = text;
}

/**
 * Sets how full a bar is. The fill is a full-width element scaled from the left (`transform`, which the browser can animate without
 * re-laying out the page), and CSS eases it towards each new value over one refresh interval so it moves smoothly between refreshes.
 * A bar that goes down (a run that finished and starts over) snaps back instead of sliding backwards.
 *
 * @param el the fill element
 * @param rawPercent how full the bar is, 0 to 100 (rounded to two decimals: finer changes are far below a pixel)
 */
function setFill(el: HTMLElement, rawPercent: number): void {
  const percent = Math.round(rawPercent * 100) / 100;
  const key = String(percent);
  const before = el.dataset['fill'];
  if (before === key) return;
  el.dataset['fill'] = key;
  const snap = before !== undefined && percent < Number(before);
  el.style.transition = snap ? 'none' : '';
  el.style.transform = `scaleX(${percent / 100})`;
}

function h(tag: string, className?: string, text?: string): HTMLElement {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.textContent = text;
  return el;
}
