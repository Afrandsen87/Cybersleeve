/**
 * @module ui
 * Real-content invariants for Automation's control guidance.
 * Called by: Vitest. Calls: automationAdds, testConfig.
 */
import { describe, expect, it } from 'vitest';
import { gameConfig } from '../content/gameConfig';
import { testConfig } from '../testing/testConfig';
import { firmwareText } from './firmwareText';
import { automationAdds } from './view/automationAdds';

const skills = gameConfig.buyables.filter((skill) => skill.currency === 'automationPoints');
/** Looks up the existing configured rarity name. Called by: tests. Calls: nothing. */
const rarityName = (id: string): string => gameConfig.items.rarities.find((rarity) => rarity.id === id)?.name ?? id;
/** Uses the real tree order with test-independent guidance wording. Called by: tests. Calls: automationAdds. */
const adds = (skill: (typeof skills)[number]) => automationAdds(skill, skills, rarityName, firmwareText);

describe('automation control guidance', () => {
  it('gives every real automation skill nonempty text and a stable target', () => {
    expect(skills.length).toBeGreaterThan(0);
    for (const skill of skills) {
      expect(adds(skill)?.text.trim().length, skill.id).toBeGreaterThan(0);
      expect(adds(skill)?.target.trim().length, skill.id).toBeGreaterThan(0);
    }
    expect(automationAdds(testConfig.buyables[0]!, testConfig.buyables, rarityName, firmwareText)).toBeNull();
  });
  it('keeps rarity chips, permits and burn control kinds distinct', () => {
    for (const kinds of [['allowsAutosale', 'allowsAutoBackchannel', 'allowsDispersal', 'unlocksAutomation'], ['autoBurnStep']]) {
      const targets = skills.filter((skill) => kinds.includes(skill.effect.kind)).map((skill) => adds(skill)!.target);
      expect(new Set(targets).size).toBe(targets.length);
    }
  });
  it('numbers target controls by capacity granted through that node in tree order', () => {
    let capacity = 0;
    for (const skill of skills.filter((node) => node.branch === 'dispersal')) {
      if (skill.effect.kind === 'unlocksAutomation') capacity += skill.effect.dispersalSlots ?? 0;
      if (skill.effect.kind !== 'dispersalSlots') continue;
      capacity += skill.effect.count;
      expect(adds(skill)?.target).toBe(`slot-${capacity}`);
    }
  });
});
