/**
 * @module ui
 * Automation context display contracts shared by views and persistent widgets.
 * Called by: automationView, automationWidget, viewTypes. Calls: nothing.
 */
import type { AutomationFeature } from '../../core';
import type { AutoBurnView } from './autoBurnViewTypes';
import type { KompromatView } from './kompromatViewTypes';
import type { DispersalView } from './dispersalViewTypes';
import type { SkillLaneView } from './skillTreeTypes';

/** One daemon and its card tree. Called by: automationView, daemonPanel. Calls: nothing. */
export interface AutomationFeatureView {
  readonly id: AutomationFeature;
  readonly name: string;
  readonly description: string;
  readonly unlocked: boolean;
  /** Reveal-safe installation guidance. */
  readonly offlineNote: string;
  /** The feature's skill lane, drawn in its box: the first skill is the unlock, the rest are what the automation can grow into. */
  readonly lanes: readonly SkillLaneView[];
}

/** Resume controls revealed by their permission. Called by: Auto Burn views. Calls: nothing. */
export interface ResumeChecklistView {
  readonly visible: boolean;
  /** One per reachable heat-making item; `locked` while the player does not own it (shown, not tickable). */
  readonly items: readonly { readonly id: string; readonly name: string; readonly ticked: boolean; readonly locked: boolean }[];
}

/** Composed automation panel data. Called by: automationView, automationWidget. Calls: nothing. */
export interface AutomationView {
  readonly title: string;
  /** Automation points still to spend. */
  readonly points: number;
  readonly pointsText: string;
  /** Bare formatted points for the legend. */
  readonly pointsValueText: string;
  readonly features: readonly AutomationFeatureView[];
  readonly autoBurn: AutoBurnView;
  readonly kompromat: KompromatView;
  readonly dispersal: DispersalView;
  /** Autosale: every rarity with its switch. */
  readonly rarities: readonly { readonly id: string; readonly name: string; readonly on: boolean; readonly visible: boolean }[];
  /** Automation context: Back Channel controls hidden until their rarity skill is owned. */
  readonly backchannelRarities: readonly { readonly id: string; readonly name: string; readonly on: boolean; readonly visible: boolean }[];
  /** Automation context: only unlocked actions appear, and only selected actions remain enabled at capacity. */
  readonly actions: readonly {
    readonly id: string;
    readonly name: string;
    readonly selected: boolean;
    readonly visible: boolean;
    readonly disabled: boolean;
  }[];
  /** Automation context: selection count, shown only after dispersal unlocks. */
  readonly dispersalCount: string;
  /** Automation context: permitted schematic rarities already known from inventory; empty before any is known. */
  readonly dispersalRarities: string;
}
