/**
 * @module ui
 *
 * The re-sleeve box at the bottom of the Sleeve widget: title with a status light, a progress bar while a requirement is open, the lines
 * under it, and one full-width button. It is the Unlock resleeving purchase until that is owned, then the Re-sleeve action, which takes
 * two clicks: the first arms the confirm gate, the second confirms.
 *
 * @remarks
 * Armed is drawn by a second element, absolutely placed on the bottom of the row, so it grows upwards over the panel and the buttons you
 * click stay where they are: CONFIRM sits exactly where RE-SLEEVE was. The box underneath stays in the flow (hidden) to hold the height.
 * Everything is built once; `render` flips classes, text and the bar's `transform`.
 *
 * Called by: `ui/dom.ts`. Calls: `ConfirmGate`, `UiContext.activate`, `GameCommands.resleeve`.
 */
import { ConfirmGate } from '../confirmGate';
import type { LedgerLineView, ResleeveBoxView } from '../view/resleeveBox';
import { type UiContext, h, setClass, setHidden, setText } from './domKit';

/** What the row needs to draw itself. */
export interface ResleeveRowState {
  /** The box shows at all (the Sleeve levels unlock is owned). */
  readonly shown: boolean;
  /** A re-sleeve is possible now (only then can the armed state show). */
  readonly canResleeve: boolean;
  /** What the box says in each of its own states. */
  readonly box: ResleeveBoxView;
  /** The title of the box (`SleeveView.resleeveTitle`). */
  readonly title: string;
}

/** The re-sleeve box. */
export interface ResleeveRow {
  readonly root: HTMLElement;
  /** Draws the box as locked, charging, ready or armed, or hides it. */
  render(state: ResleeveRowState): void;
}

/** A title row: the title on the left, the status light on the right. */
function titleRow(): { row: HTMLElement; title: HTMLElement; status: HTMLElement } {
  const row = h('div', 'resleeve-title');
  const title = h('span');
  const status = h('span', 'resleeve-status');
  row.append(title, status);
  return { row, title, status };
}

/**
 * Builds the re-sleeve row.
 *
 * Called by: {@link mountUi}. Calls: `ConfirmGate`, `UiContext.activate`, `GameCommands.resleeve`.
 *
 * @param ctx what the row needs from the screen
 */
export function buildResleeveRow(ctx: UiContext): ResleeveRow {
  const { engine, text, tips } = ctx;
  const gate = new ConfirmGate();
  let shownFill: number | null = null; // the bar's last scale, so an idle frame writes nothing
  let buyId: string | null = null; // the purchase the button stands for, while it is not the Re-sleeve action
  const press = () => {
    if (buyId !== null) ctx.activate(buyId);
    else if (!engine.canResleeve()) gate.cancel();
    else if (gate.request()) engine.resleeve();
    ctx.refresh();
  };

  // the box in the flow
  const box = h('div', 'resleeve-box');
  const head = titleRow();
  const bar = h('div', 'resleeve-bar');
  const fill = h('i', 'resleeve-bar-fill');
  bar.append(fill);
  const lines = h('div', 'resleeve-lines');
  const lineEls: HTMLElement[] = [];
  const button = h('button', 'resleeve') as HTMLButtonElement;
  const buttonText = h('span');
  const price = h('span', 'resleeve-price');
  button.append(buttonText, price);
  button.addEventListener('click', press);
  box.append(head.row, bar, lines, button);

  // the armed box, over the same place
  const armedBox = h('div', 'resleeve-box resleeve-armed');
  const armedHead = titleRow();
  setText(armedHead.status, text.resleeve.status.armed);
  const ledger = h('div', 'resleeve-ledger');
  const ledgerEls: { key: HTMLElement; value: HTMLElement }[] = [];
  const buttons = h('div', 'resleeve-buttons');
  const confirm = h('button', 'resleeve-confirm', text.resleeve.confirm) as HTMLButtonElement;
  confirm.addEventListener('click', press);
  const cancel = h('button', 'resleeve-cancel', text.resleeve.cancel) as HTMLButtonElement;
  cancel.addEventListener('click', () => {
    gate.cancel();
    ctx.refresh();
  });
  buttons.append(confirm, cancel);
  armedBox.append(armedHead.row, ledger, buttons);

  const root = h('div', 'resleeve-row');
  root.append(box, armedBox);

  /** Sets the ledger rows, adding row elements the first time a row is needed. */
  function renderLedger(rows: readonly LedgerLineView[]): void {
    while (ledgerEls.length < rows.length) {
      const key = h('span', 'resleeve-ledger-key');
      const value = h('span');
      ledger.append(key, value);
      ledgerEls.push({ key, value });
    }
    rows.forEach((r, i) => {
      const el = ledgerEls[i];
      if (!el) return;
      if (el.key.dataset.tone !== r.tone) el.key.dataset.tone = r.tone;
      setText(el.key, r.label);
      setText(el.value, r.text);
    });
  }

  return {
    root,
    render({ shown, canResleeve, box: view, title }) {
      setHidden(root, !shown);
      buyId = view.buyId;
      if (root.hidden || view.buyId !== null) gate.cancel();
      const armed = gate.isArmed && canResleeve;
      if (!canResleeve) gate.cancel();
      setText(head.title, title);
      setText(armedHead.title, title);
      setClass(root, 'armed', armed);
      setHidden(armedBox, !armed);
      if (box.dataset.kind !== view.kind) box.dataset.kind = view.kind;
      setText(head.status, view.status);
      setHidden(bar, view.fill === null);
      if (view.fill !== null && view.fill !== shownFill) {
        shownFill = view.fill;
        fill.style.transform = `scaleX(${view.fill})`;
      }
      while (lineEls.length < view.lines.length) {
        const el = h('div', 'resleeve-line');
        lines.append(el);
        lineEls.push(el);
      }
      lineEls.forEach((el, i) => {
        const line = view.lines[i];
        setHidden(el, line === undefined);
        if (line !== undefined) setText(el, line);
      });
      setClass(button, 'buy', view.buyId !== null);
      if (button.disabled === view.enabled) button.disabled = !view.enabled;
      setText(buttonText, view.buttonText);
      setText(price, view.priceText ?? '');
      setHidden(price, view.priceText === null);
      const tip = view.tip;
      tips.set(button, tip === null ? null : () => tip);
      if (armed) renderLedger(view.ledger);
    },
  };
}
