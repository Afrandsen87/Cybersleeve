import { describe, expect, it } from 'vitest';
import { createConfig } from '../core';
import { numberFactory, num } from '../numbers';
import { setCredits, setSleeveXp, testConfig } from '../testing/testConfig';
import { createGame } from './createGame';
import { createNewGameHandler } from './newGame';
import { BACKUP_KEY, MemoryStore, SAVE_KEY, SaveGame, createBrowserStore, type KeyValueStore } from './persistence';

const game = (overrides = {}) => createGame({ config: createConfig(testConfig, overrides) });

describe('SaveGame', () => {
  it('saves and loads a game', () => {
    const store = new MemoryStore();
    const save = new SaveGame(store, testConfig, numberFactory);
    const g = game();
    g.startAction('a');
    g.tick(10_000);
    expect(save.save(g.getState())).toBe(true);
    expect(save.load()!.credits.eq(num(0.5))).toBe(true);
  });

  it('returns null with no save and does not create a backup', () => {
    const store = new MemoryStore();
    const save = new SaveGame(store, testConfig, numberFactory);
    expect(save.load()).toBeNull();
    expect(store.getItem(BACKUP_KEY)).toBeNull();
  });

  it('keeps a copy of an unreadable save before the game starts over (it would be overwritten by the next autosave)', () => {
    const store = new MemoryStore();
    const save = new SaveGame(store, testConfig, numberFactory);
    store.setItem(SAVE_KEY, '{broken');
    expect(save.load()).toBeNull();
    expect(store.getItem(BACKUP_KEY)).toBe('{broken');

    const future = JSON.stringify({ version: 99, credits: '5' });
    store.setItem(SAVE_KEY, future);
    expect(save.load()).toBeNull();
    expect(store.getItem(BACKUP_KEY)).toBe(future);
  });

  it('a readable save leaves no backup', () => {
    const store = new MemoryStore();
    const save = new SaveGame(store, testConfig, numberFactory);
    save.save(game().getState());
    expect(save.load()).not.toBeNull();
    expect(store.getItem(BACKUP_KEY)).toBeNull();
  });

  it('reports failure when storage throws', () => {
    const failing: KeyValueStore = {
      getItem: () => {
        throw new Error('x');
      },
      setItem: () => {
        throw new Error('x');
      },
      removeItem: () => {
        throw new Error('x');
      },
    };
    const save = new SaveGame(failing, testConfig, numberFactory);
    expect(save.save(game().getState())).toBe(false);
    expect(save.load()).toBeNull();
    expect(() => save.clear()).not.toThrow();
  });

  it('clear deletes the main save but keeps the backup', () => {
    const store = new MemoryStore();
    const save = new SaveGame(store, testConfig, numberFactory);
    store.setItem(BACKUP_KEY, 'old');
    save.save(game().getState());
    save.clear();
    expect(store.getItem(SAVE_KEY)).toBeNull();
    expect(store.getItem(BACKUP_KEY)).toBe('old');
  });
});

describe('createBrowserStore', () => {
  it('falls back to an in-memory store when localStorage is unavailable (as in this test environment)', () => {
    const store = createBrowserStore();
    store.setItem('k', 'v');
    expect(store.getItem('k')).toBe('v');
    store.removeItem('k');
    expect(store.getItem('k')).toBeNull();
  });
});

describe('createNewGameHandler (the temporary "Reset save" button)', () => {
  it('wipes the game, including sleeve XP, and the stored save', () => {
    const store = new MemoryStore();
    const save = new SaveGame(store, testConfig, numberFactory);
    const g = game();
    setCredits(g, num(500));
    setSleeveXp(g, num(12));
    g.buy('dual');
    g.startAction('a');
    g.tick(3_000);
    save.save(g.getState());

    createNewGameHandler(g, save)();

    const s = g.getState();
    expect(s.credits.isZero()).toBe(true);
    expect(s.purchased).toEqual({});
    expect(s.actions['a']).toMatchObject({ running: false, progress: 0, runsTowardSleeveXp: 0 });
    expect(s.actions['a']!.sleeveXp.isZero()).toBe(true);
    expect(store.getItem(SAVE_KEY)).toBeNull();
    expect(g.sleeveLevel('a')).toBe(0);
  });

  it('the engine keeps working normally after a reset', () => {
    const g = game();
    g.startAction('a');
    g.tick(4_000);
    g.newGame();
    g.startAction('a');
    g.tick(10_000);
    expect(g.getState().credits.eq(num(0.5))).toBe(true);
  });
});
