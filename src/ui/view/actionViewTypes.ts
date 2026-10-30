import type { SquareCellId } from '../uiText';
import type { BuyableView } from './buyableViewTypes';

/** Display data of an experience track (action level or sleeve level) shown as a small bar. */
export interface XpTrackView {
  readonly level: number;
  /** XP gathered inside the current level. */
  readonly xpText: string;
  /** XP the current level costs in full (what `xpText` is counting towards). */
  readonly nextLevelXpText: string;
  /** 0..100, how far through the current level. */
  readonly progressPercent: number;
}

/** The Augment button of an action card. */
export interface AugmentButtonView {
  /** Button text. */
  readonly label: string;
  /** A schematic is held, so pressing the button applies one. */
  readonly enabled: boolean;
  /** Schematics applied to this action, over all rarities. */
  readonly applied: number;
  /** Hover text. Built when read (a getter): only the tip under the pointer is ever shown. */
  readonly tip: string;
}

/** The add and remove halves a Focus cell is split into once several slots may sit on one action (the Overdrive Cap skill). */
export interface SplitButtonView {
  /** Focus slots on this action now. */
  readonly count: number;
  /** A slot is free and may be added to this action. */
  readonly canAdd: boolean;
  /** This action has a slot to take off. */
  readonly canRemove: boolean;
  /** Hover text of the add half (built when read). */
  readonly addTip: string;
  /** Hover text of the remove half (built when read). */
  readonly removeTip: string;
}

/** A square toggle on an action card (Overclock or Focus). */
export interface ModeButtonView {
  /** Short text on the square button. */
  readonly symbol: string;
  /** Name read out for the button. */
  readonly name: string;
  /** The toggle is switched on. */
  readonly on: boolean;
  /** The button reacts to a click (it can be switched off, or on with a free slot). */
  readonly clickable: boolean;
  /** Hover text. Built when read (a getter): only the tip under the pointer is ever shown. */
  readonly tip: string;
  /** Present when the button is split into add and remove halves (Focus with the Overdrive Cap skill). */
  readonly split?: SplitButtonView;
}

/** One cell of the square on an action card. */
export interface SquareCellView {
  readonly id: SquareCellId;
  /** Short text on the square button (the fallback when the cell has no icon). */
  readonly symbol: string;
  /** Name read out for the button. */
  readonly name: string;
  /**
   * What a press does: `buy` buys the unlock (the feature is not owned yet), `toggle` switches an owned feature on or off, `press`
   * does something once (Augment), `empty` is a placeholder for a feature this action does not have.
   */
  readonly mode: 'buy' | 'toggle' | 'press' | 'empty';
  /** The toggle is on (for Augment: at least one schematic is applied). */
  readonly on: boolean;
  /** The button reacts to a press. */
  readonly clickable: boolean;
  /** A `buy` cell that can be bought right now (shown lit up). */
  readonly ready: boolean;
  /** The buyable behind a `buy` cell or the Auto-run toggle; `null` for the others. */
  readonly buyableId: string | null;
  /** Present on an owned Focus cell that is split into add and remove halves. */
  readonly split?: SplitButtonView;
  /** Hover text. Built when read (a getter): only the tip under the pointer is ever shown. */
  readonly tip: string;
}

/** The square on an action card: beside the bars, holding the toggles of the action. */
export interface ActionSquareView {
  /**
   * Auto-run is not owned yet, so the whole square is the button that buys it (`cells[0]`). Once it is owned the square shows
   * all four cells: Auto-run, Overclock, Focus and Augment.
   */
  readonly locked: boolean;
  /** Always four cells, in the order they sit in the square (two rows of two). */
  readonly cells: readonly SquareCellView[];
}

/** Display data of one action. */
export interface ActionView {
  readonly id: string;
  /** The critical success highlight: `null` while there was no critical success in the last second, else the text to show (a mark, or crits per second). */
  readonly critText: string | null;
  readonly name: string;
  readonly level: number;
  readonly xpText: string;
  readonly nextLevelXpText: string;
  /** Action level bar: 0..100, how far through the current level. */
  readonly levelProgressPercent: number;
  /** The sleeve XP bar is shown: false until the sleeve-levels unlock is bought (the XP is tracked meanwhile). */
  readonly sleeveShown: boolean;
  /** This action's own sleeve level and XP. */
  readonly sleeve: XpTrackView & { readonly runsToNextXp: number };
  readonly speedText: string;
  readonly durationText: string;
  /** Amount actually received per run (all multipliers applied), in units of `rewardUnit`. */
  readonly rewardText: string;
  /** Display unit of the reward, short so it fits on one line, e.g. `"credits"` or `"nodes"`. */
  readonly rewardUnit: string;
  /** Multiplier on this action's reward per run from purchases (`1` when none). */
  readonly rewardMultiplierText: string;
  readonly progressPercent: number;
  readonly running: boolean;
  readonly auto: boolean;
  /** The action can be performed (access level high enough). */
  readonly unlocked: boolean;
  /** Starting it now would work (unlocked, and the start cost can be paid). */
  readonly startable: boolean;
  /** Access level this action needs. */
  readonly requiredAccessLevel: number;
  /** Short reason the action is locked, e.g. `"Needs access level 3"`; `null` while it is unlocked. */
  readonly lockedReason: string | null;
  /** The poster shown instead of the card while the action is locked, e.g. `"Increase Access level to 3"`. */
  readonly posterText: string;
  /** What each run costs to start, e.g. `"50 nodes"` or `"1% of nodes (3)"` (share of the balance, with today's amount); `null` when free. */
  readonly startCostText: string | null;
  /** Heat added by each completed run (0 for none). */
  readonly heatPerRun: number;
  /** The one-line description under the title (speed, duration, cost; or why the action is locked). */
  readonly infoText: string;
  /** Hover text for the info line: how the action's speed comes about (empty while the action is locked). Built when read. */
  readonly speedTip: string;
  /** Label of the action level bar. */
  readonly levelBarText: string;
  /** Label of the sleeve level bar. */
  readonly sleeveBarText: string;
  /** The reward line at the bottom of the card. */
  readonly rewardLine: string;
  /** The purchases that belong to this action (those flagged `inSquare` are shown in its square, the others in its row of purchases). */
  readonly buyables: readonly BuyableView[];
  /** The square beside the bars: Auto-run, Overclock, Focus and Augment. */
  readonly square: ActionSquareView;
  /** The Augment button in the top right corner of the card; `null` when the game has no schematic to apply. */
  readonly augment: AugmentButtonView | null;
  /** The Overclock toggle; `null` until the Overclock buyable is owned, and for an action that has no Overclock effect. */
  readonly overclock: ModeButtonView | null;
  /** The Focus toggle; `null` until a Focus slot is owned. */
  readonly focus: ModeButtonView | null;
}
