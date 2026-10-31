/** Actions/effects/economy derived-level integration; XP remains progression-owned. */
import { describe, expect, it } from 'vitest';
import { createGame } from '../../app/createGame';
import { num } from '../../numbers';
import { effectiveLevelConfig, prepareEffectiveLevels } from '../../testing/effectiveLevelKit';
import { resolveNetworkGrowth } from '../effects/queries';
import { sleeveSkillsOwned } from '../economy/sleeveSkills';

describe('effective action levels', () => {
  it('a transfer bonus raises speed, rewards, ICE, growth and start-cost reduction without changing progression', () => {
    const game = createGame({ config: effectiveLevelConfig() });
    const state = prepareEffectiveLevels(game);
    expect(game.actionLevel('a')).toBe(2);
    expect(game.effectiveActionLevel('a')).toBe(2);
    expect(game.sleeveLevel('net')).toBe(3);
    const before = {
      xp: state.sleeve.actions['a']!.xp,
      sleeveXp: state.sleeve.actions['a']!.sleeveXp,
      progress: game.actionLevelProgress('a'),
      points: game.skillPointsEarned(),
    };
    state.sleeve.purchased['transfer'] = 1;
    expect(game.effectiveActionLevel('a')).toBe(5);
    expect(game.currentSpeed('a')).toBe(6);
    expect(game.rewardMultiplier('net').toNumber()).toBeCloseTo(1 + 2 * Math.log1p(5));
    expect(game.sleeveStats().iceRating.toNumber()).toBe(51);
    expect(resolveNetworkGrowth(effectiveLevelConfig().buyables, game.getState(), (id) => game.effectiveActionLevel(id))).toBeCloseTo(0.05);
    expect(game.startShareOf('a')).toBeCloseTo(0.1 * 0.9 ** 5);
    expect(game.actionLevel('a')).toBe(2);
    expect(state.sleeve.actions['a']!.xp.eq(before.xp)).toBe(true);
    expect(state.sleeve.actions['a']!.sleeveXp.eq(before.sleeveXp)).toBe(true);
    expect(game.actionLevelProgress('a')).toBe(before.progress);
    expect(game.skillPointsEarned()).toBe(before.points);
  });
  it('the live network growth path receives the effective source level', () => {
    const game = createGame({ config: effectiveLevelConfig() });
    const state = prepareEffectiveLevels(game);
    state.sleeve.purchased['transfer'] = 1;
    state.sleeve.network = num(1000);
    game.tick(1000);
    expect(state.sleeve.network.toNumber()).toBe(1050);
  });
  it('zero source bonus is identical to having no transfer', () => {
    const game = createGame({ config: effectiveLevelConfig() });
    const state = prepareEffectiveLevels(game);
    state.sleeve.actions['net']!.sleeveXp = num(0);
    const before = [
      game.currentSpeed('a'),
      game.rewardMultiplier('net').toNumber(),
      game.sleeveStats().iceRating.toNumber(),
      resolveNetworkGrowth(effectiveLevelConfig().buyables, game.getState(), (id) => game.effectiveActionLevel(id)),
    ];
    state.sleeve.purchased['transfer'] = 1;
    expect([
      game.currentSpeed('a'),
      game.rewardMultiplier('net').toNumber(),
      game.sleeveStats().iceRating.toNumber(),
      resolveNetworkGrowth(effectiveLevelConfig().buyables, game.getState(), (id) => game.effectiveActionLevel(id)),
    ]).toEqual(before);
  });
  it('Networked counts distinct sleeve skills once and uses the same count as its shop gate', () => {
    const config = effectiveLevelConfig();
    const game = createGame({ config });
    const state = prepareEffectiveLevels(game);
    state.sleeve.purchased['networked'] = 1;
    expect(game.effectiveActionLevel('a')).toBe(2);
    state.sleeve.purchased['skill1'] = 7;
    expect(sleeveSkillsOwned(config.buyables, state)).toBe(1);
    expect(game.isBuyableAvailable('networked')).toBe(false);
    state.sleeve.purchased['skill2'] = 1;
    expect(game.isBuyableAvailable('networked')).toBe(true);
    expect(game.effectiveActionLevel('a')).toBe(4);
    expect(game.actionLevel('a')).toBe(2);
  });
});
