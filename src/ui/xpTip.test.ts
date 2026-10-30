// @vitest-environment happy-dom
/**
 * The tips of the level XP and sleeve XP bars: every figure is the owner's, and a factor of 1 is not written.
 *
 * Called by: vitest. Calls: `buildViewModel`, the engine's breakdown and curve queries, the DOM test kit.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { type BuyableDefinition, createConfig } from '../core';
import { formatBigNum, num } from '../numbers';
import { mountTestUi } from '../testing/domMountKit';
import { hoverText } from '../testing/hover';
import { setCredits, testConfig } from '../testing/testConfig';
import { buildViewModel } from './viewModel';

const buyable = (b: Pick<BuyableDefinition, 'id' | 'effect'> & Partial<BuyableDefinition>): BuyableDefinition => ({
  name: b.id,
  description: '',
  cost: num(1),
  ...b,
});

const crit = buyable({ id: 'crit', effect: { kind: 'criticalChance', chance: 0.5 } });
const study = buyable({ id: 'study', effect: { kind: 'actionXpReduction', amount: 0.25 } });
const gate = buyable({ id: 'levels', effect: { kind: 'unlockSleeveLevels' } });
const config = createConfig(testConfig, {
  buyables: [...testConfig.buyables, crit, study, gate],
  items: { ...testConfig.items, augment: { itemId: 'file', xpBonusPerItem: 0.1 }, skillShard: { itemId: 'file', levelsDelayed: 1 } },
});

const card = (g: ReturnType<typeof createGame>) => buildViewModel(g).actions[0]!;
const own = (g: ReturnType<typeof createGame>, id: string): void => {
  setCredits(g, num(1e6));
  expect(g.buy(id)).toBe('purchased');
};

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('the level XP bar tip', () => {
  it('a new game: base XP, the result, and the curve, with no factor that is 1 and no critical line', () => {
    const g = createGame({ config });
    const tip = card(g).levelXpTip;
    expect(tip.split('\n')[0]).toBe('XP per Run = Base XP');
    expect(tip).toContain('Base XP = 1\n');
    expect(tip).toContain('XP per Run = 1 = 1');
    expect(tip).toContain('XP for a Level = First Level x Growth ^ Level\n');
    expect(tip).toContain('First Level = 10\nGrowth = 10\n');
    expect(tip).toContain(`XP for the next Level = ${formatBigNum(g.actionXpForLevel('a'))}`);
    for (const word of ['Boost', 'critical', 'Delay', 'Reduction']) expect(tip).not.toContain(word);
  });

  it('the XP lever is written when it is not 1, and the result is the engine figure', () => {
    const g = createGame({ config: createConfig(config, { global: { xpMultiplier: 2 } }) });
    const tip = card(g).levelXpTip;
    expect(tip.split('\n')[0]).toBe('XP per Run = Base XP x XP Boost');
    expect(tip).toContain('XP Boost = 2\n');
    expect(tip).toContain(`XP per Run = 1 x 2 = ${formatBigNum(g.xpPerRun('a'), 4)}`);
    expect(g.xpPerRun('a').toNumber()).toBe(2);
  });

  it('applied Augments add their factor, and the total stays the engine figure', () => {
    const g = createGame({ config });
    (g.getState() as unknown as { sleeve: { actions: Record<string, { augments: Record<string, number> }> } }).sleeve.actions[
      'a'
    ]!.augments = {
      common: 3,
    };
    const tip = card(g).levelXpTip;
    expect(tip).toContain('Augment Boost = 1.3\n');
    expect(tip).toContain(`= ${formatBigNum(g.xpPerRun('a'), 4)}`);
    expect(g.xpPerRun('a').toNumber()).toBeCloseTo(1.3, 9);
  });

  it('the critical line appears once a critical success is possible, with the action multiplier', () => {
    const g = createGame({ config });
    expect(card(g).levelXpTip).not.toContain('critical');
    own(g, 'crit');
    expect(card(g).levelXpTip).toContain(`A critical success gives ${g.xpPerRunBreakdown('a').criticalXpMultiplier}x XP`);
  });

  it('Skill shards add a delay, and the next level cost is the owner figure with the delay', () => {
    const g = createGame({ config });
    const state = g.getState() as unknown as { sleeve: { actions: Record<string, { xp: unknown; skillShards: number }> } };
    state.sleeve.actions['a']!.xp = num(15); // level 1: 10 XP of level 0 paid
    const plain = g.actionXpForLevel('a').toNumber();
    state.sleeve.actions['a']!.skillShards = 1;
    const tip = card(g).levelXpTip;
    expect(tip).toContain('XP for a Level = First Level x Growth ^ (Level - Delay)');
    expect(tip).toContain('Delay = 1 ');
    expect(g.actionXpForLevel('a').toNumber()).toBeLessThan(plain); // the shard held the cost back
    expect(tip).toContain(`XP for the next Level = ${formatBigNum(g.actionXpForLevel('a'))}`);
  });

  it('a reduction is written in percent and the cost is the reduced figure', () => {
    const g = createGame({ config });
    own(g, 'study');
    const tip = card(g).levelXpTip;
    expect(tip).toContain('x (1 - Reduction)');
    expect(tip).toContain('Reduction = 25%');
    expect(g.actionXpForLevel('a').toNumber()).toBeCloseTo(7.5, 9);
    expect(tip).toContain('XP for the next Level = 7.5');
  });
});

describe('the sleeve XP bar tip', () => {
  it('says how many runs make a grant, how much it gives, and the cost of the next sleeve level', () => {
    const g = createGame({ config });
    own(g, 'levels');
    const tip = card(g).sleeveXpTip;
    expect(tip.split('\n')[0]).toBe(
      `Every ${g.runsPerSleeveXp()} completed runs of this action give ${formatBigNum(g.sleeveXpGrant())} Sleeve XP`,
    );
    expect(tip).toContain('XP for a Level = First Level x Growth ^ Level\n');
    expect(tip).toContain(`XP for the next Level = ${formatBigNum(g.sleeveXpForLevel('a'))}`);
    expect(tip).not.toContain('Delay');
  });
});

describe('the tips on the screen', () => {
  it('hovering a bar shows its tip; the sleeve bar has none until sleeve levels are unlocked', () => {
    const root = document.createElement('div');
    document.body.append(root);
    const game = createGame({ config });
    const render = mountTestUi(root, game);
    const level = () => root.querySelector<HTMLElement>('.action .xp-level')!;
    const sleeve = () => root.querySelector<HTMLElement>('.action .xp-sleeve')!;
    expect(hoverText(level())).toBe(card(game).levelXpTip);
    expect(hoverText(sleeve())).toBe('');
    own(game, 'levels');
    render();
    expect(hoverText(sleeve())).toBe(card(game).sleeveXpTip);
  });
});
