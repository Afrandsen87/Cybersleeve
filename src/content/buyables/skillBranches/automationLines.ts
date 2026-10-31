/**
 * @module content
 *
 * The three automation lanes (Auto Burn, Compromat Autosale, Augment Dispersal), bought with automation points and drawn inside each
 * automation's box in the Automation tab. A lane uses stable slots up to `AUTOMATION_LINE_LENGTH`; autosale forks within one branch. The FIRST skill of a lane is the
 * unlock (`unlocksAutomation`). The Auto Burn lane is designed: its other eight skills each add one step of Auto Burn (`autoBurnStep`); slot 8 is skipped (the removed Pick Targets) so saved skill ids stay stable.
 * The autosale tree lives in autosaleLane.ts; only Augment Dispersal remains a placeholder chain.
 */
import type { AutoBurnStep, AutomationFeature, BuyableDefinition } from '../../../core';
import { autosaleSkills } from './autosaleLane';
import { num } from '../../../numbers';
import { AUTOMATION_LINE_LENGTH, BRANCH_AUTO_BURN, BRANCH_DISPERSAL, automationSkillId } from '../../ids';

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

/** The nine skills of the Auto Burn lane, in order (slot 8 is empty): name, what it adds, and the step it grants (`null` for the first, which is the unlock). */
const AUTO_BURN_SKILLS: readonly {
  /** The lane slot (1-based) that fixes the skill's id and icon; a slot may be skipped (slot 8 was Pick Targets, removed, so saved ids stay stable). */
  readonly slot: number;
  readonly name: string;
  readonly description: string;
  readonly step: AutoBurnStep | null;
}[] = [
  {
    slot: 1,
    name: 'Burn Toggle',
    description: 'Burn leads become a toggle in the Inventory. While it is on, one Burn lead is used every second while there is heat.',
    step: null,
  },
  {
    slot: 2,
    name: 'Hold Down',
    description:
      'Adds the switch "Hold at lower threshold": use just enough leads to bring heat down to the lower threshold, none at or below it.',
    step: 'hold',
  },
  {
    slot: 3,
    name: 'Redline Trigger',
    description:
      'Adds the switch "Switch on at upper threshold": the Burn lead toggle switches itself on when heat reaches the upper threshold.',
    step: 'upper',
  },
  {
    slot: 4,
    name: 'Cool Overclocks',
    description: 'Adds a switch: when out of leads while heat is above the lower threshold, switch off every Overclock that makes heat.',
    step: 'offOverclocks',
  },
  {
    slot: 5,
    name: 'Cool Auto-runs',
    description: 'Adds a switch: in that situation also switch off the Auto-run of every action that makes heat.',
    step: 'offActions',
  },
  {
    slot: 6,
    name: 'Resume Auto-runs',
    description:
      'Adds a switch: when heat is below the lower threshold and leads are available, switch on the Auto-runs you tick in its list (even ones you switched off yourself), and the Burn lead toggle.',
    step: 'onActions',
  },
  {
    slot: 7,
    name: 'Resume Overclocks',
    description: 'Adds a switch: in that situation also switch on the Overclocks you tick in its list.',
    step: 'onOverclocks',
  },
  { slot: 9, name: 'Tune Thresholds', description: 'Edit the lower and the upper threshold.', step: 'thresholds' },
  {
    slot: 10,
    name: 'Lead Reserve',
    description: 'Set a number of Burn leads to always keep: every rule above treats only the leads beyond it as available.',
    step: 'reserve',
  },
];

/** The Auto Burn lane: one chain, each skill 1 automation point, the first the unlock and the rest granting the steps of {@link AUTO_BURN_SKILLS}. */
function autoBurnLine(): BuyableDefinition[] {
  return AUTO_BURN_SKILLS.map((skill, i): BuyableDefinition => {
    const step = skill.slot;
    const parent = AUTO_BURN_SKILLS[i - 1];
    return {
      id: automationSkillId(BRANCH_AUTO_BURN, step),
      name: skill.name,
      symbol: `B${step}`,
      description: skill.description,
      currency: 'automationPoints',
      branch: BRANCH_AUTO_BURN,
      ...(parent ? { parents: [automationSkillId(BRANCH_AUTO_BURN, parent.slot)] } : {}),
      cost: num(1), // placeholder price
      effect: skill.step === null ? { kind: 'unlocksAutomation', feature: BRANCH_AUTO_BURN } : { kind: 'autoBurnStep', step: skill.step },
    };
  });
}

/** The automation lanes of the skill tree, lane by lane. */
export const automationSkills: BuyableDefinition[] = [
  ...autoBurnLine(),
  ...autosaleSkills,
  ...placeholderLine(BRANCH_DISPERSAL, 'Dispersal', 'D'),
];
