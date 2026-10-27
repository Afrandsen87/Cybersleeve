/**
 * Heat, ICE Rating and Legend stay hidden until something that makes or boosts them is unlocked.
 */
import { describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { createConfig } from '../core';
import { num } from '../numbers';
import { killAction, legendAction, payoutAction, setCredits, testConfig } from '../testing/testConfig';
import { buildViewModel } from './viewModel';

const game = (overrides = {}) => createGame({ config: createConfig(testConfig, overrides) });
const shown = (g: ReturnType<typeof game>): string[] =>
  buildViewModel(g)
    .sleeve.stats.filter((s) => !s.hidden)
    .map((s) => s.id);

const unlock = { id: 'unlock', name: 'Unlock', description: '', cost: num(1), effect: { kind: 'accessLevel', amount: 1 } } as const;
const iceBoost = {
  id: 'ice-boost',
  name: 'ICE boost',
  description: '',
  cost: num(1),
  effect: { kind: 'iceRatingMultiplier', factor: 2 },
} as const;
const ac = { actions: [testConfig.actions[0]!, legendAction], buyables: [...testConfig.buyables, unlock] };

describe('hidden stats', () => {
  it('a new game shows no Heat, ICE Rating or Legend', () => {
    expect(shown(game())).toEqual(['access', 'interfaceSpeed', 'hackingProficiency']);
  });

  it('Heat appears with an open action that makes heat, and stays hidden while that action is locked', () => {
    expect(shown(game({ actions: [testConfig.actions[0]!, payoutAction] }))).toContain('heat');
    const locked = game(ac);
    expect(shown(locked)).not.toContain('heat');
    setCredits(locked, num(1));
    locked.buy('unlock');
    expect(shown(locked)).toContain('heat');
  });

  it('Legend appears with the open action that earns it, and not before', () => {
    const g = game(ac);
    expect(shown(g)).not.toContain('legend');
    setCredits(g, num(1));
    g.buy('unlock');
    expect(shown(g)).toContain('legend');
  });

  it('ICE Rating appears with an owned purchase that boosts it, or with an open action that earns it', () => {
    const g = game({ buyables: [...testConfig.buyables, iceBoost] });
    expect(shown(g)).not.toContain('iceRating');
    setCredits(g, num(1));
    g.buy('ice-boost');
    expect(shown(g)).toContain('iceRating');
    expect(shown(game({ actions: [testConfig.actions[0]!, killAction] }))).toContain('iceRating');
  });

  it('a stat that already moved off its start is never hidden (a loaded save)', () => {
    const g = game();
    (g.getState() as { heat: number }).heat = 3;
    expect(shown(g)).toContain('heat');
  });
});
