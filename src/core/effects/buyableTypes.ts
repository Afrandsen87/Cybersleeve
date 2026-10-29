/**
 * @module core
 *
 * Shapes of purchases: the buyable definition, its currencies and (re-exported) its effect union.
 *
 * @remarks
 * The effect kinds themselves live in `effects/kinds/<family>.ts`; this file stays the one import path for them.
 * Called by: the `../types` barrel and every module that types a buyable. Calls: nothing.
 */
import type { BigNum } from '../../numbers';
import type { ActionId } from '../actions/actionTypes';
import type { CorporationActionId } from '../corporation/corporationTypes';
import type { BuyableEffect } from './kinds';

export type { BuyableEffect } from './kinds';

/** Identifier of a buyable (e.g. `"auto-run"`). Never shown to the player. */
export type BuyableId = string;

import type { Currency } from '../kernel/currencies';
export type { Currency, PointCurrency } from '../kernel/currencies';

/** Static description of a purchase (one-time or repeatable). It is shown on its action's card, or in the Sleeve widget when it has no action. */
export interface BuyableDefinition {
  readonly id: BuyableId;
  /** The corporation action whose card shows this purchase (and whose runs an `addsCorporationEffect` effect changes). Not used together with `actionId`. */
  readonly corporationActionId?: CorporationActionId;
  /** The action whose card shows this purchase (and whose behaviour an action effect changes). Absent: shown in the Sleeve widget. */
  readonly actionId?: ActionId;
  readonly name: string;
  /** What the purchase does, in a sentence (shown in the hover tooltip). */
  readonly description: string;
  /** A formula that explains the effect, shown under the description in the tooltip (e.g. `"Growth factor percentage = Action level / 1000"`). */
  readonly formula?: string;
  /** Short text shown on the purchase's square button (default: initials of `name`). */
  readonly symbol?: string;
  /** Price of the first copy, in `currency` (before `global.costMultiplier`). */
  readonly cost: BigNum;
  /** What the price is paid in. Default: credits. Paying in network nodes removes those nodes. */
  readonly currency?: Currency;
  readonly effect: BuyableEffect;
  /**
   * Buyables that must be owned before this one becomes available. Default: none. For a skill this is the REVEAL GATE: the purchase that
   * makes it useful (until it is owned the skill's text is hidden). Tree edges are `parents`, not `requires`.
   */
  readonly requires?: readonly BuyableId[];
  /**
   * Re-sleeves that must have happened (finished sleeve-runs, `GameState.runs.length`) before this is available. Default: 0 (no
   * rule). 1 means "from the player's second sleeve run on". Checked by `Shop.isAvailable`, so it hides the buyable and blocks buying it.
   */
  readonly revealAfterResleeves?: number;
  /**
   * Skill-tree edges: the skills that must be owned before this one can be bought (the skill is drawn after them in its branch, with a line from each parent). Every parent is in the same `branch` (validated). A skill
   * is readable only when its `requires` are owned and all its parents are readable. Default: none (a root of its branch).
   */
  readonly parents?: readonly BuyableId[];
  /**
   * The skill-tree branch this skill is drawn in (a lane of the Skills tab; its title is in the text table, its colour in the style
   * sheet). Skills without a branch share one general lane. Only meaningful for skills.
   */
  readonly branch?: string;
  /** How many copies can be bought; `Infinity` for unlimited. Default: 1. */
  readonly maxPurchases?: number;
  /** Price multiplier per copy already owned (>= 1). Default: 1 (constant price). */
  readonly costGrowth?: number;
}
