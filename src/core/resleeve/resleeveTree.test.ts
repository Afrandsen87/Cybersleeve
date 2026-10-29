import { describe, expect, it } from 'vitest';
import { createGame } from '../../app/createGame';
import { num, numberFactory } from '../../numbers';
import { testConfig } from '../../testing/testConfig';
import { findInvariantViolations } from '../../testing/invariants';
import {
  createConfig,
  deserializeState,
  serializeState,
  synthCreditsPerSecond,
  validateConfig,
  type BuyableDefinition,
  type GameConfig,
} from '..';

/** A re-sleeve skill: one point, no action. */
const resleeveSkill = (id: string, effect: BuyableDefinition['effect'], requires?: string[]): BuyableDefinition => ({
  id,
  name: id,
  description: '',
  currency: 'resleevePoints',
  cost: num(1),
  effect,
  ...(requires ? { parents: requires } : {}),
});

const treeBuyables: BuyableDefinition[] = [
  resleeveSkill('eu', { kind: 'actionXpReductionFromSleeveLevel', remainingPerOrder: 0.5, maxReduction: 0.999 }),
  resleeveSkill('syn', { kind: 'synthSleeves' }, ['eu']),
  resleeveSkill('inc', { kind: 'placeholder' }, ['eu']),
  { id: 'flat', name: 'Flat', description: '', cost: num(1), effect: { kind: 'actionXpReduction', amount: 0.2 } },
  { id: 'cheap', name: 'Cheap', description: '', cost: num(1), effect: { kind: 'accessLevel', amount: 1 } },
];

const config: GameConfig = createConfig(testConfig, { buyables: [...testConfig.buyables, ...treeBuyables] });

type Loose = {
  credits: unknown;
  network: unknown;
  heat: number;
  actions: Record<string, { xp: unknown; sleeveXp: unknown }>;
};
const mutable = (g: { getState(): unknown }): Loose => g.getState() as unknown as Loose;

const newGame = (c: GameConfig = config): ReturnType<typeof createGame> => createGame({ config: c });

/** Gives the sleeve `nodes` network nodes (credits per second = nodes x 0.05 with no heat). */
const withNodes = (g: ReturnType<typeof createGame>, nodes: number): void => {
  mutable(g).network = num(nodes);
};
/** Gives action `a` enough XP to be at least the level `level` (thresholds in the test config: 10, 110, 1110, 11110 ...). */
const XP_FOR_LEVEL = [0, 10, 110, 1110, 11_110];
const atLevel = (g: ReturnType<typeof createGame>, level: number): void => {
  mutable(g).actions['a']!.xp = num(XP_FOR_LEVEL[level]!);
  expect(g.actionLevel('a')).toBe(level);
};

describe('re-sleeve points', () => {
  it('a new game has none, and every re-sleeve gives `pointsPerResleeve`', () => {
    const g = newGame();
    expect(g.resleevePoints()).toBe(0);
    g.resleeve();
    expect(g.resleevePoints()).toBe(1);
    g.resleeve();
    expect(g.resleevePoints()).toBe(2);
    const triple = newGame(createConfig(config, { resleeve: { pointsPerResleeve: 3 } }));
    triple.resleeve();
    expect(triple.resleevePoints()).toBe(3);
  });

  it('a skill costs a point, and buying it leaves the rest; points are never lost by re-sleeving', () => {
    const g = newGame();
    g.resleeve();
    g.resleeve();
    expect(g.buy('eu')).toBe('purchased');
    expect(g.resleevePoints()).toBe(1);
    g.resleeve();
    expect(g.resleevePoints()).toBe(2); // earned 3, spent 1
  });

  it('cannot buy without a point, and the tree is bought from the top', () => {
    const g = newGame();
    expect(g.canBuy('eu')).toBe(false);
    expect(g.buy('eu')).toBe('cannot-afford');
    g.resleeve();
    expect(g.isBuyableAvailable('syn')).toBe(false);
    expect(g.buy('syn')).toBe('locked');
    expect(g.buy('eu')).toBe('purchased');
    expect(g.isBuyableAvailable('syn')).toBe(true);
    expect(g.isBuyableAvailable('inc')).toBe(true);
  });

  it('skill points and re-sleeve points are separate: each pays only its own skills', () => {
    const g = newGame();
    g.resleeve();
    expect(g.skillPoints()).toBe(0);
    expect(g.resleevePoints()).toBe(1);
    atLevel(g, 1); // the first skill point
    expect(g.skillPoints()).toBe(1);
    expect(g.resleevePoints()).toBe(1);
  });
});

describe('what a re-sleeve keeps', () => {
  it('keeps the re-sleeve skills; the rest of what was bought is gone', () => {
    const g = newGame();
    g.resleeve();
    g.buy('eu');
    mutable(g).credits = num(100);
    g.buy('cheap');
    expect(g.ownedCount('cheap')).toBe(1);
    g.resleeve();
    expect(g.ownedCount('eu')).toBe(1);
    expect(g.ownedCount('cheap')).toBe(0);
  });

  it('keeps the record of runs and the synthetic sleeves, and a new game clears them with the skills', () => {
    const g = newGame();
    g.resleeve();
    g.buy('eu');
    g.resleeve();
    g.buy('syn');
    g.resleeve();
    expect(g.getState().runs).toHaveLength(3);
    expect(g.getState().synths).toHaveLength(2);
    g.newGame();
    expect(g.getState().runs).toEqual([]);
    expect(g.getState().synths).toEqual([]);
    expect(g.ownedCount('eu')).toBe(0);
    expect(g.resleevePoints()).toBe(0);
  });
});

describe('the record of finished runs', () => {
  it('writes every run down, whatever skills are owned', () => {
    const g = newGame();
    withNodes(g, 1000);
    atLevel(g, 3);
    g.resleeve();
    const [run] = g.getState().runs;
    expect(g.getState().runs).toHaveLength(1);
    expect(run!.creditsPerSecond.toNumber()).toBeCloseTo(50, 9); // 1000 nodes x 0.05
    expect(run!.actionLevelsTotal).toBe(3);
    g.resleeve();
    expect(g.getState().runs).toHaveLength(2);
    expect(g.getState().runs[1]!.creditsPerSecond.isZero()).toBe(true); // an empty life earned nothing
    expect(g.getState().runs[1]!.actionLevelsTotal).toBe(0);
  });

  it('writes down the income after the heat tax', () => {
    const g = newGame();
    withNodes(g, 1000);
    mutable(g).heat = 40; // 40% tax
    g.resleeve();
    expect(g.getState().runs[0]!.creditsPerSecond.toNumber()).toBeCloseTo(30, 9);
  });

  it("writes down the sleeve's own income only: synthetic income is not part of it, so nothing compounds", () => {
    const g = newGame();
    withNodes(g, 1000);
    atLevel(g, 2);
    g.resleeve(); // run 0: 50 per second
    g.buy('eu');
    g.resleeve(); // run 1: an empty life
    g.buy('syn'); // a synthetic sleeve copies run 1 (nothing), the skill came too late for run 0
    g.resleeve();
    withNodes(g, 0);
    g.resleeve();
    expect(g.getState().runs.map((r) => r.creditsPerSecond.toNumber())).toEqual([50, 0, 0, 0]);
  });
});

describe('synthetic sleeves', () => {
  it('there are none without the skill, however many times the player re-sleeves', () => {
    const g = newGame();
    for (let i = 0; i < 4; i++) g.resleeve();
    expect(g.getState().runs).toHaveLength(4);
    expect(g.getState().synths).toEqual([]);
    expect(g.synthCount()).toBe(0);
    expect(g.synthSleevesUnlocked()).toBe(false);
  });

  it('buying the skill gives one at once, copied from the last finished run; earlier runs are never copied', () => {
    const g = newGame();
    g.resleeve(); // run 0
    g.buy('eu');
    g.resleeve(); // run 1
    expect(g.synthCount()).toBe(0);
    g.buy('syn');
    expect(g.synthCount()).toBe(1);
    expect(g.getState().synths).toEqual([{ runIndex: 1 }]);
    expect(g.synthSleevesUnlocked()).toBe(true);
  });

  it('every re-sleeve after that gives one more, copied from the run that just ended', () => {
    const g = newGame();
    g.resleeve();
    g.buy('eu');
    g.resleeve();
    g.buy('syn');
    g.resleeve(); // run 2
    g.resleeve(); // run 3
    expect(g.getState().synths).toEqual([{ runIndex: 1 }, { runIndex: 2 }, { runIndex: 3 }]);
  });

  it('earns the final income of its run scaled by the levels reached so far, and stays at that amount once it has caught up', () => {
    const g = newGame();
    g.resleeve(); // run 0
    g.buy('eu');
    g.resleeve(); // run 1 (empty)
    g.buy('syn'); // a sleeve on run 1, which earned nothing
    withNodes(g, 1000);
    atLevel(g, 4);
    g.resleeve(); // run 2: 50 per second at a level total of 4, and a sleeve to copy it
    expect(g.getState().runs[2]!.actionLevelsTotal).toBe(4);
    expect(g.getState().synths).toEqual([{ runIndex: 1 }, { runIndex: 2 }]);
    const incomeAt = (level: number): number => {
      atLevel(g, level);
      return g.synthCreditsPerSecond().toNumber();
    };
    expect(incomeAt(1)).toBeCloseTo(12.5, 9);
    expect(incomeAt(2)).toBeCloseTo(25, 9);
    expect(incomeAt(3)).toBeCloseTo(37.5, 9);
    expect(incomeAt(4)).toBeCloseTo(50, 9);
    mutable(g).actions['a']!.xp = num('1e9'); // far past the recorded levels
    expect(g.actionLevel('a')).toBeGreaterThan(4);
    expect(g.synthCreditsPerSecond().toNumber()).toBeCloseTo(50, 9); // it does not keep growing
  });

  it('is paid into credits without the heat tax, on top of the network income', () => {
    const g = newGame();
    g.resleeve();
    g.buy('eu');
    g.resleeve();
    g.buy('syn');
    withNodes(g, 2000);
    atLevel(g, 1);
    g.resleeve(); // synthetic sleeves for the runs so far; the last one earned 100 per second at level 1
    atLevel(g, 1); // caught up at once
    withNodes(g, 0);
    mutable(g).heat = 50; // a heat tax would cut the network income in half; the synthetic income skips it
    mutable(g).credits = num(0);
    const perSecond = g.synthCreditsPerSecond().toNumber();
    expect(perSecond).toBeCloseTo(100, 9);
    g.tick(1_000);
    expect(g.getState().credits.toNumber()).toBeCloseTo(perSecond, 6);
  });

  it('pays the network income and the synthetic income together', () => {
    const g = newGame();
    g.resleeve();
    g.buy('eu');
    g.resleeve();
    g.buy('syn');
    withNodes(g, 1000);
    atLevel(g, 1);
    g.resleeve();
    atLevel(g, 1);
    withNodes(g, 400); // 20 per second of its own
    mutable(g).credits = num(0);
    const synthetic = g.synthCreditsPerSecond().toNumber();
    expect(synthetic).toBeCloseTo(50, 9);
    g.tick(1_000);
    expect(g.getState().credits.toNumber()).toBeCloseTo(20 + synthetic, 6);
  });

  it('each sleeve uses the numbers of the run it belongs to, and the total is their sum', () => {
    const g = newGame();
    g.resleeve();
    g.buy('eu');
    g.resleeve();
    g.buy('syn');
    const state = g.getState() as unknown as {
      runs: { creditsPerSecond: unknown; actionLevelsTotal: number }[];
      synths: { runIndex: number }[];
    };
    state.runs.push({ creditsPerSecond: num(100), actionLevelsTotal: 4 }, { creditsPerSecond: num(30), actionLevelsTotal: 2 });
    state.synths.push({ runIndex: 2 }, { runIndex: 3 });
    atLevel(g, 1); // a quarter of the way to run 2, half of the way to run 3
    expect(g.synthCreditsPerSecond().toNumber()).toBeCloseTo(100 * 0.25 + 30 * 0.5, 9);
    atLevel(g, 3);
    expect(g.synthCreditsPerSecond().toNumber()).toBeCloseTo(100 * 0.75 + 30, 9); // the second has caught up and stays at 30
    expect(g.synthCount()).toBe(3);
  });

  it('a synthetic sleeve whose run had no action levels pays in full at once', () => {
    expect(synthCreditsPerSecond({ creditsPerSecond: num(7), actionLevelsTotal: 0 }, 0, numberFactory).toNumber()).toBe(7);
  });
});

describe('synthCreditsPerSecond', () => {
  const record = { creditsPerSecond: num(80), actionLevelsTotal: 8 };
  it.each([
    [0, 0],
    [1, 10],
    [4, 40],
    [8, 80],
    [9, 80],
    [1e9, 80],
  ])('at %d levels of a run of 8 levels and 80 per second it earns %d', (levels, expected) => {
    expect(synthCreditsPerSecond(record, levels, numberFactory).toNumber()).toBeCloseTo(expected, 9);
  });

  it('never goes below 0 or above the recorded amount, whatever it is given', () => {
    for (const levels of [-3, Number.NaN, 0, 3, 8, Number.POSITIVE_INFINITY]) {
      const v = synthCreditsPerSecond(record, levels, numberFactory).toNumber();
      expect(v, `levels ${levels}`).toBeGreaterThanOrEqual(0);
      expect(v, `levels ${levels}`).toBeLessThanOrEqual(80);
    }
  });
});

describe('Sleeve Euphoria in play', () => {
  /** The XP the first level of action `a` needs. */
  const firstLevelXp = (g: ReturnType<typeof createGame>): number => g.nextActionLevelXp('a').toNumber();

  it('without the skill nothing is reduced, however high the sleeve level', () => {
    const g = newGame();
    mutable(g).actions['a']!.sleeveXp = num('11111111110');
    expect(g.sleeveLevel('a')).toBe(10);
    expect(firstLevelXp(g)).toBeCloseTo(10, 9);
  });

  it('halves the XP a level needs at sleeve level 10', () => {
    const g = newGame();
    g.resleeve();
    g.buy('eu');
    mutable(g).actions['a']!.sleeveXp = num('11111111110');
    expect(g.sleeveLevel('a')).toBe(10);
    expect(firstLevelXp(g)).toBeCloseTo(5, 9);
    mutable(g).actions['a']!.xp = num(5);
    expect(g.actionLevel('a')).toBe(1); // 5 XP is enough for level 1 now
    mutable(g).actions['a']!.xp = num(4.9);
    expect(g.actionLevel('a')).toBe(0);
  });

  it('is worth nothing at sleeve level 1 and more at every higher sleeve level', () => {
    const g = newGame();
    g.resleeve();
    g.buy('eu');
    const needs: number[] = [];
    for (const xp of ['0', '10', '110', '1110', '11110', '111110']) {
      mutable(g).actions['a']!.sleeveXp = num(xp);
      needs.push(firstLevelXp(g));
    }
    expect(needs[0]).toBeCloseTo(10, 9); // level 0
    expect(needs[1]).toBeCloseTo(10, 9); // level 1
    for (let i = 2; i < needs.length; i++) expect(needs[i]!, `sleeve level ${i}`).toBeLessThan(needs[i - 1]!);
  });

  it('multiplies with a flat reduction instead of adding to it', () => {
    const g = newGame();
    g.resleeve();
    g.buy('eu');
    mutable(g).actions['a']!.sleeveXp = num('11111111110');
    mutable(g).credits = num(10);
    g.buy('flat'); // 20% less
    expect(firstLevelXp(g)).toBeCloseTo(10 * 0.8 * 0.5, 9);
  });

  it('survives a re-sleeve together with the sleeve XP it depends on', () => {
    const g = newGame();
    g.resleeve();
    g.buy('eu');
    mutable(g).actions['a']!.sleeveXp = num('11111111110');
    g.resleeve();
    expect(g.ownedCount('eu')).toBe(1);
    expect(firstLevelXp(g)).toBeCloseTo(5, 9);
  });
});

describe('saving', () => {
  const roundTrip = (g: ReturnType<typeof createGame>, c: GameConfig = config) =>
    deserializeState(serializeState(g.getState()), c, numberFactory);

  it('keeps the runs, the synthetic sleeves and the re-sleeve skills', () => {
    const g = newGame();
    withNodes(g, 1000);
    atLevel(g, 3);
    g.resleeve();
    g.buy('eu');
    g.resleeve();
    g.buy('syn');
    g.resleeve();
    const loaded = roundTrip(g)!;
    expect(loaded.runs.map((r) => [r.creditsPerSecond.toNumber(), r.actionLevelsTotal])).toEqual([
      [50, 3],
      [0, 0],
      [0, 0],
    ]);
    expect(loaded.synths).toEqual(g.getState().synths);
    expect(loaded.purchased['eu']).toBe(1);
    expect(loaded.purchased['syn']).toBe(1);
    expect(serializeState(loaded)).toBe(serializeState(g.getState())); // saving, loading and saving again gives the same text
  });

  it('loads an older save without these parts as a game with no runs', () => {
    const g = newGame();
    const data = JSON.parse(serializeState(g.getState())) as Record<string, unknown>;
    delete data['runs'];
    delete data['synths'];
    const loaded = deserializeState(JSON.stringify(data), config, numberFactory)!;
    expect(loaded.runs).toEqual([]);
    expect(loaded.synths).toEqual([]);
  });

  it('repairs what it cannot read: a bad run becomes an empty one (so the others keep their place) and a stray sleeve is dropped', () => {
    const g = newGame();
    g.resleeve();
    g.buy('eu');
    g.resleeve();
    g.buy('syn'); // one sleeve on run 1
    const data = JSON.parse(serializeState(g.getState())) as Record<string, unknown>;
    data['runs'] = [{ creditsPerSecond: 'oops', actionLevelsTotal: -4 }, { creditsPerSecond: '12', actionLevelsTotal: 3 }, 'junk'];
    data['synths'] = [{ runIndex: 1 }, { runIndex: 7 }, { runIndex: -1 }, { runIndex: 0.5 }, 'junk', { runIndex: 2 }];
    const loaded = deserializeState(JSON.stringify(data), config, numberFactory)!;
    expect(loaded.runs.map((r) => [r.creditsPerSecond.toNumber(), r.actionLevelsTotal])).toEqual([
      [0, 0],
      [12, 3],
      [0, 0],
    ]);
    expect(loaded.synths).toEqual([{ runIndex: 1 }, { runIndex: 2 }]);
  });

  it('hands out no synthetic sleeves to a save that does not own the skill', () => {
    const g = newGame();
    g.resleeve();
    const data = JSON.parse(serializeState(g.getState())) as Record<string, unknown>;
    data['synths'] = [{ runIndex: 0 }];
    expect(deserializeState(JSON.stringify(data), config, numberFactory)!.synths).toEqual([]);
  });

  it('the state of a played game passes every invariant', () => {
    const g = newGame();
    withNodes(g, 500);
    atLevel(g, 2);
    g.resleeve();
    g.buy('eu');
    g.resleeve();
    g.buy('syn');
    g.resleeve();
    g.tick(5_000);
    expect(findInvariantViolations(g.getState(), config)).toEqual([]);
  });
});

describe('validation', () => {
  const problems = (effect: BuyableDefinition['effect']): string =>
    validateConfig(createConfig(testConfig, { buyables: [...testConfig.buyables, resleeveSkill('x', effect)] })).join('|');

  it.each([
    [{ kind: 'actionXpReductionFromSleeveLevel', remainingPerOrder: 0, maxReduction: 0.9 }, 'remainingPerOrder must be in (0, 1)'],
    [{ kind: 'actionXpReductionFromSleeveLevel', remainingPerOrder: 1, maxReduction: 0.9 }, 'remainingPerOrder must be in (0, 1)'],
    [{ kind: 'actionXpReductionFromSleeveLevel', remainingPerOrder: 0.5, maxReduction: 1 }, 'maxReduction must be in [0, 1)'],
    [{ kind: 'actionXpReductionFromSleeveLevel', remainingPerOrder: 0.5, maxReduction: -0.1 }, 'maxReduction must be in [0, 1)'],
  ] as const)('%j is rejected', (effect, message) => {
    expect(problems(effect as BuyableDefinition['effect'])).toContain(message);
  });

  it('accepts the effects of the tree, and checks the new settings', () => {
    expect(problems({ kind: 'synthSleeves' })).toBe('');
    expect(problems({ kind: 'placeholder' })).toBe('');
    expect(validateConfig(createConfig(config, { resleeve: { pointsPerResleeve: 0 } })).join('|')).toContain('resleeve.pointsPerResleeve');
    expect(validateConfig(createConfig(config, { resleeve: { runsShown: 0 } })).join('|')).toContain('resleeve.runsShown');
  });
});
