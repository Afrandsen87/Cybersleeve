/**
 * Loading a save from an older version through `SaveGame`: the migration, the backup under `PRE_MIGRATION_KEY` and when it goes away.
 *
 * Called by: vitest. Calls: `SaveGame`, `MemoryStore`, the real v6 fixtures.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { gameConfig } from '../content/gameConfig';
import { SAVE_VERSION } from '../core';
import { numberFactory } from '../numbers';
import { game } from '../testing/gameKit';
import { BACKUP_KEY, MemoryStore, PRE_MIGRATION_KEY, PREVIOUS_KEY, SAVE_KEY, SaveGame } from './persistence';

const v6 = readFileSync(new URL('../testing/fixtures/saves/v6-after-three-resleeves.json', import.meta.url), 'utf8');
const setup = () => {
  const store = new MemoryStore();
  return { store, save: new SaveGame(store, gameConfig, numberFactory) };
};

describe('SaveGame with a save from an older version', () => {
  it('loads it, and keeps its original text as a backup', () => {
    const { store, save } = setup();
    store.setItem(SAVE_KEY, v6);
    const state = save.load();
    expect(state).not.toBeNull();
    expect(state!.wallet.runs.length).toBe(JSON.parse(v6).runs.length);
    expect(store.getItem(PRE_MIGRATION_KEY)).toBe(v6);
    expect(store.getItem(BACKUP_KEY)).toBeNull();
  });

  it('leaves the stored main save untouched until the next save', () => {
    const { store, save } = setup();
    store.setItem(SAVE_KEY, v6);
    save.load();
    expect(store.getItem(SAVE_KEY)).toBe(v6);
  });

  it('the next successful save writes the current version and removes the backup', () => {
    const { store, save } = setup();
    store.setItem(SAVE_KEY, v6);
    const state = save.load()!;
    expect(save.save(state)).toBe(true);
    expect(JSON.parse(store.getItem(SAVE_KEY)!).version).toBe(SAVE_VERSION);
    expect(store.getItem(PRE_MIGRATION_KEY)).toBeNull();
  });

  it('a failing save keeps the backup', () => {
    const { store, save } = setup();
    store.setItem(SAVE_KEY, v6);
    const state = save.load()!;
    store.setItem = () => {
      throw new Error('quota');
    };
    expect(save.save(state)).toBe(false);
    expect(store.getItem(PRE_MIGRATION_KEY)).toBe(v6);
  });

  it('a current save makes no backup', () => {
    const { store, save } = setup();
    save.save(game().getState());
    save.load();
    expect(store.getItem(PRE_MIGRATION_KEY)).toBeNull();
  });

  it('falls back to a remembered older-version save when the main one becomes unreadable', () => {
    const { store, save } = setup();
    store.setItem(SAVE_KEY, v6);
    save.load();
    expect(store.getItem(PREVIOUS_KEY)).toBe(v6);
    store.setItem(SAVE_KEY, '{broken');
    expect(save.load()).not.toBeNull();
  });

  it('imports a pasted older-version save as the current version', () => {
    const { store, save } = setup();
    expect(save.importText(v6)).toBe(true);
    expect(JSON.parse(store.getItem(SAVE_KEY)!).version).toBe(SAVE_VERSION);
    expect(save.load()).not.toBeNull();
  });

  it('does not touch the backup when the reset button clears the saves', () => {
    const { store, save } = setup();
    store.setItem(SAVE_KEY, v6);
    save.load();
    save.clear();
    expect(store.getItem(SAVE_KEY)).toBeNull();
    expect(store.getItem(PRE_MIGRATION_KEY)).toBe(v6);
  });
});
