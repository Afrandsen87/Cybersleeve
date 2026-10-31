/**
 * @module ui
 * Pure, reveal-safe inspector presentation for the Firmware tab.
 * Called by: firmware inspector widget and tests. Calls: childrenOf, defaultSelection.
 */
import type { FirmwareText } from '../firmwareText';
import type { FirmwareNodeState } from './firmwareNodeState';
import { childrenOf } from './skillTreePaths';
import type { SkillLaneView, SkillNodeView } from './skillTreeTypes';

/** A revealed relationship label. Called by: InspectorView and buildInspectorView. Calls: nothing. */
export interface InspectorRelation {
  readonly id: string;
  readonly name: string;
  readonly installed: boolean;
}

/** Complete inspector presentation. Called by: firmware inspector widget. Calls: nothing. */
export interface InspectorView {
  readonly id: string;
  readonly iconId: string | null;
  readonly branchTitle: string;
  readonly persistent: boolean;
  readonly name: string;
  readonly state: FirmwareNodeState;
  readonly status: string;
  readonly description: string;
  readonly adds: string | null;
  readonly requires: readonly InspectorRelation[];
  readonly unlocksNext: readonly InspectorRelation[];
  readonly costText: string | null;
  readonly canInstall: boolean;
  readonly whyNot: string | null;
}

/** Existing view data supplied by the panel. Called by: buildInspectorView. Calls: nothing. */
export interface InspectorInput {
  readonly selectedId: string | null;
  readonly lanes: readonly SkillLaneView[];
  readonly sleeveLanes: readonly SkillLaneView[];
  readonly pointsText: string;
  readonly sleevePointsText: string;
  readonly text: FirmwareText;
  readonly adds?: string | null;
}

/**
 * Chooses the first affordable node, otherwise the first branch's root.
 * Called by: buildInspectorView and panel selection. Calls: nothing.
 * @param lanes Visible branches in display order.
 * @returns A node id, or null for an empty tree.
 */
export function defaultSelection(lanes: readonly SkillLaneView[]): string | null {
  const affordable = lanes.flatMap((lane) => lane.nodes).find((node) => node.state === 'affordable');
  if (affordable) return affordable.view.id;
  const first = lanes[0];
  return first?.nodes.find((node) => node.parents.length === 0)?.view.id ?? first?.nodes[0]?.view.id ?? null;
}

/**
 * Builds inspector data without reading hidden tooltip getters or deriving game rules.
 * Called by: Firmware panel. Calls: defaultSelection, childrenOf, FirmwareText formatters.
 * @param input The selected id, visible pools, their formatted points and wording.
 * @returns Safe inspector fields, or null when no node exists.
 */
export function buildInspectorView(input: InspectorInput): InspectorView | null {
  const allLanes = [...input.lanes, ...input.sleeveLanes];
  const nodes = allLanes.flatMap((lane) => lane.nodes);
  const selectedId = input.selectedId ?? defaultSelection(allLanes);
  const node = nodes.find((candidate) => candidate.view.id === selectedId);
  if (!node) return null;
  const lane = allLanes.find((candidate) => candidate.nodes.includes(node));
  const persistent = input.sleeveLanes.some((candidate) => candidate.nodes.includes(node));
  const { text } = input;
  const base = {
    id: node.view.id,
    branchTitle: lane?.title ?? '',
    persistent,
    state: node.state,
    status: text.status[node.state],
  };
  if (node.masked || node.state === 'encrypted') {
    return {
      ...base,
      adds: null,
      iconId: null,
      name: text.hidden,
      description: text.hidden,
      requires: [],
      unlocksNext: [],
      costText: null,
      canInstall: false,
      whyNot: text.encryptedHint,
    };
  }
  /** Formats one relationship without exposing encrypted names.
   * Called by: buildInspectorView. Calls: nothing.
   * @param candidate existing parent or child view
   * @returns safe name and installation flag
   */
  const relation = (candidate: SkillNodeView): InspectorRelation => ({
    id: candidate.view.id,
    name: candidate.masked ? text.hidden : candidate.view.name,
    installed: candidate.view.owned > 0,
  });
  const parents = node.parents.flatMap((id) => nodes.filter((candidate) => candidate.view.id === id));
  const firstUnowned = parents.find((parent) => parent.view.owned <= 0);
  const points = persistent ? input.sleevePointsText : input.pointsText;
  let whyNot: string | null = null;
  if (node.state === 'available') whyNot = text.earnMore(points, persistent);
  if (node.state === 'affordable') whyNot = text.have(points);
  if (node.state === 'locked' && firstUnowned) whyNot = text.installFirst(relation(firstUnowned).name);
  return {
    ...base,
    adds: input.adds ?? null,
    iconId: node.view.id,
    name: node.view.name,
    description: node.view.description,
    requires: parents.map(relation),
    unlocksNext: childrenOf(nodes, node.view.id).map(relation),
    costText: `${node.view.costText} ${node.view.costUnit}`.trim(),
    canInstall: node.view.affordable && node.view.clickable,
    whyNot,
  };
}
