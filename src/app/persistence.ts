/**
 * @module app
 *
 * Saving and loading through an injected key/value store.
 */
import { deserializeState, migrateSave, serializeState, type GameConfig, type GameState, type GameStateView } from '../core';
import type { NumberFactory } from '../numbers';

/** Minimal storage contract (a subset of the browser `Storage`). Lets tests use an in-memory fake. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Storage key of the main save. */
export const SAVE_KEY = 'cybersleeve.save';
/** Storage key under which an unreadable save is preserved before the game starts over. */
export const BACKUP_KEY = 'cybersleeve.save.unreadable';
/**
 * Storage key under which the text of a save from an older version is kept when it is migrated. It is removed by the next successful save, which
 * replaces the main save with the current version; until then it is the way back (the migration never touches it).
 */
export const PRE_MIGRATION_KEY = 'cybersleeve.save.premigration';
/** Storage key of the last save that was read successfully at the start of a session (what the game falls back to when the main save is unreadable). */
export const PREVIOUS_KEY = 'cybersleeve.save.previous';

/**
 * A {@link KeyValueStore} that lives in memory only. Used when the browser refuses access to `localStorage`
 * (the game still runs, it just cannot keep progress), and as a fake in tests.
 *
 * Called by: {@link createBrowserStore}, tests.
 */
export class MemoryStore implements KeyValueStore {
  private readonly data = new Map<string, string>();

  /** Returns the stored value, or null when the key is absent. */
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  /** Stores a value under a key, replacing any previous one. */
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }

  /** Deletes a key (no effect when absent). */
  removeItem(key: string): void {
    this.data.delete(key);
  }
}

/**
 * The best store the browser offers: `localStorage` when it is usable, otherwise a {@link MemoryStore}.
 * Touching `localStorage` can throw (blocked site data), which must not stop the game from starting.
 *
 * Called by: `main.ts`.
 */
export function createBrowserStore(): KeyValueStore {
  try {
    const probe = `${SAVE_KEY}.probe`;
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    return new MemoryStore();
  }
}

/**
 * Persists game state.
 *
 * Called by: `main.ts`.
 * Calls: `serializeState`, `deserializeState`.
 */
export class SaveGame {
  /**
   * Creates a save-game handler.
   *
   * @param store where saves are kept (e.g. `localStorage`)
   * @param config game content (needed to validate loaded saves)
   * @param factory number factory
   */
  constructor(
    private readonly store: KeyValueStore,
    private readonly config: Pick<GameConfig, 'actions' | 'buyables' | 'focus' | 'items' | 'progression' | 'sleeve'>,
    private readonly factory: NumberFactory,
  ) {}

  /**
   * Writes the state. Storage errors (quota, private mode) are swallowed and reported via the return value. A successful write also drops the
   * pre-migration backup: the main save is now the current version.
   */
  save(state: GameStateView): boolean {
    try {
      this.store.setItem(SAVE_KEY, serializeState(state));
      this.store.removeItem(PRE_MIGRATION_KEY);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Reads and validates the stored save.
   *
   * @remarks
   * A save that is read successfully is also copied to {@link PREVIOUS_KEY}: the last known-good save of a session start. A save
   * that exists but cannot be read (corrupt, or written by a newer version) is copied to {@link BACKUP_KEY}, and the game falls back
   * to the previous known-good save if there is one, because otherwise it would start over and the next autosave would replace the
   * main save.
   *
   * A save of an older version is migrated in memory first (`migrateSave`); its original text is kept under {@link PRE_MIGRATION_KEY} until the
   * next successful {@link save}, and the stored main save stays as it was until then.
   *
   * @returns the saved state, or `null` if there is none or nothing usable is stored
   */
  load(): GameState | null {
    try {
      const json = this.store.getItem(SAVE_KEY);
      if (json === null) return null;
      const state = this.read(json);
      if (state !== null) {
        this.store.setItem(PREVIOUS_KEY, json);
        if (migrateSave(json) !== json) this.store.setItem(PRE_MIGRATION_KEY, json);
        return state;
      }
      this.store.setItem(BACKUP_KEY, json);
      const previous = this.store.getItem(PREVIOUS_KEY);
      return previous === null ? null : this.read(previous);
    } catch {
      return null;
    }
  }

  /**
   * The save as text the player can copy.
   * @param state the state to export
   */
  exportText(state: GameStateView): string {
    return serializeState(state);
  }

  /**
   * Replaces the main save with text the player pasted, if it is a valid save of this version (anything else changes nothing).
   * The running game is not touched: the caller reloads so the imported save is what gets loaded.
   *
   * @param text the pasted save
   * @returns true when the save was valid and has been stored
   */
  importText(text: string): boolean {
    try {
      const trimmed = text.trim();
      if (this.read(trimmed) === null) return false;
      this.store.setItem(SAVE_KEY, migrateSave(trimmed));
      return true;
    } catch {
      return false;
    }
  }

  /** Reads saved text of any version this build can migrate. */
  private read(json: string): GameState | null {
    return deserializeState(migrateSave(json), this.config, this.factory);
  }

  /** Deletes the main save and the previous known-good one (the backups of an unreadable save and of a pre-migration save are kept). Storage errors are swallowed. */
  clear(): void {
    try {
      this.store.removeItem(SAVE_KEY);
      this.store.removeItem(PREVIOUS_KEY);
    } catch {
      /* nothing to clear */
    }
  }
}
