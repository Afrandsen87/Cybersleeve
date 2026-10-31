/**
 * @module content
 *
 * The three automation lanes (Auto Burn, Compromat Autosale, Augment Dispersal), bought with automation points and drawn inside each
 * automation's box in the Automation tab. A lane uses stable slots up to `AUTOMATION_LINE_LENGTH`; autosale forks within one branch. The FIRST skill of a lane is the
 * unlock (`unlocksAutomation`). The Auto Burn lane is designed: its other eight skills each add one step of Auto Burn (`autoBurnStep`); slot 8 is skipped (the removed Pick Targets) so saved skill ids stay stable.
 * The autosale and dispersal trees live in autosaleLane.ts and dispersalLane.ts.
 */
import type { AutoBurnStep, BuyableDefinition } from '../../../core';
import { autosaleSkills } from './autosaleLane';
import { dispersalSkills } from './dispersalLane';
import { num } from '../../../numbers';
import { BRANCH_AUTO_BURN, automationSkillId } from '../../ids';

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
    description: 'Adds the switch "Hold at Floor": use just enough leads to bring heat down to the Floor, none at or below it.',
    step: 'hold',
  },
  {
    slot: 3,
    name: 'Redline Trigger',
    description: 'Adds the switch "Switch on at Redline": the Burn lead toggle switches itself on when heat reaches the Redline.',
    step: 'upper',
  },
  {
    slot: 4,
    name: 'Cool Overclocks',
    description: 'Adds a switch: when out of leads while heat is above the Floor, switch off every Overclock that makes heat.',
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
      'Adds a switch: when heat is below the Floor and leads are available, switch on the Auto-runs you tick in its list (even ones you switched off yourself), and the Burn lead toggle.',
    step: 'onActions',
  },
  {
    slot: 7,
    name: 'Resume Overclocks',
    description: 'Adds a switch: in that situation also switch on the Overclocks you tick in its list.',
    step: 'onOverclocks',
  },
  { slot: 9, name: 'Tune Thresholds', description: 'Edit the Floor and the Redline.', step: 'thresholds' },
  {
    slot: 10,
    name: 'Lead Reserve',
    description: 'Set a Reserve of Burn leads to always keep: every rule above treats only the leads beyond it as available.',
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
export const automationSkills: BuyableDefinition[] = [...autoBurnLine(), ...autosaleSkills, ...dispersalSkills];
