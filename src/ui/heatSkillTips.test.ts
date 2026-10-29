import { describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { createConfig } from '../core';
import { num } from '../numbers';
import { setCredits, testConfig } from '../testing/testConfig';
import { buildViewModel, statRow } from './viewModel';

const skill = (id: string, effect: (typeof testConfig.buyables)[number]['effect']) => ({
  id,
  name: id,
  description: '',
  cost: num(1),
  effect,
});

function game(...skills: ReturnType<typeof skill>[]) {
  const g = createGame({ config: createConfig(testConfig, { buyables: [...testConfig.buyables, ...skills] }) });
  setCredits(g, num(1e6));
  for (const s of skills) g.buy(s.id);
  return g;
}

describe('the heat tip with Blackout', () => {
  const blackout = skill('black', { kind: 'heatTaxCap', maxShare: 0.5 });

  it('names the cap, shows the tax at the cap, and no longer says when credits stop', () => {
    const g = game(blackout);
    (g.getState() as unknown as { sleeve: { heat: number } }).sleeve.heat = 500;
    const tip = statRow(buildViewModel(g).sleeve.stats, 'heat').tip;
    expect(tip).toContain('The Heat Tax takes at most 50%');
    expect(tip).toContain('Heat Tax = 50% of all credits earned from nodes');
    expect(tip).not.toContain('Node credits stop');
  });

  it('says nothing about a cap without the skill', () => {
    const g = game();
    (g.getState() as unknown as { sleeve: { heat: number } }).sleeve.heat = 500;
    expect(statRow(buildViewModel(g).sleeve.stats, 'heat').tip).not.toContain('at most');
  });
});

describe('the heat tip with Deep Cover', () => {
  const deep = skill('deep', { kind: 'moleAggregation', bonusPerOrder: 0.05 });

  it('says how much faster the Moles held make heat cool', () => {
    const g = game(deep);
    (g.getState() as unknown as { sleeve: { moles: number } }).sleeve.moles = 100;
    const tip = statRow(buildViewModel(g).sleeve.stats, 'heat').tip;
    expect(tip).toContain('100 Moles make it 10.25% faster'); // 1.05^2 - 1
  });
});
