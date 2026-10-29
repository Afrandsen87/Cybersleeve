/**
 * The synthetics lane of the re-sleeve skills (Cloning Vats, Hive Interface, Neural Mirror, Perfect Copies), tested on a small
 * configuration: every skill costs 1 point and the chain is bought in order.
 */
import { describe, expect, it } from 'vitest';
import { num, numberFactory } from '../../numbers';
import { findInvariantViolations } from '../../testing/invariants';
import { deserializeState, serializeState, validateConfig } from '..';
import { loose, newGame, resleeveSkill, resleeveTimes, tryBuy, withBuyables } from '../../testing/resleeveSkillsKit';
import { asSave, flatSave } from '../../testing/saveKit';

const chain = [
  resleeveSkill('syn', { kind: 'synthSleeves' }),
  resleeveSkill('vats', { kind: 'synthsPerResleeve', count: 2 }, 1, ['syn']),
  resleeveSkill('hive', { kind: 'interfaceSpeedPerLnSynths', perLn: 0.1 }, 1, ['vats']),
  resleeveSkill('mirror', { kind: 'synthXpBoost', factor: 1.25 }, 1, ['hive']),
  resleeveSkill('perfect', { kind: 'perfectCopies' }, 1, ['mirror']),
];
const config = withBuyables(chain);

/** XP that puts action 'a' at level 3 in the test configuration (levels cost 10, 100, 1000). */
const LEVEL_3_XP = 1_110;

/** Buys the skills of the chain in order, re-sleeving for a point first whenever one is missing. */
function buyChain(g: ReturnType<typeof newGame>, upTo: string): void {
  for (const skill of chain) {
    if (g.resleevePoints() === 0) resleeveTimes(g, 1);
    expect(tryBuy(g, skill.id), skill.id).toBe('purchased');
    if (skill.id === upTo) return;
  }
}

describe('the real-looking chain is valid content', () => {
  it('passes validation, and rejects bad numbers', () => {
    expect(validateConfig(config)).toEqual([]);
    expect(validateConfig(withBuyables([resleeveSkill('v', { kind: 'synthsPerResleeve', count: 1 })])).join()).toContain('count must be');
    expect(validateConfig(withBuyables([resleeveSkill('h', { kind: 'interfaceSpeedPerLnSynths', perLn: 0 })])).join()).toContain('perLn');
    expect(validateConfig(withBuyables([resleeveSkill('m', { kind: 'synthXpBoost', factor: 1 })])).join()).toContain('factor');
  });
});

describe('Cloning Vats', () => {
  it('gives two synthetic sleeves per re-sleeve instead of one, but only once it is owned', () => {
    const g = newGame(config);
    resleeveTimes(g, 1);
    tryBuy(g, 'syn');
    expect(g.synthCount()).toBe(1);
    resleeveTimes(g, 1);
    expect(g.synthCount(), 'one per re-sleeve before the skill').toBe(2);
    tryBuy(g, 'vats');
    expect(g.synthCount(), 'buying the skill gives none').toBe(2);
    resleeveTimes(g, 1);
    expect(g.synthCount()).toBe(4);
    resleeveTimes(g, 1);
    expect(g.synthCount()).toBe(6);
  });
});

describe('Hive Interface', () => {
  it('raises interface speed by one tenth of ln(1 + synthetic sleeves)', () => {
    const g = newGame(config);
    buyChain(g, 'vats');
    expect(g.synthCount()).toBe(2);
    resleeveTimes(g, 1); // two more synthetic sleeves, and the point for Hive Interface
    expect(g.synthCount()).toBe(4);
    const without = g.sleeveStats().interfaceSpeed;
    expect(tryBuy(g, 'hive')).toBe('purchased');
    expect(g.sleeveStats().interfaceSpeed / without).toBeCloseTo(1 + 0.1 * Math.log(1 + 4), 12);
    resleeveTimes(g, 1);
    expect(g.synthCount()).toBe(6);
    expect(g.sleeveStats().interfaceSpeed / without).toBeCloseTo(1 + 0.1 * Math.log(1 + 6), 12);
  });
});

describe('Neural Mirror', () => {
  it('boosts action XP by 25% only while the action is below the level a synthetic sleeve reached on it', () => {
    const g = newGame(config);
    for (let i = 0; i < 4; i++) {
      loose(g).actions['a']!.xp = num(LEVEL_3_XP);
      g.resleeve();
    }
    for (const id of ['syn', 'vats', 'hive']) expect(tryBuy(g, id), id).toBe('purchased');
    expect(g.xpPerRun('a').toNumber(), 'before Neural Mirror').toBe(1);
    expect(tryBuy(g, 'mirror')).toBe('purchased');
    expect(g.actionLevel('a')).toBe(0);
    expect(g.xpPerRun('a').toNumber()).toBeCloseTo(1.25, 12);
    loose(g).actions['a']!.xp = num(LEVEL_3_XP - 1);
    expect(g.actionLevel('a')).toBe(2);
    expect(g.xpPerRun('a').toNumber()).toBeCloseTo(1.25, 12);
    loose(g).actions['a']!.xp = num(LEVEL_3_XP);
    expect(g.actionLevel('a')).toBe(3);
    expect(g.xpPerRun('a').toNumber(), 'caught up').toBe(1);
  });

  it('gives nothing without a synthetic sleeve that reached a level, however many runs there are', () => {
    const g = newGame(config);
    buyChain(g, 'mirror'); // the runs were written down at level 0
    expect(g.xpPerRun('a').toNumber()).toBe(1);
  });

  it('writes every action level into the run record, and keeps them through a save', () => {
    const g = newGame(config);
    loose(g).actions['a']!.xp = num(LEVEL_3_XP);
    g.resleeve();
    expect(g.getState().wallet.runs[0]?.actionLevels).toMatchObject({ a: 3 });
    const loaded = deserializeState(serializeState(g.getState()), config, numberFactory)!;
    expect(loaded.wallet.runs[0]?.actionLevels).toMatchObject({ a: 3 });
    expect(findInvariantViolations(loaded, config)).toEqual([]);
  });

  it('loads a record that has no levels (made before they were kept) as a run without any', () => {
    const g = newGame(config);
    g.resleeve();
    const saved = flatSave(serializeState(g.getState())) as { runs: Record<string, unknown>[] };
    delete saved.runs[0]!['actionLevels'];
    const loaded = deserializeState(asSave(saved), config, numberFactory)!;
    expect(loaded.wallet.runs[0]?.actionLevels).toBeUndefined();
  });
});

describe('Perfect Copies', () => {
  it('lets each synthetic sleeve earn what the network earns now when that is more than the run it copies', () => {
    const g = newGame(config);
    buyChain(g, 'mirror');
    loose(g).network = num(100);
    expect(g.synthCount()).toBeGreaterThan(0);
    expect(g.synthCreditsPerSecond().toNumber(), 'the runs were written down with no network').toBe(0);
    resleeveTimes(g, 1);
    expect(tryBuy(g, 'perfect')).toBe('purchased');
    loose(g).network = num(100);
    const live = g.passiveCreditsPerSecond().toNumber();
    expect(live).toBeGreaterThan(0);
    expect(g.synthCreditsPerSecond().toNumber()).toBeCloseTo(live * g.synthCount(), 9);
  });

  it('never pays a synthetic sleeve less than the run it copies', () => {
    const g = newGame(config);
    loose(g).network = num(1000);
    g.resleeve(); // a run with a big network
    const rich = g.getState().wallet.runs[0]!.creditsPerSecond.toNumber();
    expect(rich).toBeGreaterThan(0);
    buyChain(g, 'perfect');
    loose(g).network = num(1);
    expect(g.synthCreditsPerSecond().toNumber()).toBeGreaterThanOrEqual(rich * 0.999);
  });
});
