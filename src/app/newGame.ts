/**
 * @module app
 *
 * The temporary "Reset save" command.
 */

/**
 * Builds the handler behind the temporary "Reset save" button: wipes the running game and the stored save.
 *
 * @remarks
 * The next autosave stores the fresh game. A backup of an unreadable save (`BACKUP_KEY`) is not touched.
 *
 * Called by: `main.ts` (passes it to `ui/dom.ts`). Calls: `GameEngine.newGame`, `SaveGame.clear`.
 *
 * @param engine the game to wipe
 * @param saveGame the stored save to delete
 * @returns a function that performs the reset
 */
export function createNewGameHandler(engine: { newGame(): void }, saveGame: { clear(): void }): () => void {
  return () => {
    engine.newGame();
    saveGame.clear();
  };
}
