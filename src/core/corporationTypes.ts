/**
 * @module core
 *
 * The Corporation: actions that belong to the corporation, not to the character.
 *
 * @remarks
 * Pure data shapes, no behaviour. A corporation action is deliberately NOT an `ActionDefinition`: it has no interface speed, no
 * levels, no Overclock or Focus, no heat and no buyables of its own. Its run time is fixed, because the corporation scales
 * differently from the character. What it does when a run completes is a list of {@link CorporationEffect}s; a new kind of effect is
 * one union member here plus one entry in `corporationEffects.ts`.
 */
import type { ItemId } from './itemTypes';

/** Identifier of a corporation action (e.g. `"insider-backstabbing"`). Never shown to the player. */
export type CorporationActionId = string;

/** What a completed corporation run does. Add a new `kind` here and in `corporationEffects.ts` to add a new effect type. */
export type CorporationEffect =
  /**
   * Each completed run has `chance` to upgrade ONE random item held: a stack of the item is picked at random, weighted by how many
   * are held in it, and one item moves from that rarity to the next. Items of the highest rarity stay as they are; with nothing
   * to upgrade the run does nothing. The item must exist in several rarities.
   */
  { readonly kind: 'upgradeRandomItem'; readonly itemId: ItemId; readonly chance: number };

/** Static description of an action of the corporation. */
export interface CorporationActionDefinition {
  readonly id: CorporationActionId;
  /** Display name (placeholder, may be renamed freely). */
  readonly name: string;
  /** Duration of one run, in milliseconds (> 0). Nothing speeds it up or slows it down: interface speed does not apply here. */
  readonly baseDurationMs: number;
  /** The corporate rank needed to start the action (an integer >= 1). Default: 1. */
  readonly requiredRank?: number;
  /** Applied once for each completed run, in order. */
  readonly effects: readonly CorporationEffect[];
}

/** The content of the Corporation tab. */
export interface CorporationConfig {
  /** The corporate rank before any `corporateRank` purchase (an integer >= 1). Default: 1. */
  readonly baseRank?: number;
  /** The actions of the corporation, in the order the tab lists them. */
  readonly actions: readonly CorporationActionDefinition[];
}

/** Mutable progress of one corporation action. */
export interface CorporationActionState {
  /** True while the progress bar is filling. */
  running: boolean;
  /** The share of the current run that is done: from 0 up to (not including) 1 (0 when idle). */
  progress: number;
}

/**
 * The state of the corporation. It belongs to the corporation, not to the sleeve, so a re-sleeve keeps it (it is on the carry-over
 * lists of `state.ts`).
 */
export interface CorporationState {
  /** Progress per corporation action id. */
  actions: Record<CorporationActionId, CorporationActionState>;
}
