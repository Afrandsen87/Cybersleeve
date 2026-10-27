/**
 * What the screen hides until the sleeve-levels unlock is bought: the sleeve XP bars, the Re-sleeve button and the re-sleeve skill tree;
 * and the skill texts, which stay masked until the first re-sleeve.
 */
import { describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { createConfig } from '../core';
import { num } from '../numbers';
import { setCredits, testConfig } from '../testing/testConfig';
import { buildViewModel } from './viewModel';

const gate = { id: 'levels', name: 'Sleeve levels', description: '', cost: num(10), effect: { kind: 'unlockSleeveLevels' } } as const;
const skill = {
  id: 'skill',
  name: 'Secret skill',
  description: 'Does a secret thing.',
  cost: num(1),
  currency: 'resleevePoints',
  effect: { kind: 'placeholder' },
} as const;

const game = () =>
  createGame({
    config: createConfig(testConfig, {
      buyables: [...testConfig.buyables, gate, skill],
      resleeve: { ...testConfig.resleeve, lockoutMs: 5_000 },
    }),
  });

describe('the screen before the sleeve-levels unlock', () => {
  it('hides the sleeve XP bars, the Re-sleeve button and the skill tree', () => {
    const vm = buildViewModel(game());
    expect(vm.actions.every((a) => !a.sleeveShown)).toBe(true);
    expect(vm.resleeveShown).toBe(false);
    expect(vm.skills.resleeve.visible).toBe(false);
    expect(vm.tabs.find((t) => t.id === 'skills')!.visible).toBe(false);
  });
});

describe('the screen after buying it', () => {
  it('shows all three, with the Re-sleeve button disabled for the lockout', () => {
    const g = game();
    setCredits(g, num(100));
    g.buy('levels');
    const vm = buildViewModel(g);
    expect(vm.actions.every((a) => a.sleeveShown)).toBe(true);
    expect(vm.resleeveShown).toBe(true);
    expect(vm.canResleeve).toBe(false);
    expect(vm.skills.resleeve.visible).toBe(true);
    g.tick(5_000);
    expect(buildViewModel(g).canResleeve).toBe(true);
  });

  it('masks the text of the re-sleeve skills until the first re-sleeve, then shows it', () => {
    const g = game();
    setCredits(g, num(100));
    g.buy('levels');
    const find = () =>
      buildViewModel(g)
        .skills.resleeve.tiers.flat()
        .find((b) => b.id === 'skill')!;
    const before = find();
    expect(before.name).toBe('???');
    expect(before.description).toBe('???');
    expect(before.tip).toBe('???');
    g.tick(5_000);
    g.resleeve();
    const after = find();
    expect(after.name).toBe('Secret skill');
    expect(after.description).toBe('Does a secret thing.');
  });
});
