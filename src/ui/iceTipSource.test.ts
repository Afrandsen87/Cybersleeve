/**
 * The ICE Rating tooltip names the purchase that gives the per-level bonus (Hardened payload), not "Level".
 */
import { describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { createConfig } from '../core';
import { num } from '../numbers';
import { setCredits, testConfig } from '../testing/testConfig';
import { buildViewModel } from './viewModel';

const hardened = {
  id: 'hardened',
  name: 'Hardened payload',
  description: '',
  cost: num(1),
  effect: { kind: 'iceRatingFromActionLevel', sourceActionId: 'a', perLevel: 10 },
} as const;

describe('the ICE Rating tip', () => {
  it('calls the bonus by the name of the purchase behind it', () => {
    const g = createGame({ config: createConfig(testConfig, { buyables: [...testConfig.buyables, hardened] }) });
    setCredits(g, num(1));
    g.buy('hardened');
    (g.getState() as { actions: Record<string, { xp: unknown }> }).actions['a']!.xp = num(1e9); // some action levels for the per-level bonus
    const tip = buildViewModel(g).sleeve.stats.find((s) => s.id === 'iceRating')!.tip!;
    expect(tip).toContain('(Earned + Hardened payload)');
    expect(tip).toContain('Hardened payload = ');
    expect(tip).not.toContain('Level Bonus');
  });
});
