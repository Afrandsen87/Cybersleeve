/**
 * Guards for the REAL content: the three automation lanes (skills paid in automation points, drawn in the Automation tab). The first
 * skill of each lane unlocks the automation; the rest are placeholders. Invariants only.
 */
import { describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { AUTOMATION_FEATURES } from '../core';
import { num } from '../numbers';
import { setCredits } from '../testing/testConfig';
import { gameConfig } from './gameConfig';
import { AUTOMATION_CORE, AUTOMATION_LINE_LENGTH, AUTOMATION_SKILLS, automationSkillId } from './ids';

const inLane = (feature: string) => gameConfig.buyables.filter((b) => b.branch === feature && b.currency === 'automationPoints');

describe('the automation skill lanes (real content)', () => {
  it('there is one lane per automation feature, each the same length, costing 1 automation point, belonging to no action', () => {
    for (const feature of AUTOMATION_FEATURES) {
      const skills = inLane(feature);
      expect(skills, feature).toHaveLength(AUTOMATION_LINE_LENGTH);
      for (const b of skills) {
        expect(b.cost.eq(num(1)), b.id).toBe(true);
        expect(b.actionId, b.id).toBeUndefined();
      }
    }
    expect(gameConfig.buyables.filter((b) => b.currency === 'automationPoints').map((b) => b.id)).toEqual([...AUTOMATION_SKILLS]);
  });

  it('each lane is one chain, and only its first skill unlocks the automation', () => {
    for (const feature of AUTOMATION_FEATURES) {
      inLane(feature).forEach((b, i) => {
        expect(b.id, feature).toBe(automationSkillId(feature, i + 1));
        expect(b.parents ?? [], b.id).toEqual(i === 0 ? [] : [automationSkillId(feature, i)]);
        expect(b.effect.kind, b.id).toBe(i === 0 ? 'unlocksAutomation' : 'placeholder');
      });
    }
  });

  it('the lanes are not in the Skills tab: no skill point pays for them', () => {
    const g = createGame();
    const skillTabIds = g
      .getConfig()
      .buyables.filter((b) => b.currency === 'skillPoints')
      .map((b) => b.id);
    for (const id of AUTOMATION_SKILLS) expect(skillTabIds).not.toContain(id);
  });

  it('with automation points a lane is climbed in order: step 1 unlocks the feature, step 2 needs step 1', () => {
    for (const feature of AUTOMATION_FEATURES) {
      const g = createGame();
      setCredits(g, num(1e12));
      for (let i = 0; i < 3; i++) expect(g.buy(AUTOMATION_CORE)).toBe('purchased');
      expect(g.canBuy(automationSkillId(feature, 2)), feature).toBe(false);
      expect(g.automation().isUnlocked(feature)).toBe(false);
      expect(g.buy(automationSkillId(feature, 1))).toBe('purchased');
      expect(g.automation().isUnlocked(feature)).toBe(true);
      expect(g.canBuy(automationSkillId(feature, 2)), feature).toBe(true);
    }
  });
});
