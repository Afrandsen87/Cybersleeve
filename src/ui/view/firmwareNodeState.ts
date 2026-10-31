/**
 * @module ui
 * Pure presentation precedence for shared firmware nodes.
 * Called by: buildSkillLanes and node-state tests. Calls: nothing.
 */
import type { BuyableView } from './buyableViewTypes';

/** Display states in the ui context. Called by: tree views and widgets. Calls: nothing. */
export type FirmwareNodeState = 'installed' | 'encrypted' | 'locked' | 'affordable' | 'available';

/** Inputs already decided by the tree view. Called by: nodeState. Calls: nothing. */
export interface NodeStateInput {
  readonly view: Pick<BuyableView, 'owned' | 'affordable'>;
  readonly masked: boolean;
  readonly locked: boolean;
}

/**
 * Chooses one state without changing game state; ownership wins over masking.
 * Called by: buildSkillLanes. Calls: nothing.
 * @param input Existing ownership, masking, parent lock and affordability.
 * @returns The first matching presentation state.
 */
export function nodeState(input: NodeStateInput): FirmwareNodeState {
  if (input.view.owned > 0) return 'installed';
  if (input.masked) return 'encrypted';
  if (input.locked) return 'locked';
  return input.view.affordable ? 'affordable' : 'available';
}
