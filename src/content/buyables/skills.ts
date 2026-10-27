/**
 * @module content
 *
 * The buyables of skills (bought with skill points): the branches of the skill tree, one file each in `skillBranches/`.
 * A new skill is one entry in its branch's file; a new branch is a new file, a branch id in `ids.ts`, a title in `ui/uiText.ts` and a
 * colour in `ui/style.css`.
 */
import type { BuyableDefinition } from '../../core';
import { anonymitySkills } from './skillBranches/anonymity';
import { cyberneticsSkills } from './skillBranches/cybernetics';
import { leverageSkills } from './skillBranches/leverage';

/** The buyables of skills (bought with skill points), branch by branch. */
export const skillsBuyables: BuyableDefinition[] = [...cyberneticsSkills, ...anonymitySkills, ...leverageSkills];
