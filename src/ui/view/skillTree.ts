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
      rows: Math.ceil(Math.max(0, ...nodes.map((n) => n.row))) + 1,
      nodes,
    };
  });
}

/**
 * Gives each skill of one lane its column (depth) and row. The column is one more than the deepest parent in the lane. The rows come
 * from the tree of first parents: every skill without children takes the next free row, in configuration order, so each path is its own
 * line; a skill with children sits in the middle of the first and last row under it, so the root is centred on the whole lane and no two lines overlap.
 * Extra parents (a skill with several) only add a drawn line; they do not move the skill.
 *
 * Called by: {@link buildSkillLanes}.
 *
 * @param defs the skills of one lane, in configuration order
 * @returns each skill's column, row (may be a half row) and the parents that are in the same lane
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

  const childrenOf = new Map<string, BuyableDefinition[]>();
  for (const b of defs) {
    const first = parentsIn(b)[0];
    if (first !== undefined) childrenOf.set(first, [...(childrenOf.get(first) ?? []), b]);
  }
  const rows = new Map<string, number>();
  const spans = new Map<string, [number, number]>(); // the first and last row of the childless skills under a skill (itself included)
  let nextLeafRow = 0;
  const rowOf = (b: BuyableDefinition): number => {
    const known = rows.get(b.id);
    if (known !== undefined) return known;
    rows.set(b.id, nextLeafRow); // loop guard: a bad config gets some row instead of recursing forever
    spans.set(b.id, [nextLeafRow, nextLeafRow]);
    const kids = childrenOf.get(b.id) ?? [];
    for (const kid of kids) rowOf(kid);
    if (kids.length === 0) {
      rows.set(b.id, nextLeafRow);
      spans.set(b.id, [nextLeafRow, nextLeafRow]);
      return nextLeafRow++;
    }
    const spanOf = kids.map((kid) => spans.get(kid.id) ?? [0, 0]);
    const first = Math.min(...spanOf.map(([lo]) => lo));
    const last = Math.max(...spanOf.map(([, hi]) => hi));
    spans.set(b.id, [first, last]);
    rows.set(b.id, (first + last) / 2);
    return (first + last) / 2;
  };
  const roots = defs.filter((b) => parentsIn(b).length === 0);
  for (const b of [...roots, ...defs]) rowOf(b); // `defs` again only reaches skills in a parent loop

  const placed = new Map<string, { col: number; row: number; parents: string[] }>();
  for (const b of defs) placed.set(b.id, { col: depthOf(b.id), row: rows.get(b.id) ?? 0, parents: parentsIn(b) });
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
