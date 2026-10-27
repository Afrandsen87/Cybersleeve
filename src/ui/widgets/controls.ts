/**
 * @module ui
 *
 * The buttons around the game: re-sleeve (two clicks), the test aids bar at the top of the page, and the save row (export, import, changelog).
 *
 * @remarks
 * Called by: `ui/dom.ts`. Calls: `ConfirmGate`, `GameCommands`.
 */
import { ConfirmGate } from '../confirmGate';
import { type ChangelogEntry, buildChangelogModal } from './changelogModal';
import { type UiContext, h, setText } from './domKit';
import type { SpeedControl } from '../dom';
import type { ResleeveBuyView } from '../viewModel';

/** What the re-sleeve button needs to draw itself. */
export interface ResleeveButtonState {
  /** A re-sleeve is possible now. */
  readonly canResleeve: boolean;
  /** The button is the Re-sleeve action (the sleeve-levels unlock is owned); otherwise it is that unlock's purchase. */
  readonly shown: boolean;
  /** The purchase to show on the button while it is not yet the Re-sleeve action; `null` hides the button. */
  readonly buy: ResleeveBuyView | null;
}

/** The re-sleeve button with its cancel button. */
export interface ResleeveRow {
  readonly root: HTMLElement;
  /** Draws the button as the purchase of the sleeve-levels unlock, as the Re-sleeve action, or hides it. */
  render(state: ResleeveButtonState): void;
}

/**
 * Builds the re-sleeve row, which sits at the bottom of the Sleeve widget. Until the sleeve-levels unlock is owned the button IS that
 * purchase (one click buys it); then it turns into the Re-sleeve action. Re-sleeving wipes most progress, so it takes two clicks: the
 * first arms the gate, the second confirms.
 *
 * Called by: {@link mountUi}. Calls: `ConfirmGate`, `UiContext.activate`, `GameCommands.resleeve`.
 *
 * @param ctx what the row needs from the screen
 */
export function buildResleeveRow(ctx: UiContext): ResleeveRow {
  const { engine, text, tips } = ctx;
  const gate = new ConfirmGate();
  const button = h('button', 'resleeve') as HTMLButtonElement;
  let buyId: string | null = null; // the purchase the button stands for, while it is not the Re-sleeve action
  button.addEventListener('click', () => {
    if (buyId !== null) ctx.activate(buyId);
    else if (!engine.canResleeve()) gate.cancel();
    else if (gate.request()) engine.resleeve();
    ctx.refresh();
  });
  const cancel = h('button', 'resleeve-cancel', text.resleeve.cancel) as HTMLButtonElement;
  cancel.addEventListener('click', () => {
    gate.cancel();
    ctx.refresh();
  });
  const root = h('div', 'resleeve-row');
  root.append(button, cancel);
  return {
    root,
    render({ canResleeve, shown, buy }) {
      buyId = shown ? null : (buy?.id ?? null);
      root.hidden = !shown && buy === null;
      if (root.hidden || !shown) gate.cancel();
      const armed = gate.isArmed && canResleeve;
      button.classList.toggle('buy', !shown);
      if (!shown) {
        button.disabled = !(buy?.affordable ?? false);
        setText(button, buy?.text ?? '');
        tips.set(button, buy ? () => buy.tip : null);
      } else {
        button.disabled = !canResleeve;
        setText(button, armed ? text.resleeve.armed : text.resleeve.idle);
        tips.set(button, null);
      }
      button.classList.toggle('armed', armed);
      cancel.hidden = !armed;
    },
  };
}

/** The test aids, a bar at the top of the page. */
export interface DebugControls {
  readonly root: HTMLElement;
  /** Updates the fast-forward button. */
  render(): void;
}

/**
 * Builds the test aids: show everything, test drop, double credits, reset save and the fast-forward toggle.
 *
 * Called by: {@link mountUi}. Calls: `GameCommands.dropTestItem`, `doubleCredits`, the reset callback.
 *
 * @param ctx what the controls need from the screen
 * @param page the element the game is mounted in (gets the `reveal-locked` class)
 * @param speed the fast-forward switch
 * @param onResetSave called when the Reset save button is pressed; must wipe the game and the stored save
 */
export function buildDebugControls(ctx: UiContext, page: HTMLElement, speed: SpeedControl, onResetSave: () => void): DebugControls {
  const { engine, text } = ctx;
  const speedBtn = h('button', 'speed-toggle') as HTMLButtonElement;
  speedBtn.title = text.controls.speedToggleTip;
  speedBtn.addEventListener('click', () => speed.toggle());

  // Test aid: shows everything the rules hide. Locked actions show in full through a class on the root; the rest through the
  // selection the view model reads (no game state changes).
  const revealBtn = h('button', 'reveal-locked-toggle', text.controls.revealLocked) as HTMLButtonElement;
  revealBtn.title = text.controls.revealLockedTip;
  revealBtn.addEventListener('click', () => {
    ctx.selection.revealAll = page.classList.toggle('reveal-locked');
    revealBtn.classList.toggle('on', ctx.selection.revealAll);
    ctx.refresh();
  });

  const dropBtn = h('button', 'test-drop', text.controls.testDrop) as HTMLButtonElement;
  dropBtn.title = text.controls.testDropTip;
  dropBtn.addEventListener('click', () => {
    engine.dropTestItem();
    ctx.refresh();
  });

  const doubleBtn = h('button', 'double-credits', text.controls.doubleCredits) as HTMLButtonElement;
  doubleBtn.title = text.controls.doubleCreditsTip;
  doubleBtn.addEventListener('click', () => {
    engine.doubleCredits();
    ctx.refresh();
  });

  const resetBtn = h('button', 'reset-save', text.controls.resetSave) as HTMLButtonElement;
  resetBtn.title = text.controls.resetSaveTip;
  resetBtn.addEventListener('click', () => {
    onResetSave();
    ctx.refresh();
  });
  const root = h('div', 'debug-bar');
  root.append(revealBtn, dropBtn, doubleBtn, resetBtn, speedBtn);
  return {
    root,
    render() {
      setText(speedBtn, text.controls.speedToggle(speed.factor));
      speedBtn.classList.toggle('on', speed.enabled);
    },
  };
}

/**
 * Builds the save row (export and import of the save when given, and the changelog button) and the changelog modal.
 *
 * Called by: {@link mountUi}. Calls: {@link buildChangelogModal}.
 *
 * @param ctx what the row needs from the screen
 * @param saveTransfer export and import of the save as text; the buttons are shown only when given
 * @param changelog the changelog entries, newest first
 * @returns the row, and the modal to append to the page
 */
export function buildSaveRow(
  ctx: UiContext,
  saveTransfer: { exportSave(): void; importSave(): void } | undefined,
  changelog: readonly ChangelogEntry[],
): { row: HTMLElement; modal: HTMLElement } {
  const { text } = ctx;
  const saveRow = h('div', 'save-row');
  if (saveTransfer) {
    const { exportSave, importSave } = saveTransfer;
    const exportBtn = h('button', 'save-export', text.saveTools.export) as HTMLButtonElement;
    exportBtn.title = text.saveTools.exportTip;
    exportBtn.addEventListener('click', () => exportSave());
    const importBtn = h('button', 'save-import', text.saveTools.import) as HTMLButtonElement;
    importBtn.title = text.saveTools.importTip;
    importBtn.addEventListener('click', () => importSave());
    saveRow.append(exportBtn, importBtn);
  }
  const changelogModal = buildChangelogModal(changelog, text);
  const changelogBtn = h('button', 'changelog-open', text.changelog.button) as HTMLButtonElement;
  changelogBtn.title = text.changelog.tip;
  changelogBtn.addEventListener('click', () => changelogModal.open());
  saveRow.append(changelogBtn);
  return { row: saveRow, modal: changelogModal.root };
}
