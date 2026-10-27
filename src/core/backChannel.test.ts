import { describe, expect, it } from 'vitest';
import { numberFactory } from '../numbers';
import { testConfig } from '../testing/testConfig';
import { BackChannel } from './backChannel';
import { Inventory } from './inventory';
import { createInitialState } from './state';
import type { BackChannelRule } from './leverageEffects';

const rule: BackChannelRule = { itemId: 'file', molesByRarity: { common: 5 }, cooldownBoost: 2 };

const setup = (channel: BackChannelRule | null) => {
  const state = createInitialState(testConfig, numberFactory);
  const inventory = new Inventory(testConfig, state, numberFactory);
  inventory.add('file', 'common', 3);
  inventory.add('file', 'rare', 2);
  return { state, back: new BackChannel(state, { backChannel: () => channel }, inventory) };
};

describe('BackChannel', () => {
  it('turns the named stack into Moles, molesPerItem each, and takes the items', () => {
    const { state, back } = setup(rule);
    expect(back.giveUp('file', 'common', 2)).toBe(2);
    expect(state.moles).toBe(10);
    expect(state.inventory['file']!['common']).toBe(1);
    expect(back.giveUp('file', 'common', 'all')).toBe(1);
    expect(state.moles).toBe(15);
  });

  it('does nothing without a channel, or for another rarity or item', () => {
    const none = setup(null);
    expect(none.back.giveUp('file', 'common', 1)).toBe(0);
    const some = setup(rule);
    expect(some.back.giveUp('file', 'rare', 1)).toBe(0);
    expect(some.back.giveUp('other', 'common', 1)).toBe(0);
    expect(some.state.moles).toBe(0);
    expect(some.state.inventory['file']!['rare']).toBe(2);
  });
});
