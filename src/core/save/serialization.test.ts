/**
 * serializeState / deserializeState: round trips and defensive loading.
 */
import { describe, expect, it } from 'vitest';
import { num, numberFactory } from '../../numbers';
import { testConfig } from '../../testing/testConfig';
import { LevelRule, createConfig, createInitialState, deserializeState, serializeState, SAVE_VERSION, type LevelRuleConfig } from '..';
import { asSave, flatSave } from '../../testing/saveKit';

const config = testConfig;
const _rule = (c: LevelRuleConfig) => new LevelRule(c, numberFactory);

describe('serialization', () => {
  it('round-trips a state including huge numbers and copy counts', () => {
    const s = createInitialState(config, numberFactory);
    s.wallet.credits = num('1.5e400');
    s.sleeve.network = num(33);
    s.sleeve.actions['a'] = {
      xp: num(77),
      sleeveXp: num(12),
      runsTowardSleeveXp: 42,
      augments: { common: 3 },
      skillShards: 2,
      running: true,
      progress: 0.25,
    };
    s.sleeve.purchased['auto'] = 1;
    s.sleeve.purchased['dual'] = 1;
    s.sleeve.purchased['dup'] = 7;

    const restored = deserializeState(serializeState(s), config, numberFactory)!;
    expect(restored.wallet.credits.eq(s.wallet.credits)).toBe(true);
    expect(restored.sleeve.network.eq(num(33))).toBe(true);
    expect(restored.sleeve.actions['a']!.sleeveXp.eq(num(12))).toBe(true);
    expect(restored.sleeve.actions['a']!.runsTowardSleeveXp).toBe(42);
    expect(restored.sleeve.actions['a']!.xp.eq(num(77))).toBe(true);
    expect(restored.sleeve.actions['a']!.running).toBe(true);
    expect(restored.sleeve.actions['a']!.progress).toBe(0.25);
    expect(restored.sleeve.purchased).toEqual({ auto: 1, dual: 1, dup: 7 });
  });

  it.each([0, 1, 2, 7, 99, '5', null])(
    'refuses a save of another format version (%j): the game starts over instead of guessing',
    (version) => {
      const json = flatSave(serializeState(createInitialState(config, numberFactory)));
      json.version = version;
      expect(deserializeState(asSave(json), config, numberFactory)).toBeNull();
    },
  );

  it('round-trips heat, and a save without heat loads with 0', () => {
    const s = createInitialState(config, numberFactory);
    s.sleeve.heat = 13;
    s.sleeve.heatCooldownMs = 42_000;
    const restored = deserializeState(serializeState(s), config, numberFactory)!;
    expect(restored.sleeve.heat).toBe(13);
    expect(restored.sleeve.heatCooldownMs).toBe(42_000);
    const old = flatSave(serializeState(s));
    delete old.heat;
    delete old.heatCooldownMs;
    const legacy = deserializeState(asSave(old), config, numberFactory)!;
    expect(legacy.sleeve.heat).toBe(0);
    expect(legacy.sleeve.heatCooldownMs).toBe(0);
  });

  it('keeps owned global buyables across save and load', () => {
    const s = createInitialState(config, numberFactory);
    s.sleeve.purchased['speed'] = 1;
    s.sleeve.purchased['access'] = 1;
    const restored = deserializeState(serializeState(s), config, numberFactory)!;
    expect(restored.sleeve.purchased).toEqual({ speed: 1, access: 1 });
  });

  it("keeps each action's own sleeve xp in saved games", () => {
    const two = createConfig(config, { actions: [config.actions[0]!, { ...config.actions[0]!, id: 'b' }] });
    const s = createInitialState(two, numberFactory);
    s.sleeve.actions['a']!.sleeveXp = num(1);
    s.sleeve.actions['b']!.sleeveXp = num(2);
    const restored = deserializeState(serializeState(s), two, numberFactory)!;
    expect(restored.sleeve.actions['a']!.sleeveXp.eq(num(1))).toBe(true);
    expect(restored.sleeve.actions['b']!.sleeveXp.eq(num(2))).toBe(true);
  });

  it('caps stored copy counts at maxPurchases for one-time buyables', () => {
    const json = JSON.stringify({
      version: SAVE_VERSION,
      wallet: { credits: '0' },
      sleeves: { main: { network: '0', actions: {}, purchased: { auto: 5, dual: 1, dup: 3 } } },
    });
    expect(deserializeState(json, config, numberFactory)!.sleeve.purchased).toEqual({ auto: 1, dual: 1, dup: 3 });
  });

  it('returns null for corrupt or incompatible input', () => {
    expect(deserializeState('not json', config, numberFactory)).toBeNull();
    expect(deserializeState('{"version":999}', config, numberFactory)).toBeNull();
    expect(deserializeState(`{"version":${SAVE_VERSION},"wallet":{"credits":5}}`, config, numberFactory)).toBeNull();
  });

  it('ignores unknown ids and fills in missing ones', () => {
    const json = JSON.stringify({
      version: SAVE_VERSION,
      wallet: { credits: '5' },
      sleeves: {
        main: {
          network: '0',
          actions: { ghost: { xp: '9', sleeveXp: '0', runsTowardSleeveXp: 0, running: true, progress: 0.5 } },
          purchased: { 'ghost-buyable': 1, dual: 1 },
        },
      },
    });
    const s = deserializeState(json, config, numberFactory)!;
    expect(Object.keys(s.sleeve.actions)).toEqual(['a']);
    expect(s.sleeve.actions['a']!.xp.isZero()).toBe(true);
    expect(s.sleeve.purchased).toEqual({ dual: 1 });
  });
});
