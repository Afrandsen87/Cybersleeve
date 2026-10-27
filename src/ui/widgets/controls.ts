/**
 * @module ui
 *
 * The buttons around the game: re-sleeve (two clicks), the test aids in the corner, and the save row (export, import, changelog).
 *
 * @remarks
 * Called by: `ui/dom.ts`. Calls: `ConfirmGate`, `GameCommands`.
 */
import { ConfirmGate } from '../confirmGate';
import { type ChangelogEntry, buildChangelogModal } from './changelogModal';
import { type UiContext, h, setText } from './domKit';
import type { SpeedControl } from '../dom';

/** The re-sleeve button with its cancel button. */
export interface ResleeveRow {
  readonly root: HTMLElement;
  /** Updates the button from whether a re-sleeve is possible now. */
  render(canResleeve: boolean): void;
}

/**
 * Builds the re-sleeve row. Re-sleeving wipes most progress, so it takes two clicks: the first arms the gate, the second confirms.
 *
 * Called by: {@link mountUi}. Calls: `ConfirmGate`, `GameCommands.resleeve`.
 *
 * @param ctx what the row needs from the screen
 */
export function buildResleeveRow(ctx: UiContext): ResleeveRow {
  const { engine, text } = ctx;
  const gate = new ConfirmGate();
  const button = h('button', 'resleeve') as HTMLButtonElement;
  button.addEventListener('click', () => {
    if (!engine.canResleeve()) gate.cancel();
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
    render(canResleeve) {
      const armed = gate.isArmed && canResleeve;
      button.disabled = !canResleeve;
      setText(button, armed ? text.resleeve.armed : text.resleeve.idle);
      button.classList.toggle('armed', armed);
      cancel.hidden = !armed;
    },
  };
}

/** The test aids in the corner. */
export interface DebugControls {
  readonly root: HTMLElement;
  /** Updates the fast-forward button. */
  render(): void;
}

/**
 * Builds the test aids: reveal locked actions, test drop, double credits, reset save and the fast-forward toggle.
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

  // Test aid: shows locked actions in full instead of the access level poster (a class on the root; no game state changes).
  const revealBtn = h('button', 'reveal-locked-toggle', text.controls.revealLocked) as HTMLButtonElement;
  revealBtn.title = text.controls.revealLockedTip;
  revealBtn.addEventListener('click', () => {
    revealBtn.classList.toggle('on', page.classList.toggle('reveal-locked'));
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
  const root = h('div', 'corner-controls');
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
