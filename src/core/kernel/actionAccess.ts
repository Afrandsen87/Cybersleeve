/**
 * @module kernel
 * Action availability shared by live actions and automation save validation.
 * Called by: ActionRunner.isUnlocked, automationSavePart, invariants. Calls: nothing; pure.
 */
import type { ActionDefinition } from '../types';

/**
 * Tests the existing action access gate without mutating state.
 * Called by: ActionRunner.isUnlocked, automationSavePart, invariants. Calls: nothing.
 * @param action known content action
 * @param accessLevel sleeve access after owned effects
 * @returns whether the action is available
 */
export function actionIsUnlocked(action: Pick<ActionDefinition, 'requiredAccessLevel'>, accessLevel: number): boolean {
  return accessLevel >= (action.requiredAccessLevel ?? 1);
}
