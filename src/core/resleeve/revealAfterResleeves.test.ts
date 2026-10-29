/**
 * `revealAfterResleeves`: a buyable that is unavailable until the player has re-sleeved that many times (finished sleeve-runs).
 */
import { describe, expect, it } from 'vitest';
import { createGame } from '../../app/createGame';
import { num } from '../../numbers';
import { markResleeved } from '../../testing/sleeveLevelsKit';
import { setCredits, testConfig } from '../../testing/testConfig';
import { createConfig, validateConfig } from '../config/config';
import type { BuyableDefinition } from '../types';

const late: BuyableDefinition = {
  id: 'late',
  name: 'Late',
  description: '',
  cost: num(1),
  revealAfterResleeves: 1,
  effect: { kind: 'accessLevel', amount: 1 },
};
const config = createConfig(testConfig, { buyables: [...testConfig.buyables, late] });

describe('revealAfterResleeves', () => {
  it('is unavailable and cannot be bought in the first sleeve run', () => {
    const g = createGame({ config });
    setCredits(g, num(100));
    expect(g.isBuyableAvailable('late')).toBe(false);
    expect(g.canBuy('late')).toBe(false);
    expect(g.buy('late')).toBe('locked');
  });

  it('becomes available and buyable after the first re-sleeve (the second sleeve run)', () => {
    const g = createGame({ config });
    markResleeved(g);
    setCredits(g, num(100));
    expect(g.isBuyableAvailable('late')).toBe(true);
    expect(g.buy('late')).toBe('purchased');
  });

  it('is rejected by validation when negative or fractional', () => {
    for (const bad of [-1, 0.5]) {
      const errors = validateConfig(
        createConfig(testConfig, { buyables: [...testConfig.buyables, { ...late, revealAfterResleeves: bad }] }),
      );
      expect(errors.join('\n')).toContain('revealAfterResleeves');
    }
    expect(validateConfig(config)).toEqual([]);
  });
});
