/**
 * @module ui
 *
 * Builds the lanes of a skill tree from the skill definitions: which branch each skill is in, where it sits on the grid, and whether its
 * text is readable.
 *
 * @remarks
 * Called by: `panelViews.ts` (the skills and the re-sleeve skills). Calls: nothing outside this file; pure, no engine access.
 *
 * A skill is READABLE when its own gate (`requires`, the purchase that makes it useful) is owned and every parent is readable, so
 * the masking runs down the tree. A skill that is not readable is MASKED: its name, text, price and tip are replaced by the hidden text.
 * The tree itself (every node and its place, the branch titles) is always shown.
 */
import type { BuyableDefinition } from '../../core';
import type { SkillLaneView, SkillNodeView } from './skillTreeTypes';
import type { BuyableView } from './viewTypes';

/** The id of the lane that holds the skills without a `branch`. */
export const GENERAL_LANE = 'general';

/** What {@link buildSkillLanes} needs: the skills and the means to read the game and the text. */
export interface SkillTreeInput {
  /** The skills of this tree (all paid in the same point currency), in configuration order. */
  readonly skills: readonly BuyableDefinition[];
  /** The view of every buyable, by id. */
  readonly viewById: ReadonlyMap<string, BuyableView>;
  /** Copies of a buyable owned (0 when none). */
  readonly owned: (id: string) => number;
  /** The title of the lane of a branch id (`GENERAL_LANE` for the skills without a branch); may be empty. */
  readonly laneTitle: (branchId: string) => string;
  /** The text that replaces a masked skill's name, text, price and tip. */
  readonly hiddenText: string;
  /** False masks the whole tree (the re-sleeve skills before the first re-sleeve). */
  readonly open: boolean;
  /** Test aid ("Show all"): nothing is masked, whatever the gates and `open` say. */
  readonly revealAll: boolean;
}

/**
 * Lays out the skills in lanes and decides which are readable.
 *
 * Called by: `panelViews.ts`. Calls: {@link maskedView}.
 *
 * @param input the skills and what is needed to read them
 * @returns one lane per branch in order of first appearance; a lane's nodes are in configuration order
 */
export function buildSkillLanes(input: SkillTreeInput): SkillLaneView[] {
  const { skills, viewById, owned } = input;
  const byId = new Map(skills.map((b) => [b.id, b]));
  const laneOf = (b: BuyableDefinition): string => b.branch ?? GENERAL_LANE;

  const readableMemo = new Map<string, boolean>();
  const readable = (id: string): boolean => {
    if (input.revealAll) return true;
    const known = readableMemo.get(id);
    if (known !== undefined) return known;
    readableMemo.set(id, false); // guards against a loop (validation rejects those; this keeps a bad config from hanging the screen)
    const b = byId.get(id);
    const result =
      input.open && b !== undefined && (b.requires ?? []).every((r) => owned(r) > 0) && (b.parents ?? []).every((p) => readable(p));
    readableMemo.set(id, result);
    return result;
  };

  const lanes = new Map<string, BuyableDefinition[]>();
  for (const b of skills) lanes.set(laneOf(b), [...(lanes.get(laneOf(b)) ?? []), b]);

  return [...lanes].map(([laneId, defs]) => {
    const places = placeNodes(defs);
    const nodes: SkillNodeView[] = [];
    for (const b of defs) {
      const view = viewById.get(b.id);
      const place = places.get(b.id);
      if (!view || !place) continue;
      const masked = !readable(b.id);
      nodes.push({
        view: masked ? maskedView(view, input.hiddenText) : view,
        col: place.col,
        row: place.row,
        parents: place.parents,
        masked,
        locked: !masked && (b.parents ?? []).some((p) => owned(p) <= 0),
      });
    }
    return {
      id: laneId,
      title: input.laneTitle(laneId),
      cols: Math.max(0, ...nodes.map((n) => n.col)) + 1,
      rows: Math.max(0, ...nodes.map((n) => n.row)) + 1,
      nodes,
    };
  });
}

/**
 * Gives each skill of one lane its column (depth) and row. The column is one more than the deepest parent in the lane. The row is the
 * parent's row when that row is free in the column, otherwise the next free one, so a chain stays on one line.
 *
 * Called by: {@link buildSkillLanes}.
 *
 * @param defs the skills of one lane, in configuration order
 * @returns each skill's column, row and the parents that are in the same lane
 */
function placeNodes(defs: readonly BuyableDefinition[]): Map<string, { col: number; row: number; parents: string[] }> {
  const byId = new Map(defs.map((b) => [b.id, b]));
  const parentsIn = (b: BuyableDefinition): string[] => (b.parents ?? []).filter((p) => byId.has(p) && p !== b.id);
  const depths = new Map<string, number>();
  const depthOf = (id: string): number => {
    const known = depths.get(id);
    if (known !== undefined) return known;
    depths.set(id, 0); // loop guard, as in `buildSkillLanes`
    const b = byId.get(id);
    const needs = b ? parentsIn(b) : [];
    const depth = needs.length === 0 ? 0 : 1 + Math.max(...needs.map(depthOf));
    depths.set(id, depth);
    return depth;
  };
  const placed = new Map<string, { col: number; row: number; parents: string[] }>();
  const taken = new Set<string>(); // "col:row"
  const order = [...defs].sort((a, b) => depthOf(a.id) - depthOf(b.id)); // stable: configuration order within a column
  for (const b of order) {
    const col = depthOf(b.id);
    const parents = parentsIn(b);
    let row = parents.length === 0 ? 0 : Math.min(...parents.map((p) => placed.get(p)?.row ?? 0));
    while (taken.has(`${col}:${row}`)) row += 1;
    taken.add(`${col}:${row}`);
    placed.set(b.id, { col, row, parents });
  }
  return placed;
}

/**
 * A skill's view with its text replaced by the hidden text, and no way to buy it. The tip stays a placeholder: the real tip getter is
 * left out so it is never built for a masked skill.
 *
 * Called by: {@link buildSkillLanes}.
 */
function maskedView(view: BuyableView, hidden: string): BuyableView {
  const { tip: _tip, ...rest } = Object.getOwnPropertyDescriptors(view);
  const copy: Record<string, unknown> = Object.defineProperties({}, rest);
  Object.assign(copy, { name: hidden, description: hidden, symbol: '?', costText: hidden, tip: hidden, clickable: false, ready: false });
  return copy as unknown as BuyableView;
}
