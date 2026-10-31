/**
 * Guards for the REAL content: the three automation lanes (skills paid in automation points, drawn in the Automation tab). The first
 * skill of each lane unlocks the automation; the rest are placeholders. Invariants only.
 */
import { describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { AUTOMATION_FEATURES, AUTO_BURN_STEPS } from '../core';
import { num } from '../numbers';
import { setCredits } from '../testing/testConfig';
import { gameConfig } from './gameConfig';
import { AUTOMATION_CORE, AUTOMATION_LINE_LENGTH, AUTOMATION_SKILLS, AUTO_BURN_EMPTY_SLOTS, automationSkillId } from './ids';

const inLane = (feature: string) => gameConfig.buyables.filter((b) => b.branch === feature && b.currency === 'automationPoints');

describe('the automation skill lanes (real content)', () => {
  it('the Auto Burn steps are each granted by exactly one skill, in the order of AUTO_BURN_STEPS, and their names and descriptions are filled in', () => {
    const steps = inLane('autoBurn').flatMap((b) => (b.effect.kind === 'autoBurnStep' ? [b.effect.step] : []));
    expect(steps).toEqual([...AUTO_BURN_STEPS]);
    for (const b of inLane('autoBurn')) {
      expect(b.name, b.id).not.toMatch(/Auto Burn d/);
      expect(b.description.length, b.id).toBeGreaterThan(10);
    }
  });

  it('the lower threshold starts below the upper one', () => {
    const { autoBurnCeiling, autoBurnUpper } = gameConfig.automation!;
    expect(autoBurnCeiling).toBeGreaterThanOrEqual(0);
    expect(autoBurnUpper).toBeGreaterThan(autoBurnCeiling);
  });

  it('there is one lane per automation feature, each as long as its slots, costing 1 automation point, belonging to no action', () => {
    for (const feature of AUTOMATION_FEATURES) {
      const skills = inLane(feature);
      expect(skills, feature).toHaveLength(AUTOMATION_LINE_LENGTH - (feature === 'autoBurn' ? AUTO_BURN_EMPTY_SLOTS.length : 0));
      for (const b of skills) {
        expect(b.cost.eq(num(1)), b.id).toBe(true);
        expect(b.actionId, b.id).toBeUndefined();
      }
    }
    expect(gameConfig.buyables.filter((b) => b.currency === 'automationPoints').map((b) => b.id)).toEqual([...AUTOMATION_SKILLS]);
  });

  it('each lane is one chain, and only its first skill unlocks the automation; the Auto Burn lane grants its eight steps in order, the others are placeholders', () => {
    for (const feature of AUTOMATION_FEATURES) {
      const slots = Array.from({ length: AUTOMATION_LINE_LENGTH }, (_, i) => i + 1).filter(
        (slot) => feature !== 'autoBurn' || !AUTO_BURN_EMPTY_SLOTS.includes(slot),
      );
      inLane(feature).forEach((b, i) => {
        expect(b.id, feature).toBe(automationSkillId(feature, slots[i] ?? 0));
        expect(b.parents ?? [], b.id).toEqual(i === 0 ? [] : [automationSkillId(feature, slots[i - 1] ?? 0)]);
        expect(b.effect.kind, b.id).toBe(i === 0 ? 'unlocksAutomation' : feature === 'autoBurn' ? 'autoBurnStep' : 'placeholder');
      });
    }
  });

  it('removing Pick Targets kept the later Auto Burn skill ids: Tune Thresholds is slot 9 with slot 7 as its parent', () => {
    const tune = gameConfig.buyables.find((b) => b.effect.kind === 'autoBurnStep' && b.effect.step === 'thresholds');
    expect(tune?.id).toBe(automationSkillId('autoBurn', 9));
    expect(tune?.parents).toEqual([automationSkillId('autoBurn', 7)]);
    expect(gameConfig.buyables.some((b) => b.id === automationSkillId('autoBurn', 8))).toBe(false);
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
