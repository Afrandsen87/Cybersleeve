import { describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { num, numberFactory } from '../numbers';
import { findInvariantViolations } from '../testing/invariants';
import { seededRandom } from '../testing/random';
import { setCredits, testConfig } from '../testing/testConfig';
import {
  applyCorporationEffect,
  type CorporationActionDefinition,
  createConfig,
  deserializeState,
  type GameConfig,
  serializeState,
  validateConfig,
} from './index';

/** Test content: three rarities of `file`, a purchase that opens the corporation, and one corporation action of 30 seconds. */
const action = (overrides: Partial<CorporationActionDefinition> = {}, chance = 1): CorporationActionDefinition => ({
  id: 'c1',
  name: 'C1',
  baseDurationMs: 30_000,
  effects: [{ kind: 'upgradeRandomItem', itemId: 'file', chance }],
  ...overrides,
});

const contentWith = (actions: readonly CorporationActionDefinition[], extra: Partial<GameConfig> = {}): GameConfig =>
  createConfig(testConfig, {
    buyables: [
      ...testConfig.buyables,
      // a re-sleeve skill: paid in re-sleeve points, so it survives re-sleeving like the real Incorporation
      { id: 'inc', name: 'Inc', description: '', currency: 'resleevePoints', cost: num(1), effect: { kind: 'unlocksCorporation' } },
    ],
    items: {
      rarities: [
        { id: 'common', name: 'Common', sellValue: num(1) },
        { id: 'uncommon', name: 'Uncommon', sellValue: num(10) },
        { id: 'rare', name: 'Rare', sellValue: num(100) },
      ],
      definitions: [{ id: 'file', name: 'File' }],
    },
    corporation: { actions },
    ...extra,
  });

const config = contentWith([action()]);

/** A game with the corporation open (the unlock is owned). */
const openGame = (cfg: GameConfig = config, random = seededRandom(1)) => {
  const g = createGame({ config: cfg, random });
  (g.getState().purchased as Record<string, number>)['inc'] = 1;
  return g;
};

type Loose = { inventory: Record<string, Record<string, number>> };
const stock = (g: { getState(): unknown }, held: Record<string, number>): void => {
  (g.getState() as unknown as Loose).inventory = { file: held };
};
const held = (g: { getState(): unknown }, rarity: string): number => (g.getState() as unknown as Loose).inventory['file']?.[rarity] ?? 0;
/** The run state of action `c1` (its XP is left out: levels are tested in `corporationLevels.test.ts`). */
const run = (g: ReturnType<typeof createGame>) => {
  const { running, progress } = g.getState().corporation.actions['c1']!;
  return { running, progress };
};

describe('the corporation is closed until its unlock is owned', () => {
  it('cannot be started, and nothing runs', () => {
    const g = createGame({ config });
    expect(g.isCorporationUnlocked()).toBe(false);
    expect(g.canStartCorporationAction('c1')).toBe(false);
    expect(g.startCorporationAction('c1')).toBe(false);
    g.tick(60_000);
    expect(run(g)).toEqual({ running: false, progress: 0 });
  });

  it('opens the moment the unlock is bought', () => {
    const g = createGame({ config });
    expect(g.corporationActions().map((a) => a.id)).toEqual(['c1']);
    (g.getState().purchased as Record<string, number>)['inc'] = 1;
    expect(g.isCorporationUnlocked()).toBe(true);
    expect(g.canStartCorporationAction('c1')).toBe(true);
  });

  it('an unknown action cannot be started', () => {
    const g = openGame();
    expect(g.canStartCorporationAction('ghost')).toBe(false);
    expect(g.startCorporationAction('ghost')).toBe(false);
  });

  it('a game without a corporation has no actions and is never unlocked by it', () => {
    const g = createGame({ config: testConfig });
    expect(g.corporationActions()).toEqual([]);
    expect(g.isCorporationUnlocked()).toBe(false);
  });
});

describe('a corporation run', () => {
  it('fills over its own duration and then stops, waiting for the player', () => {
    const g = openGame();
    expect(g.startCorporationAction('c1')).toBe(true);
    expect(run(g).running).toBe(true);
    g.tick(15_000);
    expect(run(g).progress).toBeCloseTo(0.5, 12);
    g.tick(14_999);
    expect(run(g).running).toBe(true);
    g.tick(1);
    expect(run(g)).toEqual({ running: false, progress: 0 });
  });

  it('starting a running action again changes nothing', () => {
    const g = openGame();
    g.startCorporationAction('c1');
    g.tick(10_000);
    const before = run(g).progress;
    expect(g.startCorporationAction('c1')).toBe(true);
    expect(run(g).progress).toBe(before);
  });

  it('one long tick and many short ones give the same result', () => {
    const outcome = (steps: number[]) => {
      const g = openGame(config, seededRandom(7));
      stock(g, { common: 50 });
      g.startCorporationAction('c1');
      for (const ms of steps) g.tick(ms);
      return [run(g).running, held(g, 'common'), held(g, 'uncommon')];
    };
    const once = outcome([30_000]);
    const stepped = outcome(Array.from({ length: 300 }, () => 100));
    expect(stepped).toEqual(once);
    expect(once).toEqual([false, 49, 1]);
  });

  it('is not sped up by interface speed, the speed lever or purchases: 30 seconds stay 30 seconds', () => {
    const fast = contentWith([action()], { global: { speedMultiplier: 1000, creditMultiplier: 1, xpMultiplier: 1, costMultiplier: 1 } });
    const g = openGame(fast);
    setCredits(g, num(1e9));
    g.buy('speed');
    g.startCorporationAction('c1');
    g.tick(29_999);
    expect(run(g).running).toBe(true);
    g.tick(1);
    expect(run(g).running).toBe(false);
  });

  it('keeps the state sound', () => {
    const g = openGame();
    stock(g, { common: 3, uncommon: 2 });
    g.startCorporationAction('c1');
    g.tick(12_345);
    expect(findInvariantViolations(g.getState(), g.getConfig())).toEqual([]);
  });
});

describe('Insider backstabbing style effect: upgradeRandomItem', () => {
  it('moves one file up one rarity and keeps the total', () => {
    const g = openGame();
    stock(g, { common: 5 });
    g.startCorporationAction('c1');
    g.tick(30_000);
    expect([held(g, 'common'), held(g, 'uncommon'), held(g, 'rare')]).toEqual([4, 1, 0]);
  });

  it('a file of the highest rarity is never upgraded, and nothing held does nothing', () => {
    const g = openGame();
    stock(g, { rare: 3 });
    g.startCorporationAction('c1');
    g.tick(30_000);
    expect(held(g, 'rare')).toBe(3);
    stock(g, {});
    g.startCorporationAction('c1');
    g.tick(30_000);
    expect(g.getState().inventory['file'] ?? {}).toEqual({});
  });

  it('only some runs upgrade when the chance is below 1: no upgrade when the draw misses', () => {
    const misses = createGame({ config: contentWith([action({}, 0.01)]), random: () => 0.5 });
    (misses.getState().purchased as Record<string, number>)['inc'] = 1;
    stock(misses, { common: 5 });
    misses.startCorporationAction('c1');
    misses.tick(30_000);
    expect(held(misses, 'common')).toBe(5);
    const hits = createGame({ config: contentWith([action({}, 0.01)]), random: () => 0 });
    (hits.getState().purchased as Record<string, number>)['inc'] = 1;
    stock(hits, { common: 5 });
    hits.startCorporationAction('c1');
    hits.tick(30_000);
    expect(held(hits, 'common')).toBe(4);
  });

  it('the stack is picked by how many it holds: a stack with 9 times the files gives up about 9 times as many', () => {
    const g = openGame();
    stock(g, { common: 900, uncommon: 100 });
    const state = g.getState() as unknown as Loose;
    const ctx = {
      state,
      inventory: (g as unknown as { inventory: never }).inventory,
      random: seededRandom(3),
      rarityIds: ['common', 'uncommon', 'rare'],
    };
    // 1000 runs in one batch with a 10% chance: about 100 upgrades, drawn over the stacks in the proportion 900 : 100
    applyCorporationEffect({ kind: 'upgradeRandomItem', itemId: 'file', chance: 0.1 }, 1000, ctx);
    const total = held(g, 'common') + held(g, 'uncommon') + held(g, 'rare');
    expect(total).toBe(1000);
    expect(held(g, 'rare')).toBeGreaterThan(2); // about 10 of the uncommon files moved up
    expect(held(g, 'rare')).toBeLessThan(25);
    expect(held(g, 'common')).toBeGreaterThan(780); // about 810 commons left (about 90 moved to uncommon)
    expect(held(g, 'common')).toBeLessThan(840);
  });
});

describe('the corporation in saves and re-sleeves', () => {
  it('a run in progress survives a save and load', () => {
    const g = openGame();
    g.startCorporationAction('c1');
    g.tick(12_000);
    const restored = deserializeState(serializeState(g.getState()), config, numberFactory)!;
    expect(restored.corporation.actions['c1']!.running).toBe(true);
    expect(restored.corporation.actions['c1']!.progress).toBeCloseTo(0.4, 12);
  });

  it('a save from before the corporation existed loads with every action idle, and bad values are repaired', () => {
    const g = openGame();
    g.startCorporationAction('c1');
    g.tick(12_000);
    const json = JSON.parse(serializeState(g.getState()));
    const load = () => {
      const { running, progress } = deserializeState(JSON.stringify(json), config, numberFactory)!.corporation.actions['c1']!;
      return { running, progress };
    };
    delete json.corporation;
    expect(load()).toEqual({ running: false, progress: 0 });
    for (const bad of [3, 'x', null, [1], { actions: 5 }, { actions: { c1: 7 } }]) {
      json.corporation = bad;
      expect(load()).toEqual({ running: false, progress: 0 });
    }
    json.corporation = { actions: { c1: { running: true, progress: 1.5 }, ghost: { running: true, progress: 0.2 } } };
    expect(load()).toEqual({ running: true, progress: 0 });
  });

  it('re-sleeving keeps the corporation (it is not the character): its run goes on, and a new game wipes it', () => {
    const g = createGame({ config, random: seededRandom(1) });
    g.resleeve(); // the first re-sleeve gives the re-sleeve point
    expect(g.buy('inc')).toBe('purchased');
    g.startCorporationAction('c1');
    g.tick(12_000);
    expect(g.resleeve()).toBe(true);
    expect(g.isCorporationUnlocked()).toBe(true); // a re-sleeve skill is kept too
    expect(run(g).running).toBe(true);
    expect(run(g).progress).toBeCloseTo(0.4, 12);
    g.newGame();
    expect(run(g)).toEqual({ running: false, progress: 0 });
  });
});

describe('the corporation configuration is validated', () => {
  const problems = (actions: readonly CorporationActionDefinition[]): string => validateConfig(contentWith(actions)).join('|');

  it('accepts a valid one, and none at all', () => {
    expect(problems([action()])).toBe('');
    expect(validateConfig(testConfig)).toEqual([]);
  });

  it('rejects a duplicate id, a duration that is not positive, and an effect that makes no sense', () => {
    expect(problems([action(), action()])).toContain('duplicate corporation action id "c1"');
    expect(problems([action({ baseDurationMs: 0 })])).toContain('baseDurationMs must be > 0');
    expect(problems([action({}, 0)])).toContain('chance must be in (0, 1]');
    expect(problems([action({}, 1.5)])).toContain('chance must be in (0, 1]');
    expect(problems([action({ effects: [{ kind: 'upgradeRandomItem', itemId: 'ghost', chance: 0.5 }] })])).toContain(
      'unknown item "ghost"',
    );
  });

  it('rejects an item without rarities, which has nothing to be upgraded to', () => {
    const cfg = createConfig(config, { items: { ...config.items, definitions: [{ id: 'file', name: 'File', hasRarity: false }] } });
    expect(validateConfig(cfg).join('|')).toContain('needs an item that has rarities');
  });
});
