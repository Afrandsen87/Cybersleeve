/**
 * @module ui
 *
 * The text an action card is written with: its info, bars, reward and costs lines, the square cells and the critical flash.
 *
 * @remarks
 * Pure types; part of `UiText` (`uiText.action`). Called by: `uiTextTypes.ts`, the action views. Calls: nothing.
 */
import type { ActionInfoParts, RewardLineParts } from './actionTipParts';
import type { SquareCellId } from './idParts';

/** The texts of an action card. */
export interface ActionText {
  locked(reason: string): string;
  info(parts: ActionInfoParts): string;
  levelBar(level: number, xp: string, next: string): string;
  sleeveBar(level: number, xp: string, next: string, runsToNext: number): string;
  reward(parts: RewardLineParts): string;
  /** The costs line under the reward line of a card: its cost items joined (empty text for none). */
  costs(items: readonly string[]): string;
  /** The cost items of a run (everything a run costs or makes worse), each a short phrase. */
  readonly cost: {
    /** Heat of a completed run, with the chance in percent that it happens (`null`: every run). */
    heatPerRun(amount: string, chancePercent: string | null): string;
    /** Heat per second the action runs. */
    heatPerSecond(amount: string): string;
    /** Heat per minute the action runs while Overclock is on. */
    heatPerMinute(amount: string): string;
    /** What starting the action costs (already formatted). */
    start(cost: string): string;
    /** Nodes each completed run takes while Overclock is on. */
    nodesPerRun(amount: string): string;
    /** The Overclock holds heat in place (no cooling, no Burn leads) while the action runs. */
    holdsHeat: string;
  };
  /** The label of the button in the top right corner of an action card that applies a schematic. */
  readonly augment: string;
  /** The names of the factors in the XP per run tip (a factor of 1 is left out of the tip). */
  readonly xpFactors: { readonly lever: string; readonly augments: string; readonly mirror: string };
  /** The critical success highlight of a card: just a mark for one success in the last second, an average per second for several. */
  critFlash(count: number, perSecond: string): string;
  /** The cells of the square on an action card: the symbol on the square button and the name read out for it. */
  readonly modes: Readonly<Record<SquareCellId, { readonly symbol: string; readonly name: string }>>;
}
