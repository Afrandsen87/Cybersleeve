/**
 * @module ui
 *
 * The action cards: each with its run bar, level bars, reward line, square of toggles and row of purchases.
 *
 * @remarks
 * Called by: `ui/dom.ts`. Calls: `domKit.ts`, `upgradeButtons.ts`.
 */
import type { IconSource } from '../pixelIcon';
import { START_RUN_ICON_ID } from '../pixelIcon';
import type { TipRegistry } from '../tooltip';
import type { SquareCellId } from '../uiText';
import type { ActionSquareView, ActionView, SquareCellView } from '../viewModel';
import { type UiContext, type XpBar, applyIcon, h, setFill, setText, setXpBar, xpBar } from './domKit';
import { renderUpgrades, upgradeRow } from './upgradeButtons';

/** Number of cells in the action grid (3 columns x 2 rows). Cells without an action are shown empty. */
export const ACTION_GRID_SLOTS = 6;

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
  /** The add and remove halves laid over the Focus cell (shown only while several slots may sit on one action). */
  readonly halves: { readonly add: HTMLButtonElement; readonly remove: HTMLButtonElement };
  /** The square as the last refresh drew it (a press acts on what the player saw). */
  latest: ActionSquareView;
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
  pressHalf: (half: 'add' | 'remove') => void,
): { root: HTMLElement; handle: SquareHandle } {
  const root = h('div', 'square');
  const unlock = h('button', 'upgrade square-unlock', view.cells[0]?.symbol ?? '') as HTMLButtonElement;
  applyIcon(unlock, icons.urlFor(view.cells[0]?.id ?? ''));
  unlock.setAttribute('aria-label', view.cells[0]?.name ?? '');
  const grid = h('div', 'square-grid');
  const cells = new Map<SquareCellId, HTMLButtonElement>();
  const half = (kind: 'add' | 'remove', label: string, name: string): HTMLButtonElement => {
    const button = h('button', `upgrade cell-half cell-half-${kind}`, label) as HTMLButtonElement;
    button.setAttribute('aria-label', name);
    button.hidden = true;
    button.addEventListener('click', () => pressHalf(kind));
    return button;
  };
  const halves = { add: half('add', '+', 'Add a Focus slot'), remove: half('remove', '−', 'Remove a Focus slot') };
  const handle: SquareHandle = { unlock, grid, cells, halves, latest: view };
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
  root.append(unlock, grid, halves.add, halves.remove);
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
    // an owned Focus cell with several slots per action is split into an add and a remove half laid over it
    if (cell.id === 'focus') {
      const split = cell.split;
      square.halves.add.hidden = !split;
      square.halves.remove.hidden = !split;
      button.classList.toggle('split', split !== undefined);
      if (split) {
        square.halves.add.disabled = !split.canAdd;
        square.halves.remove.disabled = !split.canRemove;
        tips.set(square.halves.add, () => split.addTip);
        tips.set(square.halves.remove, () => split.removeTip);
      }
    }
  }
}

/** The action grid on the Character tab. */
export interface ActionCards {
  /** The section to place in the page. */
  readonly root: HTMLElement;
  /** Writes the view of every action into its card. */
  render(actions: readonly ActionView[]): void;
}

/**
 * Builds the action cards once.
 *
 * Called by: {@link mountUi}. Calls: {@link buildSquare}, `upgradeRow`, `GameCommands.startAction`, `activateBuyable`, `toggleOverclock`,
 * `toggleFocus`, `augmentAction`.
 *
 * @param ctx what the widget needs from the screen
 * @param initial the actions as the first refresh sees them (decides which cards exist)
 */
export function mountActionCards(ctx: UiContext, initial: readonly ActionView[]): ActionCards {
  const { engine, text, icons, tips } = ctx;
  const root = h('section', 'actions');
  const cards = new Map<string, ActionCard>();
  for (const a of initial) {
    const card = h('div', 'action');
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
      ctx.activate,
      icons,
    );

    // The square beside the bars: one button that buys Auto-run, then a grid of Auto-run, Overclock, Focus and Augment.
    const { root: squareEl, handle: square } = buildSquare(
      a.square,
      icons,
      (cell) => {
        if (cell.mode === 'buy' || (cell.mode === 'toggle' && cell.id === 'autoRun')) {
          if (cell.buyableId !== null) engine.activateBuyable(cell.buyableId);
        } else if (cell.mode === 'toggle' && cell.id === 'overclock') engine.toggleOverclock(a.id);
        else if (cell.mode === 'toggle' && cell.id === 'focus' && !cell.split) engine.toggleFocus(a.id);
        else if (cell.mode === 'press' && ctx.selection.augmentRarityId !== null) engine.augmentAction(a.id, ctx.selection.augmentRarityId);
        ctx.refresh();
      },
      (kind) => {
        if (kind === 'add') engine.addFocus(a.id);
        else engine.removeFocus(a.id);
        ctx.refresh();
      },
    );

    // The start button floats in the top right corner (absolutely positioned, so it takes no room in the card's grid).
    const startBtn = h('button', 'start-run') as HTMLButtonElement;
    startBtn.setAttribute('aria-label', text.controls.startRun);
    applyIcon(startBtn, icons.urlFor(START_RUN_ICON_ID));
    if (!startBtn.classList.contains('has-icon')) startBtn.textContent = '▶';
    startBtn.addEventListener('click', () => engine.startAction(a.id));

    const poster = h('div', 'action-poster');
    const crit = h('div', 'crit-badge');
    crit.hidden = true;
    card.append(button, reward, levelXp.root, sleeveXp.root, squareEl, upgrades, startBtn, poster, crit);
    root.append(card);
    cards.set(a.id, { root: card, poster, button, start: startBtn, title, crit, info, bar, reward, levelXp, sleeveXp, buyables, square });
  }

  for (let i = initial.length; i < ACTION_GRID_SLOTS; i++) root.append(h('div', 'action empty'));

  return {
    root,
    render(actions) {
      for (const a of actions) {
        const card = cards.get(a.id);
        if (!card) continue;
        setText(card.title, a.name);
        card.crit.hidden = a.critText === null;
        setText(card.crit, a.critText ?? '');
        card.root.classList.toggle('crit-hit', a.critText !== null);
        setText(card.info, a.infoText);
        tips.set(card.info, a.unlocked ? () => a.speedTip : null);
        setXpBar(card.levelXp, a.levelBarText, a.levelProgressPercent);
        card.sleeveXp.root.hidden = !a.sleeveShown;
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
    },
  };
}
