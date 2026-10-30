/**
 * Heat, ICE Rating and Legend stay hidden until something that makes or boosts them is unlocked.
 */
import { createGame } from '../app/createGame';
import { game } from '../testing/gameKit';
import { describe, expect, it } from 'vitest';
import { createConfig } from '../core';
import { num } from '../numbers';
import * as modes from './modesKit';
import { killAction, legendAction, payoutAction, setCredits, testConfig } from '../testing/testConfig';
import { buildViewModel } from './viewModel';

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
    (g.getState() as unknown as { sleeve: { heat: number } }).sleeve.heat = 3;
    expect(shown(g)).toContain('heat');
  });
});

describe('heat with an Overclock on offer', () => {
  const oc = (heatPerMinute: number) => {
    const base = modes.config.actions[0]!;
    return createConfig(modes.config, {
      actions: [{ ...base, overclock: { speedBonus: 0.5, heatPerMinute } }, modes.config.actions[1]!],
    });
  };

  it('heat exists once Auto-run is owned and the shown Overclock makes heat, before the Overclock is bought', () => {
    const g = createGame({ config: oc(1) });
    expect(shown(g)).not.toContain('heat');
    modes.own(g, 'auto');
    expect(shown(g)).toContain('heat');
  });

  it('an Overclock that makes no heat does not reveal heat', () => {
    const g = createGame({ config: oc(0) });
    modes.own(g, 'auto');
    expect(shown(g)).not.toContain('heat');
  });
});
