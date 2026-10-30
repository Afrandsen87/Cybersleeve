/**
 * The corporation behind its keyed-by-id surface (S10): the synth boost it asks for, the optional ids on the queries, and the save key.
 */
import { describe, expect, it } from 'vitest';
import { createGame } from '../../app/createGame';
import { createConfig } from '..';
import type { GameQueries } from '../engine/api';
import { numberFactory } from '../../numbers';
import { resleeveSkill } from '../../testing/resleeveSkillsKit';
import { testConfig } from '../../testing/testConfig';
import { Corporation } from './corporation';
import { CorporationLevels } from './corporationLevels';
import { DEFAULT_CORPORATION_ID } from '../kernel/savePart';
import { synthBoost } from '../kernel/curves';
import { serializeState } from '../save/serialization';
import { createInitialState } from '../save/state';
import { SynthSleeves } from '../synth/synthSleeves';

const factory = numberFactory;
const config = createConfig(testConfig, {
  buyables: [
    ...testConfig.buyables,
    resleeveSkill('inc', { kind: 'unlocksCorporation' }),
    resleeveSkill('workers', { kind: 'corporationSpeedPerLnSynths', perLn: 0.1 }),
  ],
  corporation: { actions: [{ id: 'c1', name: 'C1', baseDurationMs: 30_000, effects: [] }] },
});

/** A Corporation on a fresh state with the given boost, and that state. */
function corporationWith(boost: (perLn: number, copies: number) => number, owned: Record<string, number> = {}) {
  const state = createInitialState(config, factory);
  Object.assign(state.sleeve.purchased, owned);
  const effects = { state, inventory: undefined as never, random: undefined as never, rarityIds: [] };
  return { state, corp: new Corporation(config, state, effects, new CorporationLevels(config, state, factory), { boost }) };
}

describe('Corporation reads the synthetic sleeves through SynthQueries.boost only', () => {
  it('uses the boost it is given, once per owned Synthetic Workers skill', () => {
    const asked: [number, number][] = [];
    const { corp } = corporationWith(
      (perLn, copies) => {
        asked.push([perLn, copies]);
        return 4;
      },
      { workers: 2 },
    );
    expect(corp.workersFactor()).toBe(4);
    expect(asked).toEqual([[0.1, 2]]);
    expect(corp.durationMs('c1')).toBe(30_000 / 4);
  });

  it('is not sped up by a skill that is not owned, whatever the boost says', () => {
    const { corp } = corporationWith(() => 99);
    expect(corp.workersFactor()).toBe(1);
    expect(corp.durationMs('c1')).toBe(30_000);
  });
});

describe('SynthSleeves.boost', () => {
  it('is the shared synthBoost of the sleeve count: 1 without sleeves or copies, above 1 with both', () => {
    const state = createInitialState(config, factory);
    const synths = new SynthSleeves(config, state, undefined as never, factory);
    expect(synths.boost(0.1, 3)).toBe(1);
    state.wallet.synths.push({ runIndex: 0 }, { runIndex: 0 });
    expect(synths.boost(0.1, 0)).toBe(1);
    expect(synths.boost(0.1, 3)).toBeCloseTo(synthBoost(0.1, 2, 3), 12);
    expect(synths.boost(0.1, 3)).toBeGreaterThan(1);
  });
});

describe('ids on the queries are optional and ignored while there is one of each', () => {
  it('answers the same for any corporation id and any sleeve id', () => {
    const g: GameQueries = createGame({ config });
    expect(g.corporationRunMs('c1', 'other')).toBe(g.corporationRunMs('c1'));
    expect(g.corporationActions('other')).toEqual(g.corporationActions());
    expect(g.isCorporationUnlocked('other')).toBe(g.isCorporationUnlocked());
    expect(g.sleeveStats('other')).toEqual(g.sleeveStats());
    expect(g.canResleeve('other')).toBe(g.canResleeve());
  });

  it('saves the one corporation under DEFAULT_CORPORATION_ID in the wallet, unchanged from before', () => {
    const saved = JSON.parse(serializeState(createInitialState(config, factory)));
    expect(Object.keys(saved.wallet.corporations)).toEqual([DEFAULT_CORPORATION_ID]);
    expect(DEFAULT_CORPORATION_ID).toBe('main');
  });
});
