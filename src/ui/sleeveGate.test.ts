/**
 * What the screen hides until the two re-sleeve unlocks are bought: the sleeve XP bars and the Re-sleeve button wait for Sleeve levels, the
 * permission to re-sleeve waits for Unlock resleeving, and the re-sleeve skill trees wait for the first earned re-sleeve point; the skill
 * texts stay masked until the first re-sleeve.
 */
import { describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { createConfig } from '../core';
import { num } from '../numbers';
import { setCredits, testConfig } from '../testing/testConfig';
import { buildViewModel } from './viewModel';
import { skillViews } from '../testing/skillViews';

const levels = { id: 'levels', name: 'Sleeve levels', description: '', cost: num(10), effect: { kind: 'unlockSleeveLevels' } } as const;
const unlock = {
  id: 'unlock',
  name: 'Unlock resleeving',
  description: '',
  cost: num(10),
  requires: ['levels'],
  effect: { kind: 'unlockResleeve' },
} as const;
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
      buyables: [...testConfig.buyables, levels, unlock, skill],
      resleeve: { ...testConfig.resleeve, lockoutMs: 5_000 },
    }),
  });

/** Buys both unlocks and waits out the lockout. */
const open = (g: ReturnType<typeof game>): void => {
  setCredits(g, num(100));
  g.buy('levels');
  g.buy('unlock');
  g.tick(5_000);
};

describe('the screen before either unlock', () => {
  it('hides the sleeve XP bars, the Re-sleeve button and the re-sleeve skill trees', () => {
    const vm = buildViewModel(game());
    expect(vm.actions.every((a) => !a.sleeveShown)).toBe(true);
    expect(vm.resleeveShown).toBe(false);
    expect(vm.resleeveBuy).toBeNull();
    expect(vm.skills.resleeve.visible).toBe(false);
    expect(vm.tabs.find((t) => t.id === 'skills')!.visible).toBe(false);
  });
});

describe('the screen after buying Sleeve levels', () => {
  it('shows the sleeve XP bars and the Re-sleeve button, as the purchase of Unlock resleeving, but not the re-sleeve trees', () => {
    const g = game();
    setCredits(g, num(100));
    g.buy('levels');
    const vm = buildViewModel(g);
    expect(vm.actions.every((a) => a.sleeveShown)).toBe(true);
    expect(vm.resleeveShown).toBe(true);
    expect(vm.resleeveBuy).toMatchObject({ id: 'unlock', affordable: true });
    expect(vm.sleeve.buyables.map((b) => b.id)).toContain('levels');
    expect(vm.sleeve.buyables.map((b) => b.id)).not.toContain('unlock');
    expect(vm.canResleeve).toBe(false);
    expect(vm.skills.resleeve.visible).toBe(false);
  });
});

describe('the screen after buying Unlock resleeving', () => {
  it('turns the button into Re-sleeve, disabled for the lockout', () => {
    const g = game();
    setCredits(g, num(100));
    g.buy('levels');
    g.buy('unlock');
    const vm = buildViewModel(g);
    expect(vm.resleeveBuy).toBeNull();
    expect(vm.canResleeve).toBe(false);
    g.tick(5_000);
    expect(buildViewModel(g).canResleeve).toBe(true);
  });
});

describe('the re-sleeve skill trees', () => {
  it('show once a re-sleeve point has been earned, not when an unlock is bought', () => {
    const g = game();
    open(g);
    expect(buildViewModel(g).skills.resleeve.visible).toBe(false);
    g.resleeve();
    const vm = buildViewModel(g);
    expect(vm.skills.resleeve.visible).toBe(true);
    expect(vm.tabs.find((t) => t.id === 'skills')!.visible).toBe(true);
  });

  it('mask the text of the skills until the first re-sleeve, then show it', () => {
    const g = game();
    open(g);
    const find = () => skillViews(buildViewModel(g).skills.resleeve.lanes).find((b) => b.id === 'skill')!;
    const before = find();
    expect(before.name).toBe('???');
    expect(before.description).toBe('???');
    expect(before.tip).toBe('???');
    g.resleeve();
    const after = find();
    expect(after.name).toBe('Secret skill');
    expect(after.description).toBe('Does a secret thing.');
  });
});
