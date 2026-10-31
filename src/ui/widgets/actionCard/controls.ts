/**
 * @module ui
 *
 * The controls of an action card: the square of labelled LED toggles (AUTO, OC, FOCUS, AUG), or the one button that buys Auto-run.
 *
 * @remarks
 * Called by: `actionCards.ts`. Calls: `domKit.ts`, the tip registry. Every mode (`buy`, `toggle`, `press`, `empty`) comes from the
 * view; the cell only draws it: an LED lit while on, the price of a `buy` cell in the tile's price-strip style, an `empty` cell
 * invisible but keeping its space.
 */
import type { IconSource } from '../../pixelIcon';
import type { TipRegistry } from '../../tooltip';
import type { SquareCellId } from '../../uiText';
import type { ActionSquareView, SquareCellView } from '../../viewModel';
import { applyIcon, h, setText } from '../domKit';

/** The parts of one cell that change while the card lives. */
interface CellParts {
  readonly button: HTMLButtonElement;
  /** The LED in the corner, lit while the toggle is on (or a schematic is applied). */
  readonly led: HTMLElement;
  /** The price strip, shown only while the cell is a purchase. */
  readonly price: HTMLElement;
}

/** Handles to update the square of an action card. */
export interface SquareHandle {
  /** The whole-square button that buys Auto-run (shown while it is not owned). */
  readonly unlock: HTMLButtonElement;
  /** The grid of four cells (shown once Auto-run is owned). */
  readonly grid: HTMLElement;
  /** The four cells, by cell id. */
  readonly cells: ReadonlyMap<SquareCellId, CellParts>;
  /** The add and remove halves laid over the Focus cell (shown only while several slots may sit on one action). */
  readonly halves: { readonly add: HTMLButtonElement; readonly remove: HTMLButtonElement };
  /** The square as the last refresh drew it (a press acts on what the player saw). */
  latest: ActionSquareView;
}

/**
 * Builds the square of an action card: one button that buys Auto-run, and a grid of four cells shown once Auto-run is owned.
 *
 * Called by: `mountActionCards`. Calls: {@link h}, {@link applyIcon}.
 *
 * @param view the square as the first refresh sees it (decides which cells exist)
 * @param icons the icons (the Overclock and Focus cells show the pictures of those names)
 * @param press called with the cell that was pressed, as the last refresh drew it
 * @param pressHalf called with the half of a split Focus cell that was pressed
 * @returns the element to place in the card and the handles to update it
 */
export function buildSquare(
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
  const cells = new Map<SquareCellId, CellParts>();
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
    const button = h('button', `upgrade cell cell-${cell.id}`) as HTMLButtonElement;
    applyIcon(button, icons.urlFor(cell.id));
    button.setAttribute('aria-label', cell.name);
    if (cell.id === 'augment') button.classList.add('augment');
    const led = h('span', 'led-dot cell-led');
    const price = h('span', 'price cell-price');
    price.hidden = true;
    // the letters stay as the fallback for a cell without a picture (the picture hides them)
    button.append(led, h('span', 'cell-symbol', cell.symbol), h('span', 'cell-label', cell.label), price);
    button.addEventListener('click', () => {
      const latest = handle.latest.cells.find((c) => c.id === cell.id);
      if (latest) press(latest);
    });
    grid.append(button);
    cells.set(cell.id, { button, led, price });
  }
  root.append(unlock, grid, halves.add, halves.remove);
  return { root, handle };
}

/**
 * Updates the square of an action card from its view. While Auto-run is locked the whole square is the button that buys it. Once it
 * is owned each cell shows what it is: a purchase (not bought yet, with its price, lit when affordable), a toggle (LED lit when on),
 * the Augment button, or an empty placeholder for a feature the action does not have.
 *
 * Called by: `mountActionCards` (render). Calls: {@link setText}, `TipRegistry.set`.
 *
 * @param square the handles to update
 * @param view the square as the refresh sees it
 * @param tips where the cell tips are registered
 */
export function renderSquare(square: SquareHandle, view: ActionSquareView, tips: TipRegistry): void {
  square.latest = view;
  const auto = view.cells[0];
  square.unlock.hidden = !view.locked;
  square.grid.hidden = view.locked;
  if (view.locked && auto) {
    square.unlock.disabled = !auto.clickable;
    square.unlock.classList.toggle('purchasable', auto.clickable);
    tips.set(square.unlock, () => auto.tip);
    return;
  }
  for (const cell of view.cells) {
    const parts = square.cells.get(cell.id);
    if (!parts) continue;
    const { button } = parts;
    button.disabled = !cell.clickable;
    button.classList.toggle('empty', cell.mode === 'empty');
    button.classList.toggle('owned', cell.mode === 'toggle');
    button.classList.toggle('off', cell.mode === 'toggle' && !cell.on);
    button.classList.toggle('on', cell.mode === 'toggle' && cell.on);
    button.classList.toggle('maxed', cell.mode === 'toggle');
    button.classList.toggle('purchasable', cell.mode === 'buy' && cell.clickable);
    button.classList.toggle('applied', cell.id === 'augment' && cell.on);
    parts.led.classList.toggle('on', cell.on);
    parts.price.hidden = cell.mode !== 'buy';
    setText(parts.price, cell.costText ?? '');
    tips.set(button, cell.mode === 'empty' ? null : () => cell.tip);
    // an owned Focus cell with several slots per action is split into an add and a remove half laid over it
    if (cell.id === 'focus') {
      const split = cell.split;
      square.halves.add.hidden = !split;
      square.halves.remove.hidden = !split;
      button.classList.toggle('split', split !== undefined);
      for (const half of [square.halves.add, square.halves.remove]) half.classList.toggle('on', cell.on);
      if (split) {
        square.halves.add.disabled = !split.canAdd;
        square.halves.remove.disabled = !split.canRemove;
        tips.set(square.halves.add, () => split.addTip);
        tips.set(square.halves.remove, () => split.removeTip);
      }
    }
  }
}
