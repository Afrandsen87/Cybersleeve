/**
 * The corporation lane of the re-sleeve skills (Synthetic Workers, Synthetic Procurement), tested on a small configuration.
 */
import { describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { createConfig, validateConfig } from './index';
import { resleeveSkill, resleeveTimes, tryBuy } from './resleeveSkillsKit';
import { testConfig } from '../testing/testConfig';

const skills = [
  resleeveSkill('syn', { kind: 'synthSleeves' }),
  resleeveSkill('inc', { kind: 'unlocksCorporation' }),
  resleeveSkill('workers', { kind: 'corporationSpeedPerLnSynths', perLn: 0.1 }, 1, ['inc']),
  resleeveSkill('procure', { kind: 'unlocksSynthPurchase' }, 1, ['workers']),
];
const config = createConfig(testConfig, {
  buyables: [...testConfig.buyables, ...skills],
  corporation: { actions: [{ id: 'c1', name: 'C1', baseDurationMs: 30_000, effects: [] }] },
});

/** A game that owns the skills named, re-sleeving for the points. */
function gameWith(ids: string[]): ReturnType<typeof createGame> {
  const g = createGame({ config });
  for (const id of ids) {
    resleeveTimes(g, 1);
    expect(tryBuy(g, id), id).toBe('purchased');
  }
  return g;
}

describe('Synthetic Workers', () => {
  it('is valid content, and rejects a speed of 0', () => {
    expect(validateConfig(config)).toEqual([]);
    const bad = createConfig(config, {
      buyables: [...testConfig.buyables, resleeveSkill('w', { kind: 'corporationSpeedPerLnSynths', perLn: 0 })],
    });
    expect(validateConfig(bad).join()).toContain('perLn must be > 0');
  });

  it('speeds corporation runs up with ln(1 + synthetic sleeves), and not at all without any', () => {
    const g = gameWith(['inc']);
    const base = g.corporationRunMs('c1');
    expect(base).toBe(30_000);
    resleeveTimes(g, 1);
    expect(tryBuy(g, 'workers')).toBe('purchased');
    expect(g.corporationRunMs('c1'), 'no synthetic sleeves yet').toBe(base);
    resleeveTimes(g, 1);
    expect(tryBuy(g, 'syn')).toBe('purchased'); // one synthetic sleeve, copied from the last run
    expect(g.synthCount()).toBe(1);
    expect(g.corporationRunMs('c1')).toBeCloseTo(base / (1 + 0.1 * Math.log(2)), 6);
    resleeveTimes(g, 3);
    expect(g.synthCount()).toBe(4);
    expect(g.corporationRunMs('c1')).toBeCloseTo(base / (1 + 0.1 * Math.log(5)), 6);
  });

  it('does not touch the speed of the character actions', () => {
    const g = gameWith(['inc', 'workers', 'syn']);
    const plain = createGame({ config });
    expect(g.currentSpeed('a')).toBe(plain.currentSpeed('a'));
  });
});

describe('Synthetic Procurement', () => {
  it('is only an unlock: it opens the option on the Corporation tab and nothing else', () => {
    const g = gameWith(['inc', 'workers']);
    expect(g.synthPurchaseUnlocked()).toBe(false);
    resleeveTimes(g, 1);
    expect(tryBuy(g, 'procure')).toBe('purchased');
    expect(g.synthPurchaseUnlocked()).toBe(true);
    expect(g.synthCount()).toBe(0);
  });

  it('is kept through re-sleeving like every re-sleeve skill', () => {
    const g = gameWith(['inc', 'workers', 'procure']);
    resleeveTimes(g, 1);
    expect(g.synthPurchaseUnlocked()).toBe(true);
  });
});
