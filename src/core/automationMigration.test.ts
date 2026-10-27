import { describe, expect, it } from 'vitest';
import { num, numberFactory } from '../numbers';
import { automationLaneBuyables } from '../testing/automationKit';
import { testConfig } from '../testing/testConfig';
import { SAVE_VERSION, createConfig, createInitialState, deserializeState, isFeatureUnlocked, serializeState } from './index';

/** Test content: the automation point buyable `core` and a lane of skills per feature. */
const config = createConfig(testConfig, {
  buyables: [
    ...testConfig.buyables,
    { id: 'core', name: 'Core', description: '', cost: num(1), maxPurchases: Infinity, effect: { kind: 'automationPoints', perCopy: 1 } },
    ...automationLaneBuyables(),
  ],
  automation: { autoBurnCeiling: 10 },
});

/** A save in the version 4 format: the unlocked features were flags in `automation.unlocked`, paid with one point each. */
function versionFourSave(unlocked: Record<string, boolean>): string {
  const data = JSON.parse(serializeState(createInitialState(config, numberFactory)));
  data.version = 4;
  data.purchased = { core: 2 };
  data.automation = { unlocked, autoBurnOn: true, autoBurnCeiling: 7, autosale: { rare: true }, dispersal: {} };
  return JSON.stringify(data);
}

describe('reading a version 4 save (unlocked features were flags)', () => {
  it('each unlocked feature becomes the owned first skill of its lane, and the settings are kept', () => {
    const restored = deserializeState(versionFourSave({ autoBurn: true, autosale: true }), config, numberFactory)!;
    expect(isFeatureUnlocked(config.buyables, restored.purchased, 'autoBurn')).toBe(true);
    expect(isFeatureUnlocked(config.buyables, restored.purchased, 'autosale')).toBe(true);
    expect(isFeatureUnlocked(config.buyables, restored.purchased, 'dispersal')).toBe(false);
    expect(restored.purchased['core']).toBe(2);
    expect(restored.automation.autoBurnOn).toBe(true);
    expect(restored.automation.autoBurnCeiling).toBe(7);
    expect(restored.automation.autosale).toEqual({ rare: true });
  });

  it('a migrated save is saved again in the current version, and that loads unchanged', () => {
    const restored = deserializeState(versionFourSave({ dispersal: true }), config, numberFactory)!;
    const text = serializeState(restored);
    expect(JSON.parse(text).version).toBe(SAVE_VERSION);
    expect(serializeState(deserializeState(text, config, numberFactory)!)).toBe(text);
  });

  it('a feature that was not unlocked stays locked, and its settings are dropped', () => {
    const restored = deserializeState(versionFourSave({}), config, numberFactory)!;
    expect(Object.keys(restored.purchased)).toEqual(['core']);
    expect(restored.automation.autoBurnOn).toBe(false);
    expect(restored.automation.autosale).toEqual({});
  });
});
