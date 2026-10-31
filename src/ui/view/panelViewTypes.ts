/**
 * @module ui
 *
 * Display data of tabs, automation, re-sleeve, runs and skills: plain readonly interfaces. Nothing here has behaviour.
 *
 * @remarks
 * Part of the view types; `viewTypes.ts` re-exports them, so import from there.
 */

import type { TAB_IDS } from '../../core';
import type { SkillLaneView } from './skillTreeTypes';

/** One tab at the top. */
export interface TabView {
  readonly id: (typeof TAB_IDS)[number];
  readonly label: string;
  /** Unspent points, or null when none are available. */
  readonly count: number | null;
  /** Shown once the tab is useful: no tab shows until the first skill point has been earned. */
  readonly visible: boolean;
  /** The tab blinks: it has earned points the player has not looked at yet (see `tabAttention.ts`). */
  readonly attention: boolean;
}

export type { AutomationFeatureView, AutomationView, ResumeChecklistView } from './automationViewTypes';

/** The sleeve skills: a tree whose nodes need other nodes bought first. */
export interface ResleeveSkillsView {
  readonly title: string;
  /** Shown once the first sleeve-run has finished (before that there is nothing to spend). */
  readonly visible: boolean;
  /** Sleeve skill points that can still be spent. */
  readonly points: number;
  readonly pointsText: string;
  /** Bare formatted points for the panel readout and inspector. */
  readonly pointsValueText: string;
  /** The tree: one lane, grown sideways from the skills that need nothing. */
  readonly lanes: readonly SkillLaneView[];
}

/** One finished sleeve-run in the Stats tab. */
export interface RunRowView {
  /** E.g. `"Run 3"`. */
  readonly label: string;
  /** Credits per second the sleeve ended with. */
  readonly incomeText: string;
  /** The total of its action levels. */
  readonly levelsText: string;
  /** The level of each action in that run, in the order of the actions; empty for a run written down before levels were kept. */
  readonly actionLevelTexts: readonly string[];
}

/** Display data of the Stats tab. */
export interface RunsView {
  readonly title: string;
  /** The latest runs, newest first (at most `resleeve.runsShown`). */
  readonly rows: readonly RunRowView[];
}

/** Display data of the Skills tab. */
export interface SkillsView {
  readonly title: string;
  /** Skill points that can still be spent. */
  readonly points: number;
  readonly pointsText: string;
  /** Bare formatted points for the panel readout and inspector. */
  readonly pointsValueText: string;
  /** True while any skill that is on screen is encrypted. */
  readonly legendVisible: boolean;
  /** The skill tree: one lane per branch, in configuration order. */
  readonly lanes: readonly SkillLaneView[];
  /** The group of skills bought with sleeve skill points. */
  readonly resleeve: ResleeveSkillsView;
}

/** The sleeve-levels unlock as it is shown on the Re-sleeve button before it is bought. */
export interface ResleeveBuyView {
  readonly id: string;
  /** Button text: name and price. */
  readonly text: string;
  /** The price with its unit, for the box's button. */
  readonly priceText: string;
  readonly tip: string;
  readonly affordable: boolean;
}
