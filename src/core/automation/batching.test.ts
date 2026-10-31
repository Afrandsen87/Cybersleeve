/** Automation context: tick splitting invariance, following actions/batching.test.ts with cooling disabled. */
import { describe, expect, it } from 'vitest';
import { rarityGame, rarityState } from '../../testing/rarityAutomationKit';

/** Automation context: the existing batch owner consumes entire stacks without count-sized loops. */
describe('auto backchannel batching', () => {
  it('one long tick and split ticks consume the same stock and pay the same Moles', () => {
    const run = (ticks: number) => {
      const g = rarityGame([1, 2, 3, 4, 5, 6]);
      rarityState(g).wallet.inventory['file'] = { common: 123, uncommon: 17, rare: 5 };
      for (const r of ['common', 'uncommon', 'rare']) g.automation().setAutoBackchannel(r, true);
      for (let i = 0; i < ticks; i++) g.tick(60_000 / ticks);
      return { moles: g.getState().sleeve.moles, inventory: g.getState().wallet.inventory };
    };
    expect(run(1)).toEqual(run(60));
  });
});
