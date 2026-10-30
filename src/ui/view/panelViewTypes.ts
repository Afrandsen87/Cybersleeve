/**
 * @module ui
 *
 * Display data of tabs, automation, re-sleeve, runs and skills: plain readonly interfaces. Nothing here has behaviour.
 *
 * @remarks
 * Part of the view types; `viewTypes.ts` re-exports them, so import from there.
 */
import type { AutomationFeature } from '../../core';
import type { SkillLaneView } from './skillTreeTypes';

/** One tab at the top. */
export interface TabView {
  readonly id: 'character' | 'skills' | 'automation' | 'stats' | 'corporation';
  readonly label: string;
  /** Shown once the tab is useful: no tab shows until the first skill point has been earned. */
  readonly visible: boolean;
  /** The tab blinks: something in it waits for the player (a skill point to spend). */
  readonly attention: boolean;
}

/** One feature in the Automation tab. */
export interface AutomationFeatureView {
  readonly id: AutomationFeature;
  readonly name: string;
  readonly description: string;
  readonly unlocked: boolean;
  /** The feature's skill lane, drawn in its box: the first skill is the unlock, the rest are what the automation can grow into. */
  readonly lanes: readonly SkillLaneView[];
}

/** Display data of the Automation tab. */
export interface AutomationView {
  readonly title: string;
  /** Automation points still to spend. */
  readonly points: number;
  readonly pointsText: string;
  readonly features: readonly AutomationFeatureView[];
  /** Auto Burn: its switch (text and state) and the heat ceiling. */
  readonly autoBurn: { readonly on: boolean; readonly switchText: string; readonly ceiling: number; readonly ceilingLabel: string };
  /** Autosale: every rarity with its switch. */
  readonly rarities: readonly { readonly id: string; readonly name: string; readonly on: boolean }[];
  /** Augment dispersal: every action with its share in percent. */
  readonly actions: readonly { readonly id: string; readonly name: string; readonly percent: number }[];
  /** The label of the share inputs. */
  readonly shareLabel: string;
}

/** The re-sleeve skills: a tree whose nodes need other nodes bought first. */
export interface ResleeveSkillsView {
  readonly title: string;
  /** Shown once the first sleeve-run has finished (before that there is nothing to spend). */
  readonly visible: boolean;
  /** Re-sleeve points that can still be spent. */
  readonly points: number;
  readonly pointsText: string;
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
  /** The note at the top of the tab: skills that read ??? unlock as the player plays on. */
  readonly note: string;
  /** True while any skill that is on screen is masked (once all of them read, the note has nothing to say). */
  readonly noteVisible: boolean;
  /** The skill tree: one lane per branch, in configuration order. */
  readonly lanes: readonly SkillLaneView[];
  /** The group of skills bought with re-sleeve points. */
  readonly resleeve: ResleeveSkillsView;
}

/** The sleeve-levels unlock as it is shown on the Re-sleeve button before it is bought. */
export interface ResleeveBuyView {
  readonly id: string;
  /** Button text: name and price. */
  readonly text: string;
  readonly tip: string;
  readonly affordable: boolean;
}
