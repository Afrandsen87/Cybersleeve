/**
 * @module ui
 * Loop-safe tree relationships for hover paths and the inspector.
 * Called by: firmware inspector, tree edges and tests. Calls: nothing.
 */
import type { SkillNodeView } from './skillTreeTypes';

/**
 * Finds the selected node and every known ancestor through all parent chains.
 * Called by: tree hover highlighting. Calls: nothing.
 * @param nodes Nodes in the whole tree, including cross-branch parents.
 * @param id Starting node id.
 * @returns Unique ids, starting at the selected node; empty for an unknown id.
 */
export function pathToRoot(nodes: readonly SkillNodeView[], id: string): string[] {
  const byId = new Map(nodes.map((node) => [node.view.id, node]));
  const seen = new Set<string>();
  const pending = [id];
  while (pending.length > 0) {
    const next = pending.pop();
    if (next === undefined || seen.has(next)) continue;
    const node = byId.get(next);
    if (!node) continue;
    seen.add(next);
    pending.push(...node.parents);
  }
  return [...seen];
}

/**
 * Lists direct children once in configuration order, without traversing loops.
 * Called by: inspector and hover highlighting. Calls: nothing.
 * @param nodes Nodes in the whole tree.
 * @param id Parent id.
 * @returns Nodes whose parents include id; empty for an unknown parent.
 */
export function childrenOf(nodes: readonly SkillNodeView[], id: string): SkillNodeView[] {
  return nodes.some((node) => node.view.id === id) ? nodes.filter((node) => node.parents.includes(id)) : [];
}
