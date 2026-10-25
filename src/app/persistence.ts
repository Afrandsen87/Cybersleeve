/**
 * @module app
 *
 * Saving and loading through an injected key/value store.
 */
import { deserializeState, serializeState, type GameConfig, type GameState, type GameStateView } from '../core';
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
    private readonly config: Pick<GameConfig, 'actions' | 'buyables' | 'items' | 'progression' | 'sleeve'>,
    private readonly factory: NumberFactory,
  ) {}

  /** Writes the state. Storage errors (quota, private mode) are swallowed and reported via the return value. */
  save(state: GameStateView): boolean {
    try {
      this.store.setItem(SAVE_KEY, serializeState(state));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Reads and validates the stored save.
   *
   * @remarks
   * A save that exists but cannot be read (corrupt, or written by a newer version) is copied to {@link BACKUP_KEY}
   * before `null` is returned, because the game will start over and its next autosave replaces the main save.
   *
   * @returns the saved state, or `null` if there is none or it is invalid
   */
  load(): GameState | null {
    try {
      const json = this.store.getItem(SAVE_KEY);
      if (json === null) return null;
      const state = deserializeState(json, this.config, this.factory);
      if (state === null) this.store.setItem(BACKUP_KEY, json);
      return state;
    } catch {
      return null;
    }
  }

  /** Deletes the main save (the backup of an unreadable save is kept). Storage errors are swallowed. */
  clear(): void {
    try {
      this.store.removeItem(SAVE_KEY);
    } catch {
      /* nothing to clear */
    }
  }
}
