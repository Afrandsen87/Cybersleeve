/**
 * @module app
 *
 * Moving a save in and out of the game as text: the player copies it out and pastes it back in (a backup, or a move to another browser).
 */
import type { GameStateView } from '../core';

/** What the transfer needs from the page (injected so it can be tested without a browser). */
export interface TransferEnvironment {
  /** Puts text on the clipboard. */
  copy(text: string): Promise<void>;
  /** Asks the player for text; `null` when they cancel. */
  ask(message: string): string | null;
  /** Tells the player something. */
  notify(message: string): void;
  /** Called after a save was imported, to start over from it (reload the page). */
  restart(): void;
}

/** The messages the transfer shows. */
export interface TransferText {
  readonly exported: string;
  readonly exportFailed: string;
  readonly importPrompt: string;
  readonly imported: string;
  readonly importInvalid: string;
}

/** The two things a player can do with a save as text. */
export interface SaveTransfer {
  /** Copies the current save to the clipboard. */
  exportSave(): Promise<void>;
  /** Asks for a pasted save and, if it is valid, stores it and restarts. */
  importSave(): void;
}

/**
 * Builds the export and import actions.
 *
 * Called by: `main.ts`. Calls: `SaveGame.exportText`, `SaveGame.importText`.
 *
 * @param save the stored save
 * @param state where the current state comes from
 * @param env the page
 * @param text the messages
 */
export function createSaveTransfer(
  save: { exportText(state: GameStateView): string; importText(text: string): boolean },
  state: () => GameStateView,
  env: TransferEnvironment,
  text: TransferText,
): SaveTransfer {
  return {
    async exportSave() {
      try {
        await env.copy(save.exportText(state()));
        env.notify(text.exported);
      } catch {
        env.notify(text.exportFailed);
      }
    },
    importSave() {
      const pasted = env.ask(text.importPrompt);
      if (pasted === null || pasted.trim() === '') return;
      if (save.importText(pasted)) {
        env.notify(text.imported);
        env.restart();
      } else {
        env.notify(text.importInvalid);
      }
    },
  };
}
