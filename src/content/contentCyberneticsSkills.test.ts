import { describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { num } from '../numbers';
import { gameConfig } from './gameConfig';
import {
  BRANCH_CYBERNETICS,
  GROW_NETWORK,
  PUSH_MALWARE,
  SKILL_BACKBONE_PARASITE,
  SKILL_BANDWIDTH,
  SKILL_FIBER_TAP,
  SKILL_MUSCLE_MEMORY,
  SKILL_NEURAL_ACCELERANT,
  SKILL_OVERCLOCK,
  SKILL_OVERDRIVE_SPIKE,
  SKILL_PARALLEL_THREADS,
  SKILL_QUICK_STUDY,
  SKILL_SIGNAL_AMPLIFIER,
} from './ids';

const skill = (id: string) => gameConfig.buyables.find((b) => b.id === id)!;
const childrenOf = (id: string) => gameConfig.buyables.filter((b) => b.parents?.includes(id)).map((b) => b.id);

describe('the cybernetics skills of the real content', () => {
  it('Overclocked Cortex has three arms: Bandwidth Leech, Muscle Memory and Parallel Threads', () => {
    expect(childrenOf(SKILL_OVERCLOCK).sort()).toEqual([SKILL_BANDWIDTH, SKILL_MUSCLE_MEMORY, SKILL_PARALLEL_THREADS].sort());
  });

  it('the three lanes are straight lines', () => {
    expect(childrenOf(SKILL_BANDWIDTH)).toEqual([SKILL_FIBER_TAP]);
    expect(childrenOf(SKILL_FIBER_TAP)).toEqual([SKILL_BACKBONE_PARASITE]);
    expect(childrenOf(SKILL_NEURAL_ACCELERANT)).toEqual([SKILL_SIGNAL_AMPLIFIER]);
    expect(childrenOf(SKILL_SIGNAL_AMPLIFIER)).toEqual([SKILL_OVERDRIVE_SPIKE]);
    expect(childrenOf(SKILL_MUSCLE_MEMORY)).toEqual([SKILL_QUICK_STUDY]);
    expect(childrenOf(SKILL_PARALLEL_THREADS)).toEqual([SKILL_NEURAL_ACCELERANT]);
    expect(childrenOf(SKILL_OVERCLOCK).length).toBe(3);
  });

  it('every new skill is in the cybernetics branch, costs skill points and belongs to no action', () => {
    for (const id of [
      SKILL_PARALLEL_THREADS,
      SKILL_NEURAL_ACCELERANT,
      SKILL_FIBER_TAP,
      SKILL_BACKBONE_PARASITE,
      SKILL_SIGNAL_AMPLIFIER,
      SKILL_OVERDRIVE_SPIKE,
    ]) {
      expect(skill(id).branch, id).toBe(BRANCH_CYBERNETICS);
      expect(skill(id).currency, id).toBe('skillPoints');
      expect(skill(id).actionId, id).toBeUndefined();
    }
  });

  it('Fiber Tap lets Push malware pay Grow network, and Backbone Parasite scales Grow network by its own level', () => {
    expect(skill(SKILL_FIBER_TAP).effect).toMatchObject({
      kind: 'paysActionReward',
      sourceActionId: PUSH_MALWARE,
      targetActionId: GROW_NETWORK,
    });
    expect(skill(SKILL_BACKBONE_PARASITE).effect).toMatchObject({
      kind: 'rewardMultiplierFromActionLevel',
      sourceActionId: GROW_NETWORK,
      targetActionId: GROW_NETWORK,
    });
  });

  it('a skill below an unowned parent cannot be bought, even with points', () => {
    const g = createGame();
    (g.getState().actions[gameConfig.actions[0]!.id] as { xp: unknown }).xp = num('1e100');
    expect(g.skillPoints()).toBeGreaterThan(1);
    expect(g.canBuy(SKILL_NEURAL_ACCELERANT)).toBe(false);
    expect(g.buy(SKILL_OVERCLOCK)).toBe('purchased');
    expect(g.buy(SKILL_PARALLEL_THREADS)).toBe('purchased');
    expect(g.canBuy(SKILL_NEURAL_ACCELERANT)).toBe(true);
  });
});
