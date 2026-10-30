/**
 * @module ui
 *
 * The display data of a skill tree: lanes of nodes placed on a grid. Shared by the skills and the re-sleeve skills.
 *
 * @remarks
 * Called by: `skillTree.ts` (builds them), `viewTypes.ts` (re-exports them), `ui/widgets/skillTree.ts` (draws them).
 */
import type { BuyableView } from './buyableViewTypes';

/** One skill in a tree, with its place on the grid. The tree grows sideways: `col` is the depth, `row` the position within the lane. */
export interface SkillNodeView {
  /** What the node's button shows. When `masked`, the name, text, price and tip read as hidden. */
  readonly view: BuyableView;
  /** Depth in the lane: 0 for a root, one more than its deepest parent in the lane otherwise. Left to right on screen. */
  readonly col: number;
  /** Row within the lane (a child starts on its parent's row when it is free). Top to bottom on screen. */
  readonly row: number;
  /** Ids of the parents (always in the same lane, so every one has a line drawn to this node). */
  readonly parents: readonly string[];
  /** True while the skill's text is hidden: its gate is not met, or a parent is itself masked. */
  readonly masked: boolean;
  /** True when the skill is readable but cannot be bought yet because a parent is not owned (drawn dimmed). */
  readonly locked: boolean;
}

/** One branch of a tree: a lane with a title, drawn sideways with its own colour. */
export interface SkillLaneView {
  /** The branch id (the style sheet colours the lane by it). */
  readonly id: string;
  /** The lane's title; never hidden. Empty when the widget's own heading already says it. */
  readonly title: string;
  /** Number of columns (the deepest node's `col` plus one). */
  readonly cols: number;
  /** Number of rows (the lowest node's `row` plus one). */
  readonly rows: number;
  /** True while the whole lane (title and nodes) is not shown, because its branch's reveal condition is not met. The lane is still built so the widget's shape never changes. */
  readonly hidden: boolean;
  /** The nodes, in configuration order. */
  readonly nodes: readonly SkillNodeView[];
}
