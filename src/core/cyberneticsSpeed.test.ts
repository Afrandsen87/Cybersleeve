import { describe, expect, it } from 'vitest';
import { num } from '../numbers';
import { buy, cyberneticsConfig, cyberneticsGame, setAugments } from '../testing/cyberneticsKit';
import { distinctAugmentRarities } from './augments';
import { validateConfig } from './index';

describe('distinctAugmentRarities', () => {
  const none = { augments: {} };

  it('is 0 without augments, and a rarity with count 0 does not count', () => {
    expect(distinctAugmentRarities({ a: none, b: { augments: { common: 0 } } })).toBe(0);
  });

  it('counts a rarity once however many augments or actions hold it', () => {
    expect(distinctAugmentRarities({ a: { augments: { common: 5 } }, b: { augments: { common: 2 } } })).toBe(1);
  });

  it('counts the rarities across all actions together: common on one and uncommon on another is two', () => {
    expect(distinctAugmentRarities({ a: { augments: { common: 1 } }, b: { augments: { uncommon: 1 } } })).toBe(2);
  });

  it('is 1 for an uncommon alone', () => {
    expect(distinctAugmentRarities({ a: { augments: { uncommon: 3 } } })).toBe(1);
  });
});

describe('Neural Accelerant (interfaceSpeedFromAugmentRarities)', () => {
  const accelerant = buy({ id: 'na', effect: { kind: 'interfaceSpeedFromAugmentRarities', perRarity: 0.05 } });
  const owned = () => {
    const g = cyberneticsGame(cyberneticsConfig([accelerant]));
    g.buy('na');
    return g;
  };

  it('does nothing before it is bought, whatever is applied', () => {
    const g = cyberneticsGame(cyberneticsConfig([accelerant]));
    setAugments(g, 'a', { common: 3 });
    expect(g.sleeveStats().interfaceSkillFactor).toBe(1);
  });

  it('does nothing while no augment is applied', () => {
    expect(owned().sleeveStats().interfaceSkillFactor).toBe(1);
  });

  it('gives +5% for one rarity, however many augments of it are applied', () => {
    const g = owned();
    setAugments(g, 'a', { common: 40 });
    expect(g.sleeveStats().interfaceSkillFactor).toBeCloseTo(1.05, 12);
  });

  it('gives +10% for two rarities (additive, not compounding), also when they are on different actions', () => {
    const g = owned();
    setAugments(g, 'a', { common: 1 });
    setAugments(g, 'net', { rare: 1 });
    expect(g.sleeveStats().interfaceSkillFactor).toBeCloseTo(1.1, 12);
  });

  it('is part of the interface speed: base 1 x 1.05', () => {
    const g = owned();
    setAugments(g, 'a', { common: 1 });
    expect(g.sleeveStats().interfaceSpeed).toBeCloseTo(1.05, 12);
  });

  it('stops when the augments are gone (they reset by re-sleeving)', () => {
    const g = owned();
    setAugments(g, 'a', { common: 1 });
    setAugments(g, 'a', {});
    expect(g.sleeveStats().interfaceSkillFactor).toBe(1);
  });

  it('is rejected at 0 or less per rarity', () => {
    const bad = cyberneticsConfig([buy({ id: 'bad', effect: { kind: 'interfaceSpeedFromAugmentRarities', perRarity: 0 } })]);
    expect(validateConfig(bad).join('|')).toContain('interfaceSpeedFromAugmentRarities perRarity must be > 0');
  });
});

describe('Parallel Threads (interfaceSpeedPerLnNodes at a small rate)', () => {
  it('multiplies interface speed by 1 + perLn x ln(nodes): 1000 nodes at 0.002 give about x1.0138', () => {
    const g = cyberneticsGame(cyberneticsConfig([buy({ id: 'pt', effect: { kind: 'interfaceSpeedPerLnNodes', perLn: 0.002 } })]));
    g.buy('pt');
    (g.getState() as { network: unknown }).network = num(1000);
    expect(g.sleeveStats().interfaceNetworkFactor).toBeCloseTo(1 + 0.002 * Math.log(1000), 12);
  });

  it('stays below x2.5 even at the infinity cap of 1e308 (ln about 709)', () => {
    const g = cyberneticsGame(cyberneticsConfig([buy({ id: 'pt', effect: { kind: 'interfaceSpeedPerLnNodes', perLn: 0.002 } })]));
    g.buy('pt');
    (g.getState() as { network: unknown }).network = num('1e308');
    expect(g.sleeveStats().interfaceNetworkFactor).toBeLessThan(2.5);
  });
});
