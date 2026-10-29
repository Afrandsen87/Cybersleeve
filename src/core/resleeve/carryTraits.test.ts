/**
 * What a re-sleeve carries, as data on the effect registry (`carriedOverResleeve` trait, `carry` hook).
 *
 * Purpose: the lists used to compare effect kind names; now they are registry facts, so these tests state the invariants (not the tuning).
 * Called by: vitest. Calls: `EFFECTS`, `resetForResleeve`, `createInitialState`, the test config.
 */
import { describe, expect, it } from 'vitest';
import { EFFECTS } from '../effects/effectRegistry';
import { numberFactory } from '../../numbers';
import { createConfig } from '../config/config';
import { createInitialState, resetForResleeve } from '../save/state';
import type { BuyableDefinition } from '../types';
import { testConfig } from '../../testing/testConfig';

const kinds = Object.keys(EFFECTS) as (keyof typeof EFFECTS)[];

describe('carry data', () => {
  it('a kind that carries something is sleeve-wide (it names no action)', () => {
    for (const kind of kinds) {
      const def = EFFECTS[kind];
      if (def.carry !== undefined || def.traits.carriedOverResleeve) expect(def.traits.needsAction, kind).toBe(false);
    }
  });

  it('a carried kind is not a toggle (a switch would reset or not by accident)', () => {
    for (const kind of kinds) if (EFFECTS[kind].traits.carriedOverResleeve) expect(EFFECTS[kind].traits.toggleable, kind).toBe(false);
  });

  it('at least the sleeve-levels unlock and the corporation are on the carried list', () => {
    const carried = kinds.filter((k) => EFFECTS[k].traits.carriedOverResleeve);
    expect(carried).toEqual(expect.arrayContaining(['unlockSleeveLevels', 'corporateRank', 'addsCorporationEffect']));
  });

  it('a buyable of a carried kind keeps all its copies over a re-sleeve; one of another kind does not', () => {
    const base = testConfig.buyables[0] as BuyableDefinition;
    const carried: BuyableDefinition = { ...base, id: 'carried', effect: { kind: 'unlockSleeveLevels' }, currency: 'credits' };
    const plain: BuyableDefinition = { ...base, id: 'plain', effect: { kind: 'placeholder' }, currency: 'credits' };
    const config = createConfig(testConfig, { buyables: [carried, plain] });
    const state = createInitialState(config, numberFactory);
    state.sleeve.purchased['carried'] = 3;
    state.sleeve.purchased['plain'] = 2;
    resetForResleeve(state, config, numberFactory);
    expect(state.sleeve.purchased).toEqual({ carried: 3 });
  });
});
