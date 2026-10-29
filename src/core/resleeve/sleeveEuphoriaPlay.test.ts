/**
 * Sleeve Euphoria in play.
 */
import { describe, expect, it } from 'vitest';
import type { createGame } from '../../app/createGame';
import { num } from '../../numbers';
import { mutable, newGame } from '../../testing/resleeveTreeKit';

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
