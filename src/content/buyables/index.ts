/**
 * @module content
 *
 * Every buyable of the game, grouped by what it belongs to. The order of the groups is the configuration order, which decides the order of skills in the Skills tab and of the terms in the calculation tips: skills come before the sleeve-wide purchases.
 */
import type { BuyableDefinition } from '../../core';
import { growNetworkBuyables } from './growNetwork';
import { practiceHackingBuyables } from './practiceHacking';
import { pushMalwareBuyables } from './pushMalware';
import { killServersBuyables } from './killServers';
import { buildLegendBuyables } from './buildLegend';
import { corporationBuyables } from './corporation';
import { sleeveBuyables } from './sleeve';
import { skillsBuyables } from './skills';
import { resleeveSkillsBuyables } from './resleeveSkills';

/** All buyables, in configuration order. */
export const buyablesConfig: BuyableDefinition[] = [
  ...practiceHackingBuyables,
  ...growNetworkBuyables,
  ...pushMalwareBuyables,
  ...killServersBuyables,
  ...buildLegendBuyables,
  ...skillsBuyables,
  ...resleeveSkillsBuyables,
  ...sleeveBuyables,
  ...corporationBuyables,
];
