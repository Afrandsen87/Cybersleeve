/**
 * Context: crits. The critical-success counter behind `hardenedPayloadFromCrits` (Forensic hardening): it counts only while the buyable is
 * owned, in closed form per batch, resets with the life, is saved, and raises the per-level ICE Rating of the level action.
 */
import { describe, expect, it } from 'vitest';
import { createGame } from '../../app/createGame';
import { num, numberFactory } from '../../numbers';
import { buy } from '../../testing/cyberneticsKit';
import { findInvariantViolations } from '../../testing/invariants';
import { seededRandom } from '../../testing/random';
import { asSave, flatSave } from '../../testing/saveKit';
import { networkAction, setCredits, testConfig } from '../../testing/testConfig';
import { createConfig, deserializeState, hardeningBonusPerLevel, serializeState, validateConfig, type BuyableDefinition } from '..';

const CRIT = buy({ id: 'crit', maxPurchases: Infinity, effect: { kind: 'criticalChance', chance: 1 } });
const HARD = buy({ id: 'hard', effect: { kind: 'iceRatingFromActionLevel', sourceActionId: 'a', perLevel: 10 } });
const forensic = (over: Partial<BuyableDefinition> = {}): BuyableDefinition =>
  buy({
    id: 'forensic',
    effect: { kind: 'hardenedPayloadFromCrits', critActionId: 'a', levelActionId: 'a', perCrit: 1 },
    ...over,
  });

const config = (extra: BuyableDefinition[] = [forensic()]) =>
  createConfig(testConfig, {
    buyables: [...testConfig.buyables, CRIT, HARD, ...extra],
    actions: [...testConfig.actions, networkAction],
    network: { creditsPerNodePerSecond: 0 },
  });

/** A seeded game with the given buyables bought in order. */
function played(buys: readonly string[], cfg = config()) {
  const g = createGame({ config: cfg, random: seededRandom(3) });
  setCredits(g, num(1_000_000));
  for (const id of buys) expect(g.buy(id), id).toBe('purchased');
  return g;
}
const tally = (g: { getState(): { sleeve: { hardeningCrits: Readonly<Record<string, number>> } } }, id = 'forensic'): number =>
  g.getState().sleeve.hardeningCrits[id] ?? 0;

describe('the critical success counter', () => {
  it('counts nothing before the buyable is owned, then every critical success of its action', () => {
    const g = played(['crit', 'auto']);
    g.startAction('a');
    g.tick(30_000); // critical runs before the purchase are not counted
    expect(tally(g)).toBe(0);
    expect(g.buy('forensic')).toBe('purchased');
    g.tick(40_000);
    expect(tally(g)).toBeGreaterThan(0);
  });

  it('every critical success of a run counts, not every run: two sources of chance give two per run', () => {
    const one = played(['crit', 'forensic', 'auto']);
    const two = played(['crit', 'crit', 'forensic', 'auto']);
    for (const g of [one, two]) {
      g.startAction('a');
      g.tick(10_000); // exactly one run at the level-0 speed
    }
    expect(tally(one)).toBe(1);
    expect(tally(two)).toBe(2);
  });

  it('one long tick and many short ones give the same count', () => {
    const once = played(['crit', 'forensic', 'auto']);
    const stepped = played(['crit', 'forensic', 'auto']);
    for (const g of [once, stepped]) g.startAction('a');
    once.tick(200_000);
    for (let i = 0; i < 200; i++) stepped.tick(1_000);
    expect(tally(once)).toBeGreaterThan(10);
    expect(tally(stepped)).toBe(tally(once));
  });

  it('counts only the action the buyable names', () => {
    const g = played(
      ['crit', 'forensic'],
      config([forensic({ effect: { kind: 'hardenedPayloadFromCrits', critActionId: 'net', levelActionId: 'a', perCrit: 1 } })]),
    );
    g.startAction('a');
    g.tick(10_000);
    expect(tally(g)).toBe(0);
  });

  it('is reset by re-sleeving, saved with the life, and a save without it loads as 0', () => {
    const g = played(['crit', 'forensic', 'auto']);
    g.startAction('a');
    g.tick(20_000);
    expect(tally(g)).toBeGreaterThan(0);
    const counted = tally(g);
    const text = serializeState(g.getState());
    expect(tally({ getState: () => deserializeState(text, config(), numberFactory)! })).toBe(counted);
    const { hardeningCrits: _gone, ...rest } = flatSave(text);
    expect(tally({ getState: () => deserializeState(asSave(rest), config(), numberFactory)! })).toBe(0);
    g.resleeve();
    expect(tally(g)).toBe(0);
  });

  it('keeps the invariants, and a negative or fractional saved count is repaired', () => {
    const g = played(['crit', 'forensic', 'auto']);
    g.startAction('a');
    g.tick(25_000);
    expect(findInvariantViolations(g.getState(), config())).toEqual([]);
    const bad = flatSave(serializeState(g.getState()));
    bad['hardeningCrits'] = { forensic: -3.5, ghost: 4 };
    expect(tally({ getState: () => deserializeState(asSave(bad), config(), numberFactory)! })).toBe(0);
    bad['hardeningCrits'] = 7; // the old scalar form is not a record: ignored
    expect(tally({ getState: () => deserializeState(asSave(bad), config(), numberFactory)! })).toBe(0);
  });

  it('keeps one count per buyable: a second one bought later starts from its own purchase', () => {
    const second = forensic({ id: 'forensic2' });
    const g = played(['crit', 'forensic', 'auto'], config([forensic(), second]));
    g.startAction('a');
    g.tick(20_000);
    const first = tally(g);
    expect(first).toBeGreaterThan(0);
    expect(tally(g, 'forensic2')).toBe(0);
    expect(g.buy('forensic2')).toBe('purchased');
    g.tick(20_000);
    expect(tally(g)).toBeGreaterThan(first);
    expect(tally(g, 'forensic2')).toBeGreaterThan(0);
    expect(tally(g, 'forensic2')).toBeLessThan(tally(g));
    expect(findInvariantViolations(g.getState(), config([forensic(), second]))).toEqual([]);
  });

  it('saves an empty record as {}, and drops a saved count whose buyable is not owned', () => {
    const g = played(['crit', 'auto']);
    expect(flatSave(serializeState(g.getState()))['hardeningCrits']).toEqual({});
    const bad = flatSave(serializeState(g.getState()));
    bad['hardeningCrits'] = { forensic: 5 };
    expect(tally({ getState: () => deserializeState(asSave(bad), config(), numberFactory)! })).toBe(0);
  });
});

describe('the ICE Rating it adds', () => {
  const setLevel2 = (g: ReturnType<typeof played>) => {
    (g.getState().sleeve.actions['a'] as { xp: unknown }).xp = num(110); // level 2
  };

  it('adds crits x perCrit to each level: level 2 and 10 per level make 1 + (10 + counted crits) x 2', () => {
    const g = played(['hard', 'crit', 'forensic', 'auto']);
    setLevel2(g);
    expect(g.actionLevel('a')).toBe(2);
    expect(g.sleeveStats().iceRating.toNumber()).toBe(21);
    g.startAction('a');
    g.tick(30_000);
    const counted = tally(g);
    expect(counted).toBeGreaterThan(0);
    expect(g.actionLevel('a')).toBe(2);
    expect(g.sleeveStats().iceRating.toNumber()).toBe(1 + (10 + counted) * 2);
  });

  it('is the owner function that the tooltip values use', () => {
    expect(hardeningBonusPerLevel(7, 1)).toBe(7);
    expect(hardeningBonusPerLevel(7, 0.5)).toBe(3.5);
    for (const bad of [0, -4, Number.NaN]) expect(hardeningBonusPerLevel(bad, 1)).toBe(0);
  });

  it('is rejected when perCrit is not above 0 or an action is unknown', () => {
    const bad = (effect: object) => validateConfig(config([forensic({ effect: effect as BuyableDefinition['effect'] })])).join('|');
    expect(bad({ kind: 'hardenedPayloadFromCrits', critActionId: 'a', levelActionId: 'a', perCrit: 0 })).toContain('perCrit must be > 0');
    expect(bad({ kind: 'hardenedPayloadFromCrits', critActionId: 'ghost', levelActionId: 'a', perCrit: 1 })).toContain(
      'unknown action "ghost"',
    );
    expect(bad({ kind: 'hardenedPayloadFromCrits', critActionId: 'a', levelActionId: 'ghost', perCrit: 1 })).toContain(
      'unknown action "ghost"',
    );
  });
});
