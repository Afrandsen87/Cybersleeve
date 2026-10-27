/**
 * @module content
 *
 * The three automation lanes (Auto Burn, Compromat Autosale, Augment Dispersal), bought with automation points and drawn inside each
 * automation's box in the Automation tab. Each lane is a chain of `AUTOMATION_LINE_LENGTH` skills that will become progressively more
 * complicated versions of that automation. The FIRST skill is the unlock (`unlocksAutomation`); the rest are PLACEHOLDERS (no effect
 * yet). Replace a lane's generated entries with real ones, one file per lane, when designed.
 */
import type { AutomationFeature, BuyableDefinition } from '../../../core';
import { num } from '../../../numbers';
import { AUTOMATION_LINE_LENGTH, BRANCH_AUTO_BURN, BRANCH_AUTOSALE, BRANCH_DISPERSAL, automationSkillId } from '../../ids';

/**
 * A chain of skills: step 1 is the root and unlocks the automation, each later step is a placeholder with the one before it as its only parent.
 *
 * Called by: {@link automationSkills}.
 *
 * @param branch the lane's branch id, which is also the id of the automation it unlocks
 * @param name the lane's display name (steps are named "<name> 1" ... "<name> N")
 * @param symbol the short letters shown when no icon is drawn (steps get "<symbol>1" ... "<symbol>N")
 * @returns `AUTOMATION_LINE_LENGTH` skills, 1 automation point each
 */
function placeholderLine(branch: AutomationFeature, name: string, symbol: string): BuyableDefinition[] {
  return Array.from({ length: AUTOMATION_LINE_LENGTH }, (_, i): BuyableDefinition => {
    const step = i + 1;
    return {
      id: automationSkillId(branch, step),
      name: `${name} ${step}`,
      symbol: `${symbol}${step}`,
      description: step === 1 ? `Unlocks ${name}.` : `Placeholder: a more advanced ${name} (step ${step}).`,
      currency: 'automationPoints',
      branch,
      ...(step > 1 ? { parents: [automationSkillId(branch, step - 1)] } : {}),
      cost: num(1), // placeholder price
      effect: step === 1 ? { kind: 'unlocksAutomation', feature: branch } : { kind: 'placeholder' },
    };
  });
}

/** The automation lanes of the skill tree, lane by lane. */
export const automationSkills: BuyableDefinition[] = [
  ...placeholderLine(BRANCH_AUTO_BURN, 'Auto Burn', 'B'),
  ...placeholderLine(BRANCH_AUTOSALE, 'Autosale', 'S'),
  ...placeholderLine(BRANCH_DISPERSAL, 'Dispersal', 'D'),
];
