/**
 * @module ui
 *
 * Thin DOM binding. Builds the screen once, then only updates text/attributes each frame.
 * All decisions about WHAT to show live in `viewModel.ts` (tested) and all wording in `uiText.ts`; this file only places it.
 */
import type { AutomationControls, AutomationFeature, GameCommands, GameQueries } from '../core';
import { ConfirmGate } from './confirmGate';
import { CREDITS_ICON_ID, type IconSource, noIcons, START_RUN_ICON_ID } from './pixelIcon';
import { installTooltips, TipRegistry } from './tooltip';
import { type SquareCellId, type UiText, uiText as defaultText, type StatId } from './uiText';
import {
  buildViewModel,
  type AutomationView,
  type BuyableView,
  type ActionSquareView,
  type InventoryRowView,
  type InventoryView,
  type RunRowView,
  type SleeveSection,
  type SquareCellView,
  type StatRowView,
  type TabView,
} from './viewModel';

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
  /** The icons shown beside actions, items and the credits (default: none). */
  readonly icons?: IconSource;
  /** Export and import of the save as text; the buttons are shown only when given. */
  readonly saveTransfer?: { exportSave(): void; importSave(): void };
  /** The entries of the changelog modal, newest first (default: none, which the modal says). */
  readonly changelog?: readonly ChangelogEntry[];
}

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
function buildChangelogModal(entries: readonly ChangelogEntry[], text: UiText): { root: HTMLElement; open(): void } {
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
  /** The icon button in the top right corner that also starts the action. */
  readonly start: HTMLButtonElement;
  /** The poster that replaces the card's content while the action is locked. */
  readonly poster: HTMLElement;
  readonly title: HTMLElement;
  /** The mark that lights up for a second when the action hits a critical success. */
  readonly crit: HTMLElement;
  readonly info: HTMLElement;
  readonly bar: HTMLElement;
  readonly reward: HTMLElement;
  readonly levelXp: XpBar;
  readonly sleeveXp: XpBar;
  /** Square purchase buttons of this action, by buyable id. */
  readonly buyables: ReadonlyMap<string, HTMLButtonElement>;
  /** The square beside the bars: the Auto-run unlock, or the four cells once Auto-run is owned. */
  readonly square: SquareHandle;
}

/** Handles to update the square of an action card. */
interface SquareHandle {
  /** The whole-square button that buys Auto-run (shown while it is not owned). */
  readonly unlock: HTMLButtonElement;
  /** The grid of four cells (shown once Auto-run is owned). */
  readonly grid: HTMLElement;
  /** The four cell buttons, by cell id. */
  readonly cells: ReadonlyMap<SquareCellId, HTMLButtonElement>;
  /** The square as the last refresh drew it (a press acts on what the player saw). */
  latest: ActionSquareView;
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
  /** The section of items that are kept or used, and the section of items that can be sold (each hidden when it has no items). */
  readonly keptSection: HTMLElement;
  readonly sellSection: HTMLElement;
  /** The row of tiles of each item, by item id (hidden while the item is not unlocked). */
  readonly groups: ReadonlyMap<string, HTMLElement>;
  /** One tile per item and rarity, by `itemId/rarityId`, with the element that shows its count. */
  readonly tiles: ReadonlyMap<string, { readonly tile: HTMLButtonElement; readonly count: HTMLElement }>;
  /** The buttons beside the sellable tiles; they act on the selected stack. */
  readonly sellOne: HTMLButtonElement;
  readonly sellAll: HTMLButtonElement;
  readonly backChannel: HTMLButtonElement;
  /** The sellable stack the player has selected (`itemId/rarityId`), or `null`. A choice of the screen only: not saved. */
  selected: string | null;
}

/** The key of a stack in the Inventory widget. */
const stackKey = (itemId: string, rarityId: string): string => `${itemId}/${rarityId}`;

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
  const icons = options.icons ?? noIcons;
  const initial = buildViewModel(engine, undefined, text);
  root.innerHTML = '';
  const tips = new TipRegistry();
  const tooltips = installTooltips(root.ownerDocument, tips);

  const header = h('header');
  const credits = h('div', 'credits');
  applyIcon(credits, icons.urlFor(CREDITS_ICON_ID));
  header.append(credits);

  /** A click on a purchase: the engine decides whether it buys or switches an auto-run. */
  const activate = (id: string): unknown => engine.activateBuyable(id);

  const actionsEl = h('section', 'actions');
  const cards = new Map<string, ActionCard>();
  for (const a of initial.actions) {
    const root = h('div', 'action');
    const button = h('button', 'action-main') as HTMLButtonElement;
    const title = h('div', 'action-title');
    applyIcon(title, icons.urlFor(a.id));
    const info = h('div', 'action-info');
    const bar = h('div', 'bar-fill');
    const track = h('div', 'bar');
    track.append(bar);
    const reward = h('div', 'action-reward');
    button.append(title, info, track);
    button.addEventListener('click', () => engine.startAction(a.id));

    const levelXp = xpBar();
    const sleeveXp = xpBar();
    levelXp.root.classList.add('xp-level');
    sleeveXp.root.classList.add('xp-sleeve');

    const { element: upgrades, buttons: buyables } = upgradeRow(
      a.buyables.filter((b) => !b.inSquare),
      activate,
      icons,
    );

    // The square beside the bars: one button that buys Auto-run, then a grid of Auto-run, Overclock, Focus and Augment.
    const { root: squareEl, handle: square } = buildSquare(a.square, icons, (cell) => {
      if (cell.mode === 'buy' || (cell.mode === 'toggle' && cell.id === 'autoRun')) {
        if (cell.buyableId !== null) engine.activateBuyable(cell.buyableId);
      } else if (cell.mode === 'toggle' && cell.id === 'overclock') engine.toggleOverclock(a.id);
      else if (cell.mode === 'toggle' && cell.id === 'focus') engine.toggleFocus(a.id);
      else if (cell.mode === 'press') engine.augmentAction(a.id);
      render();
    });

    // The start button floats in the top right corner (absolutely positioned, so it takes no room in the card's grid).
    const startBtn = h('button', 'start-run') as HTMLButtonElement;
    startBtn.setAttribute('aria-label', text.controls.startRun);
    applyIcon(startBtn, icons.urlFor(START_RUN_ICON_ID));
    if (!startBtn.classList.contains('has-icon')) startBtn.textContent = '▶';
    startBtn.addEventListener('click', () => engine.startAction(a.id));

    const poster = h('div', 'action-poster');
    const crit = h('div', 'crit-badge');
    crit.hidden = true;
    root.append(button, reward, levelXp.root, sleeveXp.root, squareEl, upgrades, startBtn, poster, crit);
    actionsEl.append(root);
    cards.set(a.id, { root, poster, button, start: startBtn, title, crit, info, bar, reward, levelXp, sleeveXp, buyables, square });
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
    if (section.id === 'nodes') addSection(exploitationWidget, section, activate, sleeveButtons, false, icons);
    else addSection(upgradesWidget, section, activate, sleeveButtons, section.id !== 'rebuyable', icons); // the rebuyables are the widget's main content
  }
  const networkWidget = buildStatWidget('network-widget', initial.network.title, initial.network.stats);
  const inventoryWidget = buildInventoryWidget(initial.inventory, icons, text, {
    sell: (itemId, rarityId, amount) => void engine.sellItems(itemId, rarityId, amount),
    giveUp: (itemId, rarityId) => void engine.giveUpForMoles(itemId, rarityId, 1),
    use: (itemId, rarityId) =>
      void (itemId === engine.getConfig().items.skillShard?.itemId ? engine.useSkillShard() : engine.useBurnLead(rarityId)),
    toggle: (itemId) => void (itemId === engine.getConfig().items.adminKey?.itemId ? engine.toggleAdminKeys() : engine.toggleZeroDays()),
    refresh: () => render(),
  });

  // The Skills tab: a box holding the skills (bought with skill points).
  const skillsWidget = h('aside', 'skills-widget');
  const skillsPoints = h('div', 'skills-points');
  const skillButtons = new Map<string, HTMLButtonElement>();
  const skillsRow = upgradeRow(initial.skills.buyables, activate, icons);
  for (const [id, button] of skillsRow.buttons) skillButtons.set(id, button);
  skillsWidget.append(h('h2', undefined, initial.skills.title), skillsPoints, skillsRow.element);

  // The re-sleeve skills: a tree, one row per depth (a skill sits below the ones it needs). Locked nodes are shown dimmed.
  const resleeveWidget = h('aside', 'skills-widget resleeve-skills');
  const resleevePoints = h('div', 'skills-points');
  const resleeveTree = h('div', 'skill-tree');
  const resleeveButtons = new Map<string, HTMLButtonElement>();
  for (const tier of initial.skills.resleeve.tiers) {
    const tierRow = upgradeRow(tier, activate, icons);
    tierRow.element.classList.add('skill-tier');
    for (const [id, button] of tierRow.buttons) resleeveButtons.set(id, button);
    resleeveTree.append(tierRow.element);
  }
  resleeveWidget.append(h('h2', undefined, initial.skills.resleeve.title), resleevePoints, resleeveTree);

  // The Stats tab: the latest finished sleeve-runs, newest first.
  const statsWidget = h('aside', 'stats-widget');
  const runsTable = h('div', 'runs-table');
  const runsEmpty = h('div', 'runs-empty', text.runs.empty);
  statsWidget.append(h('h2', undefined, initial.runs.title), runsEmpty, runsTable);
  let runsShown = '';

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

  // Test aid: shows locked actions in full instead of the access level poster (a class on the root; no game state changes).
  const revealBtn = h('button', 'reveal-locked-toggle', text.controls.revealLocked) as HTMLButtonElement;
  revealBtn.title = text.controls.revealLockedTip;
  revealBtn.addEventListener('click', () => {
    revealBtn.classList.toggle('on', root.classList.toggle('reveal-locked'));
  });

  const dropBtn = h('button', 'test-drop', text.controls.testDrop) as HTMLButtonElement;
  dropBtn.title = text.controls.testDropTip;
  dropBtn.addEventListener('click', () => {
    engine.dropTestItem();
    render();
  });

  const doubleBtn = h('button', 'double-credits', text.controls.doubleCredits) as HTMLButtonElement;
  doubleBtn.title = text.controls.doubleCreditsTip;
  doubleBtn.addEventListener('click', () => {
    engine.doubleCredits();
    render();
  });

  const resetBtn = h('button', 'reset-save', text.controls.resetSave) as HTMLButtonElement;
  resetBtn.title = text.controls.resetSaveTip;
  resetBtn.addEventListener('click', () => {
    onResetSave();
    render();
  });

  const saveRow = h('div', 'save-row');
  if (options.saveTransfer) {
    const { exportSave, importSave } = options.saveTransfer;
    const exportBtn = h('button', 'save-export', text.saveTools.export) as HTMLButtonElement;
    exportBtn.title = text.saveTools.exportTip;
    exportBtn.addEventListener('click', () => exportSave());
    const importBtn = h('button', 'save-import', text.saveTools.import) as HTMLButtonElement;
    importBtn.title = text.saveTools.importTip;
    importBtn.addEventListener('click', () => importSave());
    saveRow.append(exportBtn, importBtn);
  }
  const changelogModal = buildChangelogModal(options.changelog ?? [], text);
  const changelogBtn = h('button', 'changelog-open', text.changelog.button) as HTMLButtonElement;
  changelogBtn.title = text.changelog.tip;
  changelogBtn.addEventListener('click', () => changelogModal.open());
  saveRow.append(changelogBtn);
  root.append(changelogModal.root);

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
    corner.append(revealBtn, dropBtn, doubleBtn, resetBtn, speedBtn);
    root.append(corner);
  }
  // The tabs sit on the credits line, to the right of the balance: everything so far is on the Character tab, the skills are on the Skills tab.
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
  characterPanel.append(layout, resleeveRow, saveRow);
  const skillsPanel = h('div', 'tab-panel skills-panel');
  skillsPanel.append(skillsWidget, resleeveWidget);
  const statsPanel = h('div', 'tab-panel stats-panel');
  statsPanel.append(statsWidget);
  const automationWidget = buildAutomationWidget(initial.automation, engine.automation(), text, () => render());
  const automationPanel = h('div', 'tab-panel automation-panel');
  automationPanel.append(automationWidget.root);
  header.append(tabBar);
  root.append(header, characterPanel, skillsPanel, automationPanel, statsPanel);

  /** Redraws the list of runs when it has changed (it only changes at a re-sleeve). */
  function renderRuns(rows: readonly RunRowView[]): void {
    const signature = rows.map((r) => `${r.label}|${r.incomeText}|${r.levelsText}`).join('|');
    if (signature === runsShown) return;
    runsShown = signature;
    runsEmpty.hidden = rows.length > 0;
    const header = h('div', 'run-row run-head');
    header.append(
      h('span', undefined, text.runs.headers.run),
      h('span', undefined, text.runs.headers.income),
      h('span', undefined, text.runs.headers.levels),
    );
    const lines = rows.map((r) => {
      const line = h('div', 'run-row');
      line.append(h('span', undefined, r.label), h('span', undefined, r.incomeText), h('span', undefined, r.levelsText));
      return line;
    });
    runsTable.replaceChildren(...(rows.length > 0 ? [header, ...lines] : []));
  }

  function render(): void {
    const vm = buildViewModel(engine, undefined, text);
    setText(credits, vm.creditsLine);
    renderStats(networkWidget, vm.network.stats, tips);
    renderInventory(inventoryWidget, vm.inventory, tips);
    for (const tab of vm.tabs) {
      const button = tabButtons.get(tab.id);
      if (!button) continue;
      setText(button, tab.label);
      button.hidden = !tab.visible;
      button.classList.toggle('active', tab.id === activeTab);
      button.classList.toggle('attention', tab.attention);
    }
    tabBar.hidden = !vm.tabs.some((t) => t.visible);
    characterPanel.hidden = activeTab !== 'character';
    skillsPanel.hidden = activeTab !== 'skills';
    statsPanel.hidden = activeTab !== 'stats';
    automationPanel.hidden = activeTab !== 'automation';
    renderAutomation(automationWidget, vm.automation);
    setText(skillsPoints, vm.skills.pointsText);
    renderUpgrades(skillButtons, vm.skills.buyables, tips);
    resleeveWidget.hidden = !vm.skills.resleeve.visible;
    setText(resleevePoints, vm.skills.resleeve.pointsText);
    const treeSkills = vm.skills.resleeve.tiers.flat();
    renderUpgrades(resleeveButtons, treeSkills, tips);
    for (const b of treeSkills) {
      const button = resleeveButtons.get(b.id);
      if (!button) continue;
      button.hidden = false; // the whole tree is visible; a node that cannot be bought yet is dimmed
      button.classList.toggle('locked', !b.available);
    }
    if (!statsPanel.hidden) renderRuns(vm.runs.rows);
    for (const a of vm.actions) {
      const card = cards.get(a.id);
      if (!card) continue;
      setText(card.title, a.name);
      card.crit.hidden = a.critText === null;
      setText(card.crit, a.critText ?? '');
      card.root.classList.toggle('crit-hit', a.critText !== null);
      setText(card.info, a.infoText);
      tips.set(card.info, a.unlocked ? () => a.speedTip : null);
      setXpBar(card.levelXp, a.levelBarText, a.levelProgressPercent);
      setXpBar(card.sleeveXp, a.sleeveBarText, a.sleeve.progressPercent);
      setText(card.reward, a.rewardLine);
      card.button.disabled = !a.startable;
      card.start.disabled = !a.startable || a.running; // greyed out until the run is over
      card.root.classList.toggle('locked', !a.unlocked);
      setText(card.poster, a.posterText);
      setFill(card.bar, a.progressPercent);
      card.root.classList.toggle('running', a.running);
      renderUpgrades(card.buyables, a.buyables, tips);
      renderSquare(card.square, a.square, tips);
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
  icons: IconSource,
): { element: HTMLElement; buttons: Map<string, HTMLButtonElement> } {
  const element = h('div', 'upgrades');
  const buttons = new Map<string, HTMLButtonElement>();
  for (const b of views) {
    const upgrade = h('button', 'upgrade', b.symbol) as HTMLButtonElement;
    applyIcon(upgrade, icons.urlFor(b.id));
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
  withTitle: boolean,
  icons: IconSource,
): void {
  const row = upgradeRow(section.buyables, buy, icons);
  if (withTitle) widget.append(h('h3', 'section-title', section.title));
  widget.append(row.element);
  for (const [id, button] of row.buttons) into.set(id, button);
}

/**
 * Builds the square of an action card: one button that buys Auto-run, and a grid of four cells shown once Auto-run is owned.
 *
 * Called by: {@link mountUi}.
 *
 * @param view the square as the first refresh sees it (decides which cells exist)
 * @param icons the icons (the Overclock and Focus cells show the pictures of those names)
 * @param press called with the cell that was pressed, as the last refresh drew it
 * @returns the element to place in the card and the handles to update it
 */
function buildSquare(
  view: ActionSquareView,
  icons: IconSource,
  press: (cell: SquareCellView) => void,
): { root: HTMLElement; handle: SquareHandle } {
  const root = h('div', 'square');
  const unlock = h('button', 'upgrade square-unlock', view.cells[0]?.symbol ?? '') as HTMLButtonElement;
  applyIcon(unlock, icons.urlFor(view.cells[0]?.id ?? ''));
  unlock.setAttribute('aria-label', view.cells[0]?.name ?? '');
  const grid = h('div', 'square-grid');
  const cells = new Map<SquareCellId, HTMLButtonElement>();
  const handle: SquareHandle = { unlock, grid, cells, latest: view };
  unlock.addEventListener('click', () => {
    const cell = handle.latest.cells[0];
    if (cell) press(cell);
  });
  for (const cell of view.cells) {
    const button = h('button', `upgrade cell cell-${cell.id}`, cell.symbol) as HTMLButtonElement;
    applyIcon(button, icons.urlFor(cell.id));
    button.setAttribute('aria-label', cell.name);
    if (cell.id === 'augment') button.classList.add('augment');
    button.addEventListener('click', () => {
      const latest = handle.latest.cells.find((c) => c.id === cell.id);
      if (latest) press(latest);
    });
    grid.append(button);
    cells.set(cell.id, button);
  }
  root.append(unlock, grid);
  return { root, handle };
}

/**
 * Updates the square of an action card from its view. While Auto-run is locked the whole square is the button that buys it. Once it
 * is owned each cell shows what it is: a purchase (not bought yet, lit when affordable), a toggle (lit when on, struck through when
 * off), the Augment button, or an empty placeholder for a feature the action does not have.
 */
function renderSquare(square: SquareHandle, view: ActionSquareView, tips: TipRegistry): void {
  square.latest = view;
  const auto = view.cells[0];
  square.unlock.hidden = !view.locked;
  square.grid.hidden = view.locked;
  if (view.locked && auto) {
    square.unlock.disabled = !auto.clickable;
    square.unlock.classList.toggle('ready', auto.ready);
    square.unlock.classList.toggle('purchasable', auto.clickable);
    tips.set(square.unlock, () => auto.tip);
    return;
  }
  for (const cell of view.cells) {
    const button = square.cells.get(cell.id);
    if (!button) continue;
    button.disabled = !cell.clickable;
    button.classList.toggle('empty', cell.mode === 'empty');
    button.classList.toggle('owned', cell.mode === 'toggle');
    button.classList.toggle('off', cell.mode === 'toggle' && !cell.on);
    button.classList.toggle('ready', cell.mode === 'buy' && cell.ready);
    button.classList.toggle('purchasable', cell.mode === 'buy' && cell.clickable);
    button.classList.toggle('applied', cell.id === 'augment' && cell.on);
    tips.set(button, cell.mode === 'empty' ? null : () => cell.tip);
  }
}

/** Updates square purchase buttons (visibility, enabled state, hover tooltip text) from their view data. */
function renderUpgrades(buttons: ReadonlyMap<string, HTMLButtonElement>, views: readonly BuyableView[], tips: TipRegistry): void {
  for (const b of views) {
    const upgrade = buttons.get(b.id);
    if (!upgrade) continue;
    upgrade.hidden = !b.available;
    upgrade.disabled = !b.clickable;
    upgrade.classList.toggle('owned', b.owned > 0);
    upgrade.classList.toggle('single', !b.repeatable);
    upgrade.classList.toggle('off', b.toggleable && b.owned > 0 && !b.enabled);
    upgrade.classList.toggle('ready', b.ready);
    upgrade.classList.toggle('purchasable', b.available && !b.maxed && b.affordable);
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
 * Builds the Inventory widget: a grid tile for every item and rarity (its icon, with the count underneath), in two sections. The
 * items that are kept or used are on the left; the items that can be sold are on the right, where a tile is selected by clicking it
 * and the buttons beside the grid sell what is selected. Clicking a tile of an item that is used (a Burn lead) uses one; clicking a Zero-day switches its toggle.
 *
 * Called by: {@link mountUi}.
 *
 * @param view the initial view data (decides which tiles exist)
 * @param icons the icons of the items
 * @param text the display text (headings and button labels)
 * @param actions what the tiles and buttons do; each is followed by a refresh of the screen
 */
function buildInventoryWidget(
  view: InventoryView,
  icons: IconSource,
  text: UiText,
  actions: {
    sell(itemId: string, rarityId: string, amount: number | 'all'): void;
    giveUp(itemId: string, rarityId: string): void;
    use(itemId: string, rarityId: string): void;
    toggle(itemId: string): void;
    refresh(): void;
  },
): InventoryWidget {
  const root = h('aside', 'inventory-widget');
  const keptGrid = h('div', 'item-grid');
  const sellGrid = h('div', 'item-grid');
  const groups = new Map<string, HTMLElement>();
  const tiles = new Map<string, { tile: HTMLButtonElement; count: HTMLElement }>();
  const widget: InventoryWidget = {
    root,
    keptSection: h('section', 'inventory-section'),
    sellSection: h('section', 'inventory-section inventory-for-sale'),
    groups,
    tiles,
    sellOne: h('button', 'inventory-action', text.inventory.sellOne) as HTMLButtonElement,
    sellAll: h('button', 'inventory-action', text.inventory.sellAll) as HTMLButtonElement,
    backChannel: h('button', 'inventory-action', text.inventory.backChannel) as HTMLButtonElement,
    selected: null,
  };
  for (const r of view.rows) {
    const key = stackKey(r.itemId, r.rarityId);
    const tile = h('button', `item-tile${r.rarityIndex === null ? '' : ` rarity-${r.rarityIndex}`}`) as HTMLButtonElement;
    const icon = h('span', 'item-icon', r.symbol);
    applyIcon(icon, icons.urlFor(r.itemId));
    const count = h('span', 'item-count');
    tile.append(icon, count);
    tile.setAttribute('aria-label', r.label);
    tile.addEventListener('click', () => {
      if (r.sellable) widget.selected = widget.selected === key ? null : key;
      else if (r.toggleable) actions.toggle(r.itemId);
      else if (r.usable) actions.use(r.itemId, r.rarityId);
      actions.refresh();
    });
    // The tiles of one item sit together in a row of their own; a divider separates the items.
    const grid = r.sellable ? sellGrid : keptGrid;
    let group = groups.get(r.itemId);
    if (!group) {
      group = h('div', 'item-group');
      groups.set(r.itemId, group);
      grid.append(group);
    }
    group.append(tile);
    tiles.set(key, { tile, count });
  }
  const selectedRow = (): InventoryRowView | undefined => {
    const [itemId, rarityId] = (widget.selected ?? '').split('/');
    return view.rows.find((r) => r.itemId === itemId && r.rarityId === rarityId);
  };
  widget.sellOne.addEventListener('click', () => {
    const r = selectedRow();
    if (r) actions.sell(r.itemId, r.rarityId, 1);
    actions.refresh();
  });
  widget.sellAll.addEventListener('click', () => {
    const r = selectedRow();
    if (r) actions.sell(r.itemId, r.rarityId, 'all');
    actions.refresh();
  });
  widget.backChannel.addEventListener('click', () => {
    const r = selectedRow();
    if (r) actions.giveUp(r.itemId, r.rarityId);
    actions.refresh();
  });
  const buttons = h('div', 'inventory-actions');
  buttons.append(widget.sellOne, widget.sellAll, widget.backChannel);
  const sellBody = h('div', 'inventory-sell-body');
  sellBody.append(sellGrid, buttons);
  widget.keptSection.append(h('h3', 'section-title', text.inventory.sections.kept), keptGrid);
  widget.sellSection.append(h('h3', 'section-title', text.inventory.sections.sellable), sellBody);
  const body = h('div', 'inventory-body');
  body.append(widget.keptSection, widget.sellSection);
  root.append(h('h2', undefined, view.title), body);
  root.hidden = !view.visible;
  return widget;
}

/**
 * Writes the inventory view into its widget: every tile shows its count (dimmed while it is 0), the selected sellable stack is
 * marked, and the buttons beside the sellable tiles act on it. A selection that has run out (everything sold) is dropped.
 */
function renderInventory(widget: InventoryWidget, view: InventoryView, tips: TipRegistry): void {
  widget.root.hidden = !view.visible;
  // Only items that are unlocked show; a section with no item to show is hidden too.
  for (const [itemId, group] of widget.groups) group.hidden = !view.rows.some((r) => r.itemId === itemId && r.unlocked);
  widget.keptSection.hidden = !view.rows.some((r) => !r.sellable && r.unlocked);
  widget.sellSection.hidden = !view.rows.some((r) => r.sellable && r.unlocked);
  const selectedKey = widget.selected;
  const selected = view.rows.find((r) => r.sellable && stackKey(r.itemId, r.rarityId) === selectedKey);
  if (selectedKey !== null && !(selected && selected.count > 0)) widget.selected = null;
  for (const r of view.rows) {
    const key = stackKey(r.itemId, r.rarityId);
    const handle = widget.tiles.get(key);
    if (!handle) continue;
    setText(handle.count, r.countText);
    handle.tile.classList.toggle('empty', r.count <= 0);
    handle.tile.classList.toggle('selected', key === widget.selected);
    handle.tile.classList.toggle('on', r.on);
    handle.tile.disabled = r.sellable ? r.count <= 0 : !((r.usable || r.toggleable) && r.canUse);
    tips.set(handle.tile, () => r.tip);
  }
  const chosen = widget.selected === null ? undefined : selected;
  widget.sellOne.disabled = !chosen;
  widget.sellAll.disabled = !chosen;
  const channel = view.rows.find((r) => r.backChannel);
  widget.backChannel.hidden = channel === undefined;
  widget.backChannel.disabled = !(chosen?.backChannel && chosen.count > 0);
  tips.set(widget.backChannel, channel ? () => channel.backChannelTip : null);
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

/**
 * Gives an element an icon drawn before its text (a `::before` box that paints the `--icon` image). Adds no child, so the
 * element's text can still be replaced freely.
 *
 * @param el the element
 * @param url the CSS image value from an {@link IconSource}; `null` leaves the element as it is
 */
function applyIcon(el: HTMLElement, url: string | null): void {
  if (url === null) return;
  el.classList.add('has-icon');
  el.style.setProperty('--icon', url);
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

/** Handles to update the Automation tab. */
interface AutomationWidget {
  readonly root: HTMLElement;
  readonly points: HTMLElement;
  /** Each feature's box, its unlock button and the controls that show once it is unlocked. */
  readonly features: ReadonlyMap<AutomationFeature, { box: HTMLElement; unlock: HTMLButtonElement; controls: HTMLElement }>;
  readonly autoBurnSwitch: HTMLButtonElement;
  readonly autoBurnCeiling: HTMLInputElement;
  readonly rarities: ReadonlyMap<string, HTMLButtonElement>;
  readonly shares: ReadonlyMap<string, HTMLInputElement>;
}

/** A labelled number input. A change (Enter or leaving the field) is passed to `onChange` as a number. */
function numberField(
  label: string,
  min: number,
  max: number | null,
  onChange: (value: number) => void,
): { row: HTMLElement; input: HTMLInputElement } {
  const row = h('label', 'automation-field');
  row.append(h('span', undefined, label));
  const input = h('input') as HTMLInputElement;
  input.type = 'number';
  input.min = String(min);
  if (max !== null) input.max = String(max);
  input.addEventListener('change', () => onChange(Number(input.value)));
  row.append(input);
  return { row, input };
}

/**
 * Builds the Automation tab: the points, and one box per feature with an unlock button and, once unlocked, its controls (Auto Burn's switch and
 * ceiling, a switch per rarity for autosale, a share per action for dispersal). Every press goes to the automation controls of the engine,
 * which decide what is allowed.
 *
 * Called by: {@link mountUi}.
 *
 * @param view the initial view data (decides which switches and inputs exist)
 * @param controls the engine's automation controls
 * @param text the display text
 * @param refresh redraws the screen after a press
 */
function buildAutomationWidget(view: AutomationView, controls: AutomationControls, text: UiText, refresh: () => void): AutomationWidget {
  const root = h('aside', 'automation-widget');
  const points = h('div', 'skills-points');
  root.append(h('h2', undefined, view.title), points);
  const features = new Map<AutomationFeature, { box: HTMLElement; unlock: HTMLButtonElement; controls: HTMLElement }>();
  const autoBurnSwitch = h('button', 'automation-switch') as HTMLButtonElement;
  autoBurnSwitch.addEventListener('click', () => {
    controls.setAutoBurn(!controls.isAutoBurnOn());
    refresh();
  });
  const ceiling = numberField(view.autoBurn.ceilingLabel, 0, null, (v) => {
    controls.setAutoBurnCeiling(v);
    refresh();
  });
  const rarities = new Map<string, HTMLButtonElement>();
  const shares = new Map<string, HTMLInputElement>();
  for (const f of view.features) {
    const box = h('section', `automation-feature automation-${f.id}`);
    const unlock = h('button', 'automation-unlock', text.automation.unlock) as HTMLButtonElement;
    unlock.addEventListener('click', () => {
      controls.unlock(f.id);
      refresh();
    });
    const body = h('div', 'automation-controls');
    if (f.id === 'autoBurn') body.append(autoBurnSwitch, ceiling.row);
    else if (f.id === 'autosale') {
      for (const r of view.rarities) {
        const b = h('button', 'automation-switch', r.name) as HTMLButtonElement;
        b.addEventListener('click', () => {
          controls.setAutosale(r.id, !controls.isAutosaleOn(r.id));
          refresh();
        });
        rarities.set(r.id, b);
        body.append(b);
      }
    } else {
      for (const a of view.actions) {
        const field = numberField(`${a.name}: ${view.shareLabel}`, 0, 100, (v) => {
          controls.setDispersal(a.id, v);
          refresh();
        });
        shares.set(a.id, field.input);
        body.append(field.row);
      }
    }
    box.append(h('h3', 'section-title', f.name), h('p', 'automation-description', f.description), unlock, body);
    features.set(f.id, { box, unlock, controls: body });
    root.append(box);
  }
  return { root, points, features, autoBurnSwitch, autoBurnCeiling: ceiling.input, rarities, shares };
}

/** Sets an input's value from the game unless the player is typing in it (their text is not overwritten). */
function syncInput(input: HTMLInputElement, value: number): void {
  if (input.ownerDocument.activeElement !== input) input.value = String(value);
}

/** Writes the Automation view into its widget: the points, which features are unlocked, and the current settings. */
function renderAutomation(widget: AutomationWidget, view: AutomationView): void {
  setText(widget.points, view.pointsText);
  for (const f of view.features) {
    const handle = widget.features.get(f.id);
    if (!handle) continue;
    handle.unlock.hidden = f.unlocked;
    handle.unlock.disabled = !f.canUnlock;
    handle.controls.hidden = !f.unlocked;
    handle.box.classList.toggle('unlocked', f.unlocked);
  }
  setText(widget.autoBurnSwitch, view.autoBurn.switchText);
  widget.autoBurnSwitch.classList.toggle('on', view.autoBurn.on);
  syncInput(widget.autoBurnCeiling, view.autoBurn.ceiling);
  for (const r of view.rarities) widget.rarities.get(r.id)?.classList.toggle('on', r.on);
  for (const a of view.actions) {
    const input = widget.shares.get(a.id);
    if (input) syncInput(input, a.percent);
  }
}
