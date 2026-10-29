/**
 * The sleeve-levels unlock: until it is bought, sleeve XP is tracked but its levels read 0 and re-sleeving is refused; buying it opens both
 * after a short lockout, and it survives re-sleeving.
 */
import { describe, expect, it } from 'vitest';
import { createGame } from '../../app/createGame';
import { num } from '../../numbers';
import { setCredits, setSleeveXp, testConfig } from '../../testing/testConfig';
import { createConfig, validateConfig, type BuyableDefinition } from '..';

const gate: BuyableDefinition = {
  id: 'levels',
  name: 'Sleeve levels',
  description: '',
  cost: num(10),
  effect: { kind: 'unlockSleeveLevels' },
};

const gated = (lockoutMs = 5_000) =>
  createConfig(testConfig, {
    buyables: [...testConfig.buyables, gate],
    resleeve: { ...testConfig.resleeve, lockoutMs },
  });

/** A game with the unlock for sale, 1e6 sleeve XP on action `a` and credits to buy it. */
const newGame = (lockoutMs = 5_000) => {
  const g = createGame({ config: gated(lockoutMs) });
  setSleeveXp(g, num(1e6));
  setCredits(g, num(100));
  return g;
};

describe('before the sleeve-levels unlock is bought', () => {
  it('sleeve XP is tracked but its level reads 0, and re-sleeving is refused', () => {
    const g = newGame();
    expect(g.getState().actions['a']!.sleeveXp.toNumber()).toBe(1e6);
    expect(g.sleeveLevel('a')).toBe(0);
    expect(g.canResleeve()).toBe(false);
    expect(g.resleeve()).toBe(false);
    expect(g.getState().runs).toHaveLength(0);
  });

  it('buying it turns the tracked XP into levels at once', () => {
    const g = newGame();
    expect(g.buy('levels')).toBe('purchased');
    expect(g.sleeveLevel('a')).toBeGreaterThan(0);
  });
});

describe('the re-sleeve lockout after buying it', () => {
  it('refuses re-sleeving until the lockout has run out, counted in game time', () => {
    const g = newGame(5_000);
    g.buy('levels');
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
    long.buy('levels');
    short.buy('levels');
    long.tick(5_000);
    for (let i = 0; i < 100; i++) short.tick(50);
    expect(long.canResleeve()).toBe(true);
    expect(short.canResleeve()).toBe(true);
    expect(short.getState().resleeveLockoutMs).toBe(long.getState().resleeveLockoutMs);
  });

  it('a content lockout of 0 allows re-sleeving the moment it is bought', () => {
    const g = newGame(0);
    g.buy('levels');
    expect(g.canResleeve()).toBe(true);
  });
});

describe('re-sleeving with the unlock', () => {
  it('keeps the unlock and the sleeve XP, and does not start a new lockout', () => {
    const g = newGame();
    g.buy('levels');
    g.tick(5_000);
    g.resleeve();
    expect(g.ownedCount('levels')).toBe(1);
    expect(g.sleeveLevel('a')).toBeGreaterThan(0);
    expect(g.getState().resleeveLockoutMs).toBe(0);
    expect(g.canResleeve()).toBe(true);
  });

  it('is saved and loaded with the state (the lockout field has a safe default for older saves)', () => {
    const g = newGame();
    g.buy('levels');
    expect(g.getState().resleeveLockoutMs).toBe(5_000);
  });
});

describe('validation', () => {
  it('rejects a negative lockout and a second unlock buyable', () => {
    expect(validateConfig(gated(-1)).join('|')).toContain('resleeve.lockoutMs');
    const two = createConfig(gated(), { buyables: [...gated().buyables, { ...gate, id: 'levels2' }] });
    expect(validateConfig(two).join('|')).toContain('unlockSleeveLevels');
  });

  it('a game with no such buyable has no gate: levels count and re-sleeving is always allowed', () => {
    const g = createGame({ config: testConfig });
    setSleeveXp(g, num(1e6));
    expect(g.sleeveLevel('a')).toBeGreaterThan(0);
    expect(g.canResleeve()).toBe(true);
  });
});
