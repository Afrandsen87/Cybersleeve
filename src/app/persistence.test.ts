import { game } from '../testing/gameKit';
import { describe, expect, it } from 'vitest';
import { numberFactory, num } from '../numbers';
import { setCredits, setSleeveXp, testConfig } from '../testing/testConfig';
import { createNewGameHandler } from './newGame';
import { BACKUP_KEY, MemoryStore, PREVIOUS_KEY, SAVE_KEY, SaveGame, createBrowserStore, type KeyValueStore } from './persistence';

describe('SaveGame', () => {
  it('saves and loads a game', () => {
    const store = new MemoryStore();
    const save = new SaveGame(store, testConfig, numberFactory);
    const g = game();
    g.startAction('a');
    g.tick(10_000);
    expect(save.save(g.getState())).toBe(true);
    expect(save.load()!.wallet.credits.eq(num(0.5))).toBe(true);
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

  it('falls back to the last known-good save when the main save has become unreadable', () => {
    const store = new MemoryStore();
    const save = new SaveGame(store, testConfig, numberFactory);
    const g = game();
    setCredits(g, num(7));
    save.save(g.getState());
    expect(save.load()!.wallet.credits.eq(num(7))).toBe(true); // a good load remembers the save
    store.setItem(SAVE_KEY, '{broken');
    const restored = save.load();
    expect(restored!.wallet.credits.eq(num(7))).toBe(true);
    expect(store.getItem(BACKUP_KEY)).toBe('{broken'); // the broken one is still kept for inspection
  });

  it('exports a save as text and imports it again; an invalid text changes nothing', () => {
    const store = new MemoryStore();
    const save = new SaveGame(store, testConfig, numberFactory);
    const g = game();
    setCredits(g, num(12));
    const text = save.exportText(g.getState());
    expect(save.importText('not a save')).toBe(false);
    expect(store.getItem(SAVE_KEY)).toBeNull();
    expect(
      save.importText(`  ${text}
`),
    ).toBe(true);
    expect(save.load()!.wallet.credits.eq(num(12))).toBe(true);
  });

  it('clearing the save also forgets the previous known-good one, so a reset game does not come back', () => {
    const store = new MemoryStore();
    const save = new SaveGame(store, testConfig, numberFactory);
    save.save(game().getState());
    save.load();
    expect(store.getItem(PREVIOUS_KEY)).not.toBeNull();
    save.clear();
    expect(store.getItem(SAVE_KEY)).toBeNull();
    expect(store.getItem(PREVIOUS_KEY)).toBeNull();
    expect(save.load()).toBeNull();
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
    expect(s.wallet.credits.isZero()).toBe(true);
    expect(s.sleeve.purchased).toEqual({});
    expect(s.sleeve.actions['a']).toMatchObject({ running: false, progress: 0, runsTowardSleeveXp: 0 });
    expect(s.sleeve.actions['a']!.sleeveXp.isZero()).toBe(true);
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
    expect(g.getState().wallet.credits.eq(num(0.5))).toBe(true);
  });
});
