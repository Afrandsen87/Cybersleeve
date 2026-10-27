/**
 * @module content
 *
 * The retention lane of the re-sleeve skills: what a re-sleeve no longer wipes. Reflex Archive is the root; each skill needs the one before.
 */
import type { BuyableDefinition } from '../../../core';
import { num } from '../../../numbers';
import {
  BRANCH_RETENTION,
  SKILL_DAEMON_PERSISTENCE,
  SKILL_REFLEX_ARCHIVE,
  SKILL_RESIDUAL_FIREWALL,
  SKILL_RESIDUAL_PROFICIENCY,
} from '../../ids';

/** The retention lane, root first. Prices rise down the lane. */
export const retentionSkills: BuyableDefinition[] = [
  {
    id: SKILL_REFLEX_ARCHIVE,
    name: 'Reflex Archive',
    symbol: 'RA',
    description:
      "Buys back what you owned on your actions' cards last life (Auto-run, Overclock, Focus and the rest, as many copies as you had) as soon as you can afford it, cheapest first.",
    currency: 'resleevePoints',
    branch: BRANCH_RETENTION,
    cost: num(1),
    effect: { kind: 'autoRepurchase' },
  },
  {
    id: SKILL_DAEMON_PERSISTENCE,
    name: 'Daemon Persistence',
    symbol: 'DM',
    description: 'The Automation tab survives a re-sleeve: the automation core, its skills and their settings stay as they are.',
    currency: 'resleevePoints',
    branch: BRANCH_RETENTION,
    cost: num(2),
    parents: [SKILL_REFLEX_ARCHIVE],
    effect: { kind: 'keepsAutomation' },
  },
  {
    id: SKILL_RESIDUAL_PROFICIENCY,
    name: 'Residual Proficiency',
    symbol: 'RP',
    description: 'A new life starts with some of the Hacking Proficiency of the last one.',
    currency: 'resleevePoints',
    branch: BRANCH_RETENTION,
    cost: num(3),
    parents: [SKILL_DAEMON_PERSISTENCE],
    // a first try, to be tuned by playing: a life ending at proficiency 1,000 starts the next at 3
    effect: { kind: 'carriesProficiency', scale: 1 },
  },
  {
    id: SKILL_RESIDUAL_FIREWALL,
    name: 'Residual Firewall',
    symbol: 'RF',
    description: 'A new life starts with some of the ICE Rating of the last one.',
    currency: 'resleevePoints',
    branch: BRANCH_RETENTION,
    cost: num(4),
    parents: [SKILL_RESIDUAL_PROFICIENCY],
    // a first try, to be tuned by playing: half of the orders of magnitude (ICE Rating 1e100 becomes 1e50)
    effect: { kind: 'carriesIceRating', share: 0.5 },
  },
];
