import { describe, expect, it } from 'vitest';
import { createGame } from '../../app/createGame';
import { num } from '../../numbers';
import { seededRandom } from '../../testing/random';
import { setCredits, testConfig } from '../../testing/testConfig';
import { CRIT_WINDOW_MS, CritFeed } from './critFeed';
import { createConfig } from '../config/config';
import type { BuyableDefinition } from '../types';

describe('CritFeed', () => {
  it('starts empty', () => {
    expect(new CritFeed().recent('a')).toEqual({ count: 0, perSecond: 0 });
  });

  it('adds up the critical successes of the last second per action and ignores other actions', () => {
    const feed = new CritFeed();
    feed.record('a', 2);
    feed.advance(400);
    feed.record('a', 3);
    feed.record('b', 1);
    expect(feed.recent('a')).toEqual({ count: 5, perSecond: 5 });
    expect(feed.recent('b').count).toBe(1);
  });

  it('forgets a critical success once it is older than the window', () => {
    const feed = new CritFeed();
    feed.record('a', 4);
    feed.advance(CRIT_WINDOW_MS);
    expect(feed.recent('a').count).toBe(4); // exactly one window old still counts
    feed.advance(1);
    expect(feed.recent('a')).toEqual({ count: 0, perSecond: 0 });
  });

  it('notes nothing for zero, and clear forgets everything', () => {
    const feed = new CritFeed();
    feed.record('a', 0);
    expect(feed.recent('a').count).toBe(0);
    feed.record('a', 1);
    feed.clear();
    expect(feed.recent('a').count).toBe(0);
  });

  it('ignores negative or zero time', () => {
    const feed = new CritFeed();
    feed.record('a', 1);
    feed.advance(-5000);
    feed.advance(0);
    expect(feed.recent('a').count).toBe(1);
  });
});

describe('the engine reports critical successes for highlighting', () => {
  const crit: BuyableDefinition = {
    id: 'crit',
    name: 'Crit',
    description: '',
    cost: num(1),
    maxPurchases: Infinity,
    effect: { kind: 'criticalChance', chance: 1 },
  };
  const config = createConfig(testConfig, { buyables: [...testConfig.buyables, crit], network: { creditsPerNodePerSecond: 0 } });

  it('counts the critical successes of a completed run for one second of game time, then forgets them', () => {
    const g = createGame({ config, random: seededRandom(1) });
    setCredits(g, num(100));
    g.buy('crit');
    expect(g.recentCrits('a').count).toBe(0);
    g.startAction('a');
    g.tick(10_000 + 1); // one run, one critical success at 100%
    expect(g.recentCrits('a').count).toBe(1);
    g.tick(CRIT_WINDOW_MS + 1);
    expect(g.recentCrits('a').count).toBe(0);
  });

  it('a long batch reports every critical success as a rate per second', () => {
    const g = createGame({ config, random: seededRandom(1) });
    setCredits(g, num(100));
    g.buy('crit');
    g.buy('auto');
    g.startAction('a');
    g.tick(10_000 * 50 + 1);
    expect(g.recentCrits('a').count).toBeGreaterThan(1);
    expect(g.recentCrits('a').perSecond).toBe(g.recentCrits('a').count);
  });

  it('no chance, no highlight; re-sleeving clears it', () => {
    const plain = createGame({ config, random: seededRandom(1) });
    plain.startAction('a');
    plain.tick(10_001);
    expect(plain.recentCrits('a').count).toBe(0);
    const g = createGame({ config, random: seededRandom(1) });
    setCredits(g, num(100));
    g.buy('crit');
    g.startAction('a');
    g.tick(10_001);
    g.resleeve();
    expect(g.recentCrits('a').count).toBe(0);
  });
});
