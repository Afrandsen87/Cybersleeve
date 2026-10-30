/**
 * The two unlocks: Sleeve levels (sleeve XP starts, levels read) and Unlock resleeving (re-sleeving is allowed after a short lockout).
 * Both survive re-sleeving.
 */
import { describe, expect, it } from 'vitest';
import { createGame } from '../../app/createGame';
import { num } from '../../numbers';
import { setCredits, setSleeveXp, testConfig } from '../../testing/testConfig';
import { createConfig, validateConfig, type BuyableDefinition } from '..';

const levels: BuyableDefinition = {
  id: 'levels',
  name: 'Sleeve levels',
  description: '',
  cost: num(10),
  effect: { kind: 'unlockSleeveLevels' },
};

const unlock: BuyableDefinition = {
  id: 'unlock',
  name: 'Unlock resleeving',
  description: '',
  cost: num(10),
  requires: ['levels'],
  effect: { kind: 'unlockResleeve' },
};

const gated = (lockoutMs = 5_000) =>
  createConfig(testConfig, {
    buyables: [...testConfig.buyables, levels, unlock],
    resleeve: { ...testConfig.resleeve, lockoutMs },
  });

/** A game with both unlocks for sale, 1e6 sleeve XP on action `a` and credits to buy them. */
const newGame = (lockoutMs = 5_000) => {
  const g = createGame({ config: gated(lockoutMs) });
  setSleeveXp(g, num(1e6));
  setCredits(g, num(100));
  return g;
};

/** Buys both unlocks. */
const buyBoth = (g: ReturnType<typeof newGame>): void => {
  g.buy('levels');
  g.buy('unlock');
};

describe('before either unlock is bought', () => {
  it('saved sleeve XP reads level 0, and re-sleeving is refused', () => {
    const g = newGame();
    expect(g.sleeveLevel('a')).toBe(0);
    expect(g.canResleeve()).toBe(false);
    expect(g.resleeve()).toBe(false);
    expect(g.getState().wallet.runs).toHaveLength(0);
  });

  it('buying Sleeve levels turns the XP into levels at once, but does not allow re-sleeving', () => {
    const g = newGame();
    expect(g.buy('levels')).toBe('purchased');
    expect(g.sleeveLevel('a')).toBeGreaterThan(0);
    g.tick(60_000);
    expect(g.canResleeve()).toBe(false);
    expect(g.resleeve()).toBe(false);
  });
});

describe('the re-sleeve lockout after buying Unlock resleeving', () => {
  it('buying Sleeve levels starts no lockout', () => {
    const g = newGame();
    g.buy('levels');
    expect(g.getState().sleeve.resleeveLockoutMs).toBe(0);
  });

  it('refuses re-sleeving until the lockout has run out, counted in game time', () => {
    const g = newGame(5_000);
    buyBoth(g);
    expect(g.canResleeve()).toBe(false);
    g.tick(4_999);
    expect(g.canResleeve()).toBe(false);
    g.tick(1);
    expect(g.canResleeve()).toBe(true);
    expect(g.resleeve()).toBe(true);
  });

  it('one long tick and many short ones end the lockout together', () => {
    const long = newGame();
    const short = newGame();
    buyBoth(long);
    buyBoth(short);
    long.tick(5_000);
    for (let i = 0; i < 100; i++) short.tick(50);
    expect(long.canResleeve()).toBe(true);
    expect(short.canResleeve()).toBe(true);
    expect(short.getState().sleeve.resleeveLockoutMs).toBe(long.getState().sleeve.resleeveLockoutMs);
  });

  it('a content lockout of 0 allows re-sleeving the moment it is bought', () => {
    const g = newGame(0);
    buyBoth(g);
    expect(g.canResleeve()).toBe(true);
  });
});

describe('re-sleeving with the unlocks', () => {
  it('keeps both unlocks and the sleeve XP, and does not start a new lockout', () => {
    const g = newGame();
    buyBoth(g);
    g.tick(5_000);
    g.resleeve();
    expect(g.ownedCount('levels')).toBe(1);
    expect(g.ownedCount('unlock')).toBe(1);
    expect(g.sleeveLevel('a')).toBeGreaterThan(0);
    expect(g.getState().sleeve.resleeveLockoutMs).toBe(0);
    expect(g.canResleeve()).toBe(true);
  });

  it('the lockout is in the state (it has a safe default for older saves)', () => {
    const g = newGame();
    buyBoth(g);
    expect(g.getState().sleeve.resleeveLockoutMs).toBe(5_000);
  });
});

describe('validation', () => {
  it('rejects a negative lockout and a second buyable of either unlock kind', () => {
    expect(validateConfig(gated(-1)).join('|')).toContain('resleeve.lockoutMs');
    const twoLevels = createConfig(gated(), { buyables: [...gated().buyables, { ...levels, id: 'levels2' }] });
    expect(validateConfig(twoLevels).join('|')).toContain('unlockSleeveLevels');
    const twoUnlocks = createConfig(gated(), { buyables: [...gated().buyables, { ...unlock, id: 'unlock2' }] });
    expect(validateConfig(twoUnlocks).join('|')).toContain('unlockResleeve');
  });

  it('a game with no such buyables has no gate: levels count and re-sleeving is always allowed', () => {
    const g = createGame({ config: testConfig });
    setSleeveXp(g, num(1e6));
    expect(g.sleeveLevel('a')).toBeGreaterThan(0);
    expect(g.canResleeve()).toBe(true);
  });

  it('a game with only Sleeve levels still allows re-sleeving (the permission has its own buyable)', () => {
    const config = createConfig(testConfig, { buyables: [...testConfig.buyables, levels] });
    const g = createGame({ config });
    expect(g.canResleeve()).toBe(true);
  });
});
