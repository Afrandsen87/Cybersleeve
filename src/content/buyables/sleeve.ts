/**
 * @module content
 *
 * The buyables of the sleeve as a whole (not tied to an action).
 */
import type { BuyableDefinition } from '../../core';
import { num } from '../../numbers';
import {
  INTERFACE_BOOST,
  ACCESS_UPGRADE,
  FASTER_CONDITIONING,
  CRITICAL_SUCCESS,
  NODE_UPLINK,
  NODE_PAYOUT,
  ICE_RATING_BOOST,
  AUTOMATION_CORE,
  OVERCLOCK_UPGRADE,
  FOCUS_UPGRADE,
  SLEEVE_LEVELS,
} from '../ids';

/** The buyables of the sleeve as a whole (not tied to an action). */
export const sleeveBuyables: BuyableDefinition[] = [
  // Global (sleeve) buyables: no actionId; they change the sleeve's stats. Prices are placeholders.
  {
    id: AUTOMATION_CORE,
    name: 'Automation core',
    symbol: 'AC',
    description: 'Gives 1 automation point. Each point unlocks one automation feature in the Automation tab. Each copy costs 100x more.',
    cost: num(1_000_000),
    costGrowth: 100,
    maxPurchases: Infinity,
    effect: { kind: 'automationPoints', perCopy: 1 },
  },

  {
    id: ICE_RATING_BOOST,
    name: 'ICE Rating boost',
    symbol: 'IB',
    description: 'Multiplies ICE Rating by 2. Each copy costs 100x more.',
    cost: num(150_000), // a little above Hardened payload: it multiplies nothing until that adds base ICE Rating
    costGrowth: 100, // every 2nd order of magnitude
    maxPurchases: Infinity,
    effect: { kind: 'iceRatingMultiplier', factor: 2 },
  },

  {
    id: NODE_PAYOUT,
    name: 'Node payout',
    symbol: 'NP',
    description: 'Each node produces 100% more credits. Paid in network nodes. Each copy costs 10x more.',
    currency: 'networkNodes',
    cost: num(25),
    costGrowth: 10, // every order of magnitude
    maxPurchases: Infinity,
    effect: { kind: 'nodePayoutMultiplier', factor: 2 }, // +100% per copy, compounding
  },

  {
    id: NODE_UPLINK,
    name: 'Node uplink',
    symbol: 'NU',
    description: 'Raises the base interface speed by 0.1. Paid in network nodes. Each copy costs 10x more.',
    currency: 'networkNodes',
    cost: num(10),
    costGrowth: 10, // every order of magnitude
    maxPurchases: Infinity,
    effect: { kind: 'interfaceSpeed', amount: 0.1 },
  },

  {
    id: INTERFACE_BOOST,
    name: 'Interface boost',
    symbol: 'IF',
    description: 'Raises the base interface speed by 0.05, which speeds up every action. Each copy costs 1000x more.',
    cost: num(10),
    costGrowth: 1_000, // every 3rd order of magnitude
    maxPurchases: Infinity,
    effect: { kind: 'interfaceSpeed', amount: 0.05 },
  },

  {
    id: ACCESS_UPGRADE,
    name: 'Access upgrade',
    symbol: 'AX',
    description: 'Raises Access Level by 1, which unlocks the next action. Each copy costs 1000x more. Up to 4 copies.',
    cost: num(5),
    costGrowth: 1_000, // every 3rd order of magnitude
    // 4 copies reach access level 5, which opens the five actions there are; the Clearance Escalation re-sleeve skill allows one more
    maxPurchases: 4,
    effect: { kind: 'accessLevel', amount: 1 },
  },

  {
    id: OVERCLOCK_UPGRADE,
    name: 'Overclock upgrade',
    symbol: 'OU',
    description: 'Makes the gains of every Overclock 10% stronger (the speed and reward bonuses). Each copy costs 1000x more.',
    cost: num(250_000), // 1000x what unlocking Overclock cost before it became per action
    costGrowth: 1_000, // every 3rd order of magnitude
    maxPurchases: Infinity,
    // perCopy 0.1: the first copy makes every Overclock 10% stronger, the second 20%, and so on
    effect: { kind: 'overclockStrength', perCopy: 0.1 },
  },

  {
    id: FOCUS_UPGRADE,
    name: 'Focus upgrade',
    symbol: 'FU',
    description: 'One more action can be focused at once. Each copy costs 100,000x more.',
    cost: num(1_000_000), // 1000x what the first Focus slot cost before Focus became per action
    costGrowth: 100_000, // every 5th order of magnitude
    // One slot is free (focus.baseSlots), so the cap that gives every action a slot is the number of actions minus one (the content test checks it).
    maxPurchases: 4,
    effect: { kind: 'focusSlots', perCopy: 1 },
  },

  {
    id: FASTER_CONDITIONING,
    name: 'Faster conditioning',
    symbol: 'FC',
    description: 'Every action needs 1 run fewer for each batch of sleeve XP, down to 10 runs. Each copy costs 100x more.',
    cost: num(1_000),
    costGrowth: 100, // every 2nd order of magnitude
    // 90 copies take the 100 runs per batch down to the floor of 10 (the content test checks the cap matches)
    maxPurchases: 90,
    effect: { kind: 'runsPerSleeveXpReduction', perCopy: 1, minRuns: 10 },
  },

  {
    id: CRITICAL_SUCCESS,
    name: 'Critical success',
    symbol: 'CS',
    description:
      'Every completed run of any action has a 5% chance to be a critical success: double XP and triple payout. Each copy adds 5% and costs 1000x more. Above 100% a run can have several critical successes, each paying and teaching again.',
    cost: num(50),
    costGrowth: 1_000, // every 3rd order of magnitude
    maxPurchases: Infinity,
    // chance 0.05 per copy: 20 copies make every run critical (the total is capped at 1)
    effect: { kind: 'criticalChance', chance: 0.05 },
  },

  {
    id: SLEEVE_LEVELS,
    name: 'Unlock resleeving',
    symbol: 'SL',
    description: 'Unlocks sleeve levels and the option to re-sleeve, and with it the re-sleeve skills. Kept when you re-sleeve.',
    cost: num(100e9),
    effect: { kind: 'unlockSleeveLevels' },
  },
];
