/**
 * @module ui
 *
 * The action cards, drawn as process windows: title bar with a state LED, run bar in the action's colour, stat grid, level bars,
 * the square of LED toggles and the MODS row. This file is the facade: it builds and refreshes the cards; each part lives in
 * `actionCard/`.
 *
 * @remarks
 * Called by: `ui/dom.ts`. Calls: `actionCard/titleBar.ts`, `stats.ts`, `controls.ts`, `mods.ts`, `domKit.ts`. The action's colour is
 * CSS only (`data-action` on the card, see `styles/process.css`); no widget knows a colour.
 */
import { START_RUN_ICON_ID } from '../pixelIcon';
import type { ActionView } from '../viewModel';
import { type UiContext, type XpBar, applyIcon, h, setFill, setText, setXpBar, xpBar } from './domKit';
import { buildSquare, renderSquare, type SquareHandle } from './actionCard/controls';
import { buildModsRow, renderModsRow, type ModsRow } from './actionCard/mods';
import { buildStatGrid, renderStatGrid, type StatGrid } from './actionCard/stats';
import { buildTitleBar, renderTitleBar, type TitleBar } from './actionCard/titleBar';

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
  readonly titleBar: TitleBar;
  readonly stats: StatGrid;
  readonly bar: HTMLElement;
  /** The runs per second written on the bar (empty unless the runs are too short to animate and Auto-run is on). */
  readonly barLabel: HTMLElement;
  readonly levelXp: XpBar;
  readonly sleeveXp: XpBar;
  /** The action's own purchases under the MODS label. */
  readonly mods: ModsRow;
  /** The square beside the bars: the Auto-run unlock, or the four cells once Auto-run is owned. */
  readonly square: SquareHandle;
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
 * Called by: {@link mountUi}. Calls: `buildTitleBar`, `buildStatGrid`, `buildSquare`, `buildModsRow`, `GameCommands.startAction`,
 * `activateBuyable`, `toggleOverclock`, `toggleFocus`, `augmentAction`.
 *
 * @param ctx what the widget needs from the screen
 * @param initial the actions as the first refresh sees them (decides which cards exist)
 */
export function mountActionCards(ctx: UiContext, initial: readonly ActionView[]): ActionCards {
  const { engine, text, icons, tips } = ctx;
  const root = h('section', 'actions');
  const cards = new Map<string, ActionCard>();
  for (const a of initial) {
    const card = h('div', 'action process');
    card.dataset.action = a.id;
    const button = h('button', 'action-main') as HTMLButtonElement;
    const titleBar = buildTitleBar(a.id, icons);
    const bar = h('div', 'bar-fill');
    const track = h('div', 'bar');
    const barLabel = h('div', 'bar-label');
    track.append(bar, barLabel);
    button.append(titleBar.root, track);
    button.addEventListener('click', () => engine.startAction(a.id));

    const stats = buildStatGrid(text);
    const levelXp = xpBar();
    const sleeveXp = xpBar();
    levelXp.root.classList.add('xp-level');
    sleeveXp.root.classList.add('xp-sleeve');

    const mods = buildModsRow(
      a.buyables.filter((b) => !b.inSquare),
      ctx.activate,
      icons,
      text,
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
    card.append(button, stats.root, levelXp.root, sleeveXp.root, squareEl, mods.root, startBtn, poster);
    root.append(card);
    cards.set(a.id, { root: card, poster, button, start: startBtn, titleBar, stats, bar, barLabel, levelXp, sleeveXp, mods, square });
  }

  for (let i = initial.length; i < ACTION_GRID_SLOTS; i++) root.append(h('div', 'action empty'));

  return {
    root,
    render(actions) {
      for (const a of actions) {
        const card = cards.get(a.id);
        if (!card) continue;
        renderTitleBar(card.titleBar, a, text);
        renderStatGrid(card.stats, a, text, tips);
        setXpBar(card.levelXp, a.levelBarText, a.levelProgressPercent);
        tips.set(card.levelXp.root, () => a.levelXpTip);
        card.sleeveXp.root.hidden = !a.sleeveShown;
        setXpBar(card.sleeveXp, a.sleeveBarText, a.sleeve.progressPercent);
        tips.set(card.sleeveXp.root, a.sleeveShown ? () => a.sleeveXpTip : null);
        card.button.disabled = !a.startable;
        card.start.disabled = !a.startable || a.running; // greyed out until the run is over
        card.root.classList.toggle('locked', !a.unlocked);
        setText(card.poster, a.posterText);
        setFill(card.bar, a.progressPercent);
        setText(card.barLabel, a.barText ?? '');
        card.bar.classList.toggle('streaming', a.barText !== null);
        card.root.classList.toggle('running', a.running);
        renderModsRow(card.mods, a.buyables, tips);
        renderSquare(card.square, a.square, tips);
      }
    },
  };
}
