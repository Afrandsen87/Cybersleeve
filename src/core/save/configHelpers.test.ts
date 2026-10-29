/**
 * Config helpers: createConfig and validateConfig.
 */
import { describe, expect, it } from 'vitest';
import { num, numberFactory } from '../../numbers';
import { testConfig } from '../../testing/testConfig';
import { LevelRule, createConfig, createInitialState, validateConfig, type LevelRuleConfig } from '..';

const config = testConfig;
const _rule = (c: LevelRuleConfig) => new LevelRule(c, numberFactory);

describe('config helpers', () => {
  it('the test configuration is valid', () => {
    expect(validateConfig(config)).toEqual([]);
  });

  it('createConfig overrides sections field by field and leaves the base untouched', () => {
    const c = createConfig(config, { global: { speedMultiplier: 5 }, progression: { startingCredits: 100 } });
    expect(c.global.speedMultiplier).toBe(5);
    expect(c.global.costMultiplier).toBe(1);
    expect(c.progression.startingCredits).toBe(100);
    expect(c.progression.runsPerSleeveXp).toBe(100);
    expect(config.global.speedMultiplier).toBe(1);
  });

  it('startingCredits seeds a new game', () => {
    const c = createConfig(config, { progression: { startingCredits: 25 } });
    expect(createInitialState(c, numberFactory).wallet.credits.eq(num(25))).toBe(true);
  });

  it('reports every kind of invalid value', () => {
    const bad = createConfig(config, {
      actions: [
        { ...config.actions[0]!, baseDurationMs: 0, requiredAccessLevel: 0, heatPerRun: -1 },
        { ...config.actions[0]!, levels: { firstLevelXp: 0, growthFactor: 1 } },
      ],
      buyables: [
        {
          id: 'x',
          name: 'x',
          description: '',
          actionId: 'nope',
          cost: num(1),
          effect: { kind: 'autoRun' },
          requires: ['ghost', 'x'],
          maxPurchases: 0,
          costGrowth: 0.5,
        },
        { id: 'x', name: 'x', description: '', actionId: 'a', cost: num(-1), effect: { kind: 'rewardMultiplier', factor: 0.5 } },
        { id: 'g1', name: 'g', description: '', actionId: 'a', cost: num(1), effect: { kind: 'interfaceSpeed', amount: -1 } },
        { id: 'g2', name: 'g', description: '', cost: num(1), effect: { kind: 'accessLevel', amount: 0 } },
        { id: 'g3', name: 'g', description: '', cost: num(1), effect: { kind: 'autoRun' } },
      ],
      sleeve: { baseAccessLevel: 0, baseInterfaceSpeed: 0, baseHeat: -1, heatCooldownMs: 0, heatCooldownAmount: 0 },
      progression: { runsPerSleeveXp: 0, sleeveXpPerGrant: 0, startingCredits: -1 },
      speed: { actionLevel: { kind: 'linear', perLevel: 0 }, sleeveLevel: { kind: 'exponential', base: 0.5 } },
      network: { creditsPerNodePerSecond: -1 },
      global: { speedMultiplier: 0, creditMultiplier: -1, xpMultiplier: NaN, costMultiplier: 0 },
      engine: { maxBatchesPerTick: 0 },
      runtime: { stepMs: 0, maxDeltaMs: -1, autosaveMs: 0, fastForwardFactor: 1 },
    });
    const text = validateConfig(bad).join('\n');
    for (const fragment of [
      'duplicate action id',
      'baseDurationMs',
      'firstLevelXp',
      'growthFactor',
      'duplicate buyable id',
      'unknown action',
      'requires unknown buyable "ghost"',
      'cannot require itself',
      'maxPurchases',
      'costGrowth',
      'cost must be >= 0',
      'factor must be >= 1',
      'runsPerSleeveXp',
      'sleeveXpPerGrant',
      'startingCredits',
      'speed.actionLevel.perLevel',
      'speed.sleeveLevel.base',
      'global.speedMultiplier',
      'global.creditMultiplier',
      'global.xpMultiplier',
      'global.costMultiplier',
      'maxBatchesPerTick',
      'runtime.stepMs',
      'runtime.maxDeltaMs',
      'runtime.autosaveMs',
      'fastForwardFactor',
      'network.creditsPerNodePerSecond',
      'needs an actionId',
      'interface speed amount must be >= 0',
      'access level amount must be an integer >= 1',
      'sleeve.baseAccessLevel',
      'sleeve.baseInterfaceSpeed',
      'sleeve.baseHeat',
      'sleeve.heatCooldownMs',
      'sleeve.heatCooldownAmount',
      'requiredAccessLevel must be an integer >= 1',
      'heatPerRun must be >= 0',
    ]) {
      expect(text, fragment).toContain(fragment);
    }
  });
});
