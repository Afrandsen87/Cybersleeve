import { describe, expect, it } from 'vitest';
import { createGame } from '../../app/createGame';
import { num, numberFactory } from '../../numbers';
import { findInvariantViolations } from '../../testing/invariants';
import { setCredits, testConfig } from '../../testing/testConfig';
import { augmentXpFactor, createConfig, deserializeState, serializeState, validateConfig, type GameConfig } from '..';

/** The test content with an Augment schematic: item `file`, worth 1% of the action XP each. */
const config: GameConfig = createConfig(testConfig, {
  actions: [...testConfig.actions, { id: 'b', name: 'B', baseDurationMs: 10_000, reward: num(0), xpPerRun: num(1) }],
  items: { ...testConfig.items, augment: { itemId: 'file', xpBonusPerItem: 0.01 } },
});

type Loose = {
  inventory: Record<string, Record<string, number>>;
  actions: Record<string, { xp: unknown; augments: Record<string, number> }>;
};
const loose = (g: { getState(): unknown }): Loose => g.getState() as unknown as Loose;

/** A game holding schematics: `common` and `rare` files. */
const game = (held: { common?: number; rare?: number } = { common: 5, rare: 2 }, c: GameConfig = config) => {
  const g = createGame({ config: c });
  loose(g).inventory = { file: { ...held } };
  return g;
};

describe('applying an Augment schematic', () => {
  it('does nothing without a schematic', () => {
    const g = game({});
    expect(g.augmentAction('a', 'common')).toBe(false);
    expect(g.getState().actions['a']!.augments).toEqual({});
  });

  it('uses up one schematic and counts it on the action, under its rarity', () => {
    const g = game({ common: 5 });
    expect(g.augmentAction('a', 'common')).toBe(true);
    expect(g.getState().actions['a']!.augments).toEqual({ common: 1 });
    expect(g.getState().inventory['file']!['common']).toBe(4);
  });

  it('uses up exactly the rarity chosen: the others are not touched, whatever is held', () => {
    const g = game({ common: 1, rare: 2 });
    expect(g.augmentAction('a', 'rare')).toBe(true);
    expect(g.getState().inventory['file']!['common']).toBe(1);
    expect(g.getState().inventory['file']!['rare']).toBe(1);
    expect(g.augmentAction('a', 'common')).toBe(true);
    expect(g.getState().inventory['file']!['common']).toBe(0);
    expect(g.getState().actions['a']!.augments).toEqual({ common: 1, rare: 1 });
  });

  it('refuses a rarity of which none is held, even when others are, and a rarity that does not exist', () => {
    const g = game({ common: 3 });
    expect(g.augmentAction('a', 'rare')).toBe(false);
    expect(g.augmentAction('a', 'ghost')).toBe(false);
    expect(g.getState().inventory['file']!['common']).toBe(3);
    expect(g.getState().actions['a']!.augments).toEqual({});
  });

  it('stops when the schematics run out', () => {
    const g = game({ common: 1 });
    expect(g.augmentAction('a', 'common')).toBe(true);
    expect(g.augmentAction('a', 'common')).toBe(false);
    expect(g.getState().actions['a']!.augments).toEqual({ common: 1 });
  });

  it('only changes the action it was applied to', () => {
    const g = game();
    g.augmentAction('a', 'common');
    expect(g.getState().actions['b']!.augments).toEqual({});
    expect(g.xpPerRun('b').eq(num(1))).toBe(true);
  });

  it('an unknown action takes nothing', () => {
    const g = game({ common: 3 });
    expect(g.augmentAction('ghost', 'common')).toBe(false);
    expect(g.getState().inventory['file']!['common']).toBe(3);
  });

  it('is not possible in a game whose content has no schematic', () => {
    const g = game({ common: 3 }, testConfig);
    expect(g.augmentAction('a', 'common')).toBe(false);
    expect(g.getState().inventory['file']!['common']).toBe(3);
  });
});

describe('what an augment does to the XP', () => {
  it('within a rarity each one adds 1% of the base XP, additively: 3 augments are +3%, not 1.01 cubed', () => {
    const g = game({ common: 10 });
    expect(g.xpPerRun('a').toNumber()).toBe(1);
    for (let n = 1; n <= 3; n++) {
      g.augmentAction('a', 'common');
      expect(g.xpPerRun('a').toNumber()).toBeCloseTo(1 + 0.01 * n, 12);
    }
  });

  it('the rarities multiply each other: 3 common and 3 rare augments give 1.03 x 1.03', () => {
    const g = game({ common: 3, rare: 3 });
    for (let i = 0; i < 3; i++) {
      g.augmentAction('a', 'common');
      g.augmentAction('a', 'rare');
    }
    expect(g.getState().actions['a']!.augments).toEqual({ common: 3, rare: 3 });
    expect(g.xpPerRun('a').toNumber()).toBeCloseTo(1.03 * 1.03, 12);
    expect(g.xpPerRun('a').toNumber()).toBeGreaterThan(1 + 0.06); // more than six augments of one rarity would give
  });

  it('a rarer augment is worth more than another common one once there are several of the lower rarity', () => {
    const a = game({ common: 10 });
    for (let i = 0; i < 10; i++) a.augmentAction('a', 'common');
    const b = game({ common: 9, rare: 1 });
    for (let i = 0; i < 9; i++) b.augmentAction('a', 'common');
    b.augmentAction('a', 'rare');
    expect(b.xpPerRun('a').toNumber()).toBeGreaterThan(a.xpPerRun('a').toNumber());
  });

  it('a completed run gives the raised XP', () => {
    const g = game({ common: 100 });
    for (let i = 0; i < 100; i++) g.augmentAction('a', 'common'); // +100%: 2 XP a run
    g.startAction('a');
    g.tick(10_000);
    expect(g.getState().actions['a']!.xp.toNumber()).toBe(2);
  });

  it('the levels come sooner: with +100% level 1 (10 XP) arrives after 5 runs instead of 10', () => {
    const runsToLevelOne = (augments: number): number => {
      const g = game({ common: augments });
      for (let i = 0; i < augments; i++) g.augmentAction('a', 'common');
      let runs = 0;
      while (g.actionLevel('a') < 1 && runs < 100) {
        g.startAction('a');
        g.tick(g.currentDurationMs('a') + 1);
        runs++;
      }
      return runs;
    };
    expect(runsToLevelOne(0)).toBe(10);
    expect(runsToLevelOne(100)).toBe(5);
  });

  it('the sleeve level is not affected: the same runs give the same sleeve XP and run counter', () => {
    const sleeveAfter100Runs = (augments: number) => {
      const g = game({ common: augments });
      for (let i = 0; i < augments; i++) g.augmentAction('a', 'common');
      (g.getState() as unknown as { credits: unknown }).credits = num(100);
      g.buy('auto');
      g.startAction('a');
      // enough time for plenty of runs; compare after exactly as many runs as the unaugmented game needs for 100
      let guard = 0;
      while (g.getState().actions['a']!.sleeveXp.isZero() && guard++ < 100_000) g.tick(g.currentDurationMs('a'));
      return g.getState().actions['a']!;
    };
    const plain = sleeveAfter100Runs(0);
    const augmented = sleeveAfter100Runs(50);
    // Both got their first sleeve XP after the same 100 runs, however much action XP they gathered meanwhile.
    expect(plain.sleeveXp.toNumber()).toBe(1);
    expect(augmented.sleeveXp.toNumber()).toBe(1);
    expect(augmented.runsTowardSleeveXp).toBe(plain.runsTowardSleeveXp);
    expect(augmented.xp.toNumber()).toBeGreaterThan(plain.xp.toNumber());
  });

  it('closed-form batches agree with running one at a time', () => {
    const make = () => {
      const g = game({ common: 30 });
      for (let i = 0; i < 30; i++) g.augmentAction('a', 'common');
      (g.getState() as unknown as { credits: unknown }).credits = num(100);
      g.buy('auto');
      g.startAction('a');
      return g;
    };
    const once = make();
    const stepped = make();
    once.tick(10_000 * 700 + 321);
    for (let i = 0; i < 700; i++) stepped.tick(10_000);
    stepped.tick(321);
    expect(once.actionLevel('a')).toBe(stepped.actionLevel('a'));
    expect(once.getState().actions['a']!.xp.toNumber()).toBeCloseTo(stepped.getState().actions['a']!.xp.toNumber(), 6);
  });

  it('keeps the state sound', () => {
    const g = game({ common: 20 });
    for (let i = 0; i < 20; i++) g.augmentAction('a', 'common');
    g.startAction('a');
    g.tick(100_000);
    expect(findInvariantViolations(g.getState(), g.getConfig())).toEqual([]);
  });
});

describe('augments in saves and resets', () => {
  it('re-sleeving and a new game take the augments away (they are not on the carry-over list)', () => {
    const a = game();
    a.augmentAction('a', 'common');
    a.resleeve();
    expect(a.getState().actions['a']!.augments).toEqual({});
    const b = game();
    b.augmentAction('a', 'common');
    b.newGame();
    expect(b.getState().actions['a']!.augments).toEqual({});
  });

  it('survive a save and load', () => {
    const g = game();
    g.augmentAction('a', 'common');
    g.augmentAction('a', 'common');
    const restored = deserializeState(serializeState(g.getState()), config, numberFactory)!;
    expect(restored.actions['a']!.augments).toEqual({ common: 2 });
    expect(restored.actions['b']!.augments).toEqual({});
  });

  it('an older save without them loads with none, and bad values are repaired', () => {
    const g = game();
    g.augmentAction('a', 'common');
    const json = JSON.parse(serializeState(g.getState()));
    const load = () => deserializeState(JSON.stringify(json), config, numberFactory)!.actions['a']!.augments;
    delete json.actions.a.augments;
    expect(load()).toEqual({});
    for (const bad of [3, -3, 'x', null, [1]]) {
      json.actions.a.augments = bad; // not a record (an older save kept one number)
      expect(load()).toEqual({});
    }
    json.actions.a.augments = { common: -1, rare: 2, ghost: 5, epic: 1 };
    expect(load()).toEqual({ rare: 2 });
    json.actions.a.augments = { common: 2.5, rare: 'x' };
    expect(load()).toEqual({});
  });
});

describe('the Augment schematic configuration is validated', () => {
  const problems = (augment: GameConfig['items']['augment']): string =>
    validateConfig(createConfig(config, { items: { ...config.items, augment } })).join('|');

  it('accepts a valid one, and none at all', () => {
    expect(problems({ itemId: 'file', xpBonusPerItem: 0.01 })).toBe('');
    expect(problems(undefined)).toBe('');
  });

  it('rejects an unknown item and a bonus that is not positive', () => {
    expect(problems({ itemId: 'ghost', xpBonusPerItem: 0.01 })).toContain('unknown item "ghost"');
    expect(problems({ itemId: 'file', xpBonusPerItem: 0 })).toContain('xpBonusPerItem must be > 0');
    expect(problems({ itemId: 'file', xpBonusPerItem: -1 })).toContain('xpBonusPerItem must be > 0');
    expect(problems({ itemId: 'file', xpBonusPerItem: Number.NaN })).toContain('xpBonusPerItem must be > 0');
  });
});

it('buying is unaffected: credits are not needed to augment', () => {
  const g = game();
  setCredits(g, num(0));
  expect(g.augmentAction('a', 'common')).toBe(true);
});

describe('items that cannot be paid out', () => {
  const keptConfig: GameConfig = createConfig(config, {
    items: { ...config.items, definitions: [{ id: 'file', name: 'File', sellable: false }] },
  });

  it('cannot be sold, and stay in the inventory', () => {
    const g = game({ common: 3 }, keptConfig);
    expect(g.sellItems('file', 'common', 'all')).toBe(0);
    expect(g.sellItems('file', 'common', 1)).toBe(0);
    expect(g.getState().inventory['file']!['common']).toBe(3);
    expect(g.getState().credits.isZero()).toBe(true);
  });

  it('can still be applied', () => {
    const g = game({ common: 3 }, keptConfig);
    expect(g.augmentAction('a', 'common')).toBe(true);
  });

  it('other items can still be sold', () => {
    const g = game({ common: 3 }, config);
    expect(g.sellItems('file', 'common', 1)).toBe(1);
  });
});

describe('augmentXpFactor', () => {
  it.each([
    [{}, 1],
    [{ common: 0 }, 1],
    [{ common: 3 }, 1.03],
    [{ common: 3, uncommon: 3, rare: 3 }, 1.03 * 1.03 * 1.03],
    [{ common: 10 }, 1.1],
  ])('%j gives %d', (applied, factor) => {
    expect(augmentXpFactor(applied, 0.01)).toBeCloseTo(factor, 12);
  });
});
