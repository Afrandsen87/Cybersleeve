import { describe, expect, it } from 'vitest';
import { seededGame } from '../../testing/gameKit';
import { numberFactory } from '../../numbers';
import { buy } from '../../testing/cyberneticsKit';
import { findInvariantViolations } from '../../testing/invariants';
import { testConfig } from '../../testing/testConfig';
import { createConfig, deserializeState, serializeState, validateConfig, type BuyableDefinition, type GameConfig } from '..';
import { asSave, flatSave } from '../../testing/saveKit';

/**
 * Two test actions, `a` and `b`, each 10 s per run, paying 0.5 credits and 1 XP; criticals pay 3x and give 2x XP. Levels are out of
 * reach so the speed stays put. `a` makes 1 heat per run and has an Overclock whose runs make 3x the heat. The Zero-day (for `a`)
 * is how the tests make runs of `a` critical without any chance.
 */
function configWith(extra: BuyableDefinition[] = []): GameConfig {
  const base = createConfig(testConfig, {
    buyables: [
      ...testConfig.buyables,
      buy({ id: 'crit', maxPurchases: Infinity, effect: { kind: 'criticalChance', chance: 1 } }),
      ...extra,
    ],
    items: {
      rarities: testConfig.items.rarities,
      definitions: [...testConfig.items.definitions, { id: 'zd', name: 'Zero-day', sellable: false, hasRarity: false }],
      zeroDay: { itemId: 'zd', actionId: 'a' },
    },
    progression: { actionLevels: { firstLevelXp: 1e12, growthFactor: 10 }, sleeveLevels: { firstLevelXp: 1e12, growthFactor: 10 } },
    network: { creditsPerNodePerSecond: 0 },
  });
  const a = { ...base.actions[0]!, heatPerRun: 1, overclock: { heatPerRunFactor: 3 } };
  return createConfig(base, { actions: [a, { ...a, id: 'b', name: 'B', heatPerRun: undefined, overclock: undefined }] });
}

function game(config: GameConfig = configWith(), seed = 1) {
  return seededGame(config, seed);
}

type Game = ReturnType<typeof game>;
const xp = (g: Game, id: string): number => g.getState().sleeve.actions[id]!.xp.toNumber();
const credits = (g: Game): number => g.getState().wallet.credits.toNumber();
const giveZeroDays = (g: Game, n: number): void => {
  (g.getState() as unknown as { wallet: { inventory: Record<string, Record<string, number>> } }).wallet.inventory['zd'] = { common: n };
};

describe('critical boost (Persistence)', () => {
  const boost = buy({ id: 'boost', actionId: 'a', effect: { kind: 'criticalBoost', factor: 3 } });

  it('triples both critical multipliers of its action: x9 reward and x6 XP instead of x3 and x2', () => {
    const g = game(configWith([boost]));
    g.buy('crit');
    g.buy('auto');
    g.buy('boost');
    const before = credits(g);
    g.startAction('a');
    g.tick(10_000 * 4 + 1); // chance 1: every run is critical
    expect(credits(g) - before).toBeCloseTo(4 * 0.5 * 9, 9);
    expect(xp(g, 'a')).toBe(4 * 6);
  });

  it('leaves other actions alone: their critical runs still pay x3 and give x2 XP', () => {
    const g = game(configWith([boost]));
    g.buy('crit');
    g.buy('boost');
    const before = credits(g);
    g.startAction('b');
    g.tick(10_000 + 1);
    expect(credits(g) - before).toBeCloseTo(0.5 * 3, 9);
    expect(xp(g, 'b')).toBe(2);
  });

  it('does nothing to ordinary runs', () => {
    const g = game(configWith([boost]));
    g.buy('boost');
    g.buy('auto');
    const before = credits(g);
    g.startAction('a');
    g.tick(10_000 * 4 + 1);
    expect(credits(g) - before).toBeCloseTo(2, 9);
  });

  it('is rejected below 1', () => {
    const config = configWith([buy({ id: 'bad', actionId: 'a', effect: { kind: 'criticalBoost', factor: 0.5 } })]);
    expect(validateConfig(config).join('|')).toContain('criticalBoost factor must be >= 1');
  });
});

describe('critical link (Ransomware)', () => {
  const link = buy({ id: 'link', actionId: 'a', effect: { kind: 'criticalLink', targetActionId: 'b' } });

  /** Three critical runs of `a` (a Zero-day each). */
  function threeCriticalRunsOfA(g: Game): void {
    giveZeroDays(g, 3);
    g.toggleZeroDays();
    g.buy('auto');
    g.startAction('a');
    g.tick(10_000 * 3 + 1);
    g.toggleAutoRun('auto'); // `a` stays idle from here on
    (g.getState().sleeve.actions['a'] as { running: boolean }).running = false;
  }

  it('banks one guaranteed critical for the target per critical run of its action', () => {
    const g = game(configWith([link]));
    g.buy('link');
    threeCriticalRunsOfA(g);
    expect(g.getState().sleeve.bankedCriticals).toEqual({ b: 3 });
  });

  it('banks nothing without the buyable, or from ordinary runs', () => {
    const without = game(configWith([link]));
    threeCriticalRunsOfA(without);
    expect(without.getState().sleeve.bankedCriticals).toEqual({});
    const ordinary = game(configWith([link]));
    ordinary.buy('link');
    ordinary.buy('auto');
    ordinary.startAction('a');
    ordinary.tick(10_000 * 3 + 1);
    expect(ordinary.getState().sleeve.bankedCriticals).toEqual({});
  });

  it('the target next completed run is critical for sure, using one banked success', () => {
    const g = game(configWith([link]));
    g.buy('link');
    threeCriticalRunsOfA(g);
    const before = credits(g);
    g.startAction('b');
    g.tick(10_000 + 1);
    expect(credits(g) - before).toBeCloseTo(0.5 * 3, 9);
    expect(g.getState().sleeve.bankedCriticals).toEqual({ b: 2 });
  });

  it('runs of the target spend the bank first and the rest are ordinary: 3 critical runs, then 2 ordinary', () => {
    const g = game(configWith([link]));
    g.buy('link');
    threeCriticalRunsOfA(g);
    const before = credits(g);
    const xpBefore = xp(g, 'b');
    for (let i = 0; i < 5; i++) {
      g.startAction('b');
      g.tick(10_000 + 1);
    }
    expect(g.getState().sleeve.bankedCriticals).toEqual({});
    expect(credits(g) - before).toBeCloseTo(3 * 0.5 * 3 + 2 * 0.5, 9);
    expect(xp(g, 'b') - xpBefore).toBe(3 * 2 + 2);
  });

  it('is saved, and a save cannot bank for an unknown action or with a bad count', () => {
    const g = game(configWith([link]));
    g.buy('link');
    threeCriticalRunsOfA(g);
    const back = deserializeState(serializeState(g.getState()), g.getConfig(), numberFactory)!;
    expect(back.sleeve.bankedCriticals).toEqual({ b: 3 });
    const data = flatSave(serializeState(g.getState())) as Record<string, unknown>;
    data['bankedCriticals'] = { b: 2, ghost: 5, a: -1 };
    expect(deserializeState(asSave(data), g.getConfig(), numberFactory)!.sleeve.bankedCriticals).toEqual({ b: 2 });
  });

  it('keeps every invariant, resets with a new game, and rejects an unknown target', () => {
    const g = game(configWith([link]));
    g.buy('link');
    threeCriticalRunsOfA(g);
    expect(findInvariantViolations(g.getState(), g.getConfig())).toEqual([]);
    g.newGame();
    expect(g.getState().sleeve.bankedCriticals).toEqual({});
    const bad = configWith([buy({ id: 'bad', actionId: 'a', effect: { kind: 'criticalLink', targetActionId: 'ghost' } })]);
    expect(validateConfig(bad).join('|')).toContain('criticalLink refers to unknown action "ghost"');
  });

  it('one long tick and many short ones bank the same', () => {
    const long = game(configWith([link]));
    const short = game(configWith([link]));
    for (const g of [long, short]) {
      g.buy('link');
      giveZeroDays(g, 4);
      g.toggleZeroDays();
      g.buy('auto');
      g.startAction('a');
    }
    long.tick(10_000 * 6);
    for (let i = 0; i < 60; i++) short.tick(1_000);
    expect(short.getState().sleeve.bankedCriticals).toEqual(long.getState().sleeve.bankedCriticals);
    expect(long.getState().sleeve.bankedCriticals).toEqual({ b: 4 });
  });
});

describe('Overclock heat factor (Obfuscation)', () => {
  const unlock = buy({ id: 'ocu', actionId: 'a', effect: { kind: 'overclockUnlock' } });
  const factor = (f: number) => buy({ id: 'obf', effect: { kind: 'overclockHeatFactor', targetActionId: 'a', factor: f } });

  it('lowers the heat factor of that action Overclock from 3 to 2', () => {
    const g = game(configWith([unlock, factor(2)]));
    g.buy('ocu');
    expect(g.overclockStatus('a')!.heatPerRunFactor).toBe(3);
    g.buy('obf');
    expect(g.overclockStatus('a')!.heatPerRunFactor).toBe(2);
  });

  it('really lowers the heat of a run: one overclocked run makes exactly 1 heat less', () => {
    const heatAfterOneRun = (withSkill: boolean): number => {
      const g = game(configWith([unlock, factor(2)]));
      g.buy('ocu');
      if (withSkill) g.buy('obf');
      g.toggleOverclock('a');
      g.startAction('a');
      g.tick(g.currentDurationMs('a') + 1);
      return g.getState().sleeve.heat;
    };
    expect(heatAfterOneRun(false) - heatAfterOneRun(true)).toBeCloseTo(1, 9);
  });

  it('never raises the factor', () => {
    const g = game(configWith([unlock, factor(5)]));
    g.buy('ocu');
    g.buy('obf');
    expect(g.overclockStatus('a')!.heatPerRunFactor).toBe(3);
  });

  it('is rejected for an unknown action or a factor below 1', () => {
    const unknown = configWith([buy({ id: 'bad', effect: { kind: 'overclockHeatFactor', targetActionId: 'ghost', factor: 2 } })]);
    expect(validateConfig(unknown).join('|')).toContain('overclockHeatFactor refers to unknown action "ghost"');
    expect(validateConfig(configWith([factor(0.5)])).join('|')).toContain('factor must be >= 1');
  });
});
