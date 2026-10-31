/**
 * Economy context: distinct sleeve-skill ownership gates purchases.
 * Called by: vitest. Calls: shared resleeveSkillsKit, Shop through GameEngine.
 */
import { describe, expect, it } from 'vitest';
import { validateConfig } from '../config/config';
import { newGame, plainBuyable, resleeveSkill, resleeveTimes, withBuyables } from '../../testing/resleeveSkillsKit';
const skills = [resleeveSkill('one', { kind: 'sleeveUp' }), resleeveSkill('two', { kind: 'placeholder' })];
const late = plainBuyable('late', { kind: 'placeholder' }, { requiresSleeveSkills: 2 });
describe('requiresSleeveSkills', () => {
  it('counts distinct owned sleeve skills, blocks buying, and defaults to zero', () => {
    const g = newGame(
      withBuyables([
        ...skills,
        late,
        { ...late, id: 'early', requiresSleeveSkills: 1 },
        { ...late, id: 'free', requiresSleeveSkills: undefined },
      ]),
    );
    expect(g.isBuyableAvailable('free')).toBe(true);
    expect(g.isBuyableAvailable('early')).toBe(false);
    expect(g.buy('late')).toBe('locked');
    resleeveTimes(g, 3);
    expect(g.buy('one')).toBe('purchased');
    expect(g.isBuyableAvailable('early')).toBe(true);
    (g.getState().sleeve.purchased as Record<string, number>).one = 2;
    expect(g.isBuyableAvailable('late')).toBe(false);
    expect(g.buy('two')).toBe('purchased');
    expect(g.isBuyableAvailable('late')).toBe(true);
  });
  it('validates whole nonnegative requirements against the configured skill count', () => {
    for (const requiresSleeveSkills of [-1, 0.5, NaN, Infinity, 3]) {
      expect(validateConfig(withBuyables([...skills, { ...late, requiresSleeveSkills }])).join(' ')).toContain('requiresSleeveSkills');
    }
    expect(validateConfig(withBuyables([late])).join(' ')).toContain('requiresSleeveSkills');
    expect(validateConfig(withBuyables([...skills, late]))).toEqual([]);
  });
});
