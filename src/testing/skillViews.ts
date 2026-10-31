/**
 * @module testing
 *
 * Test helper: the buyable views of a skill tree, flat, in lane order.
 *
 * @remarks
 * Called by: the skill-tree and skill-tab tests. Calls: nothing.
 */
import type { BuyableView, SkillLaneView } from '../ui/viewModel';
import type { SkillNodeView } from '../ui/view/skillTreeTypes';
import { nodeState } from '../ui/view/firmwareNodeState';

/** The view of every skill in the lanes, lane by lane (a masked skill is its masked view). */
export function skillViews(lanes: readonly SkillLaneView[]): BuyableView[] {
  return lanes.flatMap((lane) => lane.nodes.map((n) => n.view));
}

/**
 * Builds a complete node view for pure presentation tests, without an engine or timers.
 * Called by: firmware state, path and inspector tests. Calls: nodeState.
 * @param id Stable node id.
 * @param overrides Fields relevant to the test.
 * @param buyable Buyable fields relevant to the test.
 * @returns A deterministic node with coherent default presentation state.
 */
export function skillNode(id: string, overrides: Partial<SkillNodeView> = {}, buyable: Partial<BuyableView> = {}): SkillNodeView {
  const view: BuyableView = {
    id,
    name: `Name ${id}`,
    description: `Does ${id}`,
    symbol: id,
    actionId: undefined,
    costText: '1',
    costUnit: 'firmware points',
    owned: 0,
    ownedText: '0',
    repeatable: false,
    maxed: false,
    available: true,
    gated: false,
    affordable: false,
    toggleable: false,
    enabled: false,
    clickable: false,
    tip: '',
    inSquare: false,
    ...buyable,
  };
  const masked = overrides.masked ?? false;
  const locked = overrides.locked ?? false;
  return { view, masked, locked, col: 0, row: 0, parents: [], state: nodeState({ view, masked, locked }), ...overrides };
}

/**
 * Builds one branch around supplied nodes.
 * Called by: firmware inspector and branch tests. Calls: nothing.
 * @param nodes Nodes in configuration order.
 * @param id Branch id.
 * @returns A small branch view with its public title.
 */
export function skillLane(nodes: readonly SkillNodeView[], id = 'cybernetics'): SkillLaneView {
  return { id, title: id, cols: 1, rows: 1, nodes };
}
