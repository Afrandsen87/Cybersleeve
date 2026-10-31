/**
 * @module automation
 * Automation context: one owner of skill-granted dispersal selection capacity.
 * Called by: Automation, automationSavePart, invariants. Calls: isFeatureUnlocked.
 */
import type { BuyableDefinition } from '../types';
import { isFeatureUnlocked } from './automationTypes';

/**
 * Sums selection slots of owned skills; a locked feature has no capacity.
 * Called by: Automation.dispersalSlots, automationSavePart, invariants. Calls: isFeatureUnlocked.
 * @param buyables content effects
 * @param purchased owned copies
 * @returns selection capacity, without mutating state
 */
export function dispersalSlots(buyables: readonly BuyableDefinition[], purchased: Readonly<Record<string, number>>): number {
  if (!isFeatureUnlocked(buyables, purchased, 'dispersal')) return 0;
  let count = 0;
  for (const b of buyables) {
    if ((purchased[b.id] ?? 0) <= 0) continue;
    if (b.effect.kind === 'dispersalSlots') count += b.effect.count;
    if (b.effect.kind === 'unlocksAutomation' && b.effect.feature === 'dispersal') count += b.effect.dispersalSlots ?? 0;
  }
  return count;
}
