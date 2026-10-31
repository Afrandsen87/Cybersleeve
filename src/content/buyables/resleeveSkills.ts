/**
 * @module content
 *
 * The buyables of sleeve skills (bought with sleeve skill points): four lanes, each in its own file under `resleeveBranches/`.
 */
import type { BuyableDefinition } from '../../core';
import { sleeveUpSkills } from './resleeveBranches/sleeveUp';
import { corporationSkills } from './resleeveBranches/corporation';
import { reachSkills } from './resleeveBranches/reach';
import { retentionSkills } from './resleeveBranches/retention';
import { syntheticsSkills } from './resleeveBranches/synthetics';

/** The buyables of sleeve skills: Retention, Reach, Synthetics and Corporation lanes, each root first. All are kept through re-sleeving. */
export const resleeveSkillsBuyables: BuyableDefinition[] = [
  ...sleeveUpSkills,
  ...retentionSkills,
  ...reachSkills,
  ...syntheticsSkills,
  ...corporationSkills,
];
