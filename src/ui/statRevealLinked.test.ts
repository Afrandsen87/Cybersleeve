/**
 * Heat and ICE Rating are revealed together: whatever reveals one reveals the other.
 */
import { game } from '../testing/gameKit';
import { describe, expect, it } from 'vitest';
import { num } from '../numbers';
import { legendAction, payoutAction, setCredits, testConfig } from '../testing/testConfig';
import { buildViewModel } from './viewModel';

const shown = (g: ReturnType<typeof game>): string[] =>
  buildViewModel(g)
    .sleeve.stats.filter((s) => !s.hidden)
    .map((s) => s.id);
const linked = (g: ReturnType<typeof game>): string[] =>
  shown(g)
    .filter((id) => id === 'heat' || id === 'iceRating')
    .sort();
const iceBoost = {
  id: 'ice-boost',
  name: 'ICE boost',
  description: '',
  cost: num(1),
  effect: { kind: 'iceRatingMultiplier', factor: 2 },
} as const;
const unlock = { id: 'unlock', name: 'Unlock', description: '', cost: num(1), effect: { kind: 'accessLevel', amount: 1 } } as const;

describe('heat and ICE Rating appear together', () => {
  it('a new game shows neither', () => {
    expect(linked(game())).toEqual([]);
  });

  it('an open action that makes heat shows ICE Rating too', () => {
    expect(linked(game({ actions: [testConfig.actions[0]!, payoutAction] }))).toEqual(['heat', 'iceRating']);
  });

  it('an owned ICE Rating purchase shows Heat too', () => {
    const g = game({ buyables: [...testConfig.buyables, iceBoost] });
    expect(linked(g)).toEqual([]);
    setCredits(g, num(1));
    g.buy('ice-boost');
    expect(linked(g)).toEqual(['heat', 'iceRating']);
  });

  it('opening a locked heat-making action shows both at the same moment', () => {
    const g = game({ actions: [testConfig.actions[0]!, legendAction], buyables: [...testConfig.buyables, unlock] });
    expect(linked(g)).toEqual([]);
    setCredits(g, num(1));
    g.buy('unlock');
    expect(linked(g)).toEqual(['heat', 'iceRating']);
  });
});
