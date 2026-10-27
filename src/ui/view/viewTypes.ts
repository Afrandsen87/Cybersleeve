/**
 * @module ui
 *
 * The display data of the screen: plain readonly interfaces, one per widget. Nothing here has behaviour.
 *
 * @remarks
 * Built by the functions in this folder (see {@link buildViewModel} in `ui/viewModel.ts`), read by `ui/dom.ts`.
 * Hover texts (`tip`, `speedTip`, `backChannelTip`) are getters on the built objects.
 */
import type { AutomationFeature } from '../../core';
import type { SleeveSectionId, SquareCellId, StatId } from '../uiText';
import type { SkillLaneView } from './skillTreeTypes';

export type { SkillLaneView, SkillNodeView } from './skillTreeTypes';

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

/** Display data of one buyable. */
export interface BuyableView {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** Short text for the square button (configured symbol, else the name's initials). */
  readonly symbol: string;
  /** Id of the action this purchase belongs to; absent for sleeve-wide (global) purchases. */
  readonly actionId: string | undefined;
  /** Price of the next copy. */
  readonly costText: string;
  /** What the price is paid in, e.g. `"credits"` or `"nodes"`. */
  readonly costUnit: string;
  /** Copies owned. */
  readonly owned: number;
  /** More than one copy can be bought. */
  readonly repeatable: boolean;
  /** No more copies can be bought. */
  readonly maxed: boolean;
  /** Requirements met and the price within reach of what was held (see `reveal.buyableOrders`; the square's purchases are always in reach); other buyables are hidden. */
  readonly available: boolean;
  /** Can be bought right now. */
  readonly affordable: boolean;
  /** An auto-run purchase: once owned, clicking it switches auto-run on or off instead of buying. */
  readonly toggleable: boolean;
  /** For a toggleable purchase: owned and switched on. */
  readonly enabled: boolean;
  /** The button reacts to a click: it can be bought, or it is an owned toggle. */
  readonly clickable: boolean;
  /** Hover text: name, price or on/off state, and description. Built when read. */
  readonly tip: string;
  /** A rebuyable that has been bought before and can be bought again right now (shown lit up). */
  readonly ready: boolean;
  /** The purchase is shown in the square of its action's card (Auto-run, the Overclock and Focus unlocks), not in the card's row of purchases. */
  readonly inSquare: boolean;
}

/** A titled group of Sleeve purchases. */
export interface SleeveSection {
  readonly id: SleeveSectionId;
  readonly title: string;
  /** Sorted by base price, lowest first. */
  readonly buyables: readonly BuyableView[];
}

/** A thin cycle bar under a stat (a cooldown or decay). */
export interface StatBarView {
  /** Says what the bar is, and when its cycle is paused. */
  readonly label: string;
  /** 0..100, how far the current cycle has progressed. */
  readonly percent: number;
  /** True while the cycle advances (the stat is above 0). */
  readonly running: boolean;
}

/** One labelled value in a stat widget, optionally with a hover explanation and a cycle bar. */
export interface StatRowView {
  readonly id: StatId;
  readonly label: string;
  readonly text: string;
  /** The row has a hover text (known without building it). */
  readonly hasTip: boolean;
  /** Hover text for the whole row; `null` when the stat has none. Built when read (a getter), not when the view model is built. */
  readonly tip: string | null;
  /** Cycle bar shown under the row; `null` when the stat has none. */
  readonly bar: StatBarView | null;
  /** The row is not shown (a stat that exists only once something unlocks it). */
  readonly hidden: boolean;
}

/** Display data of the Sleeve widget: global stats and global purchases. */
export interface SleeveView {
  readonly title: string;
  /** Access level, interface speed, ICE Rating, heat and Legend, in display order. */
  readonly stats: readonly StatRowView[];
  /** The sleeve-wide purchases, in configuration order. */
  readonly buyables: readonly BuyableView[];
  /** The same purchases grouped for display (rebuyable, one-time, paid in nodes), each sorted by base price. Empty groups are left out. */
  readonly sections: readonly SleeveSection[];
}

/** Display data of the Network widget. */
export interface NetworkView {
  readonly title: string;
  /** Nodes, credits per second and payout per node, in display order. */
  readonly stats: readonly StatRowView[];
}

/** Display data of one stack of items (one item in one rarity). */
export interface InventoryRowView {
  readonly itemId: string;
  readonly rarityId: string;
  /** E.g. `"Common Kompromat file"`; just the item's name for an item without rarity. */
  readonly label: string;
  /** Short text shown on the tile when the item has no icon (the initials of the item's name). */
  readonly symbol: string;
  /** Position of the rarity in the list of rarities (0 = most common), for colouring the tile; `null` for an item without rarity. */
  readonly rarityIndex: number | null;
  /** Items held. A tile with 0 is shown dimmed. */
  readonly count: number;
  /** The item is unlocked: a purchase that drops it is owned, or some of it is held. Every rarity of an unlocked item shows, even at 0; an item that is not unlocked is hidden. */
  readonly unlocked: boolean;
  /** Clicking the tile selects the stack for the Augment buttons of the action cards (the Augment schematic). */
  readonly augmentable: boolean;
  /** The stack can be paid out for credits (false for items such as Augment schematics, which are applied instead). */
  readonly sellable: boolean;
  readonly countText: string;
  /** Items of this kind are used up by clicking their tile (Burn leads). */
  readonly usable: boolean;
  /** Clicking the tile now would do something (a lead is held and there is heat to act on; the Zero-day toggle is on or one is held). */
  readonly canUse: boolean;
  /** Clicking the tile switches the item on or off instead of using it up (Zero-days). */
  readonly toggleable: boolean;
  /** For a toggleable item: it is switched on. */
  readonly on: boolean;
  /** The Back Channel Deals skill is owned and this stack can be given up for Moles. */
  readonly backChannel: boolean;
  /** Hover text of the back channel button (empty when `backChannel` is false). */
  readonly backChannelTip: string;
  /** Hover text: what one item sells for and what the whole stack is worth. Built when read. */
  readonly tip: string;
}

/**
 * What the player has selected on the screen. A choice of the screen only: it is not game state and is not saved, so it is handed to
 * the view model next to the engine.
 */
export interface ViewSelection {
  /** The rarity of Augment schematic selected in the Inventory, or `null`. The Augment buttons of the action cards use this rarity. */
  readonly augmentRarityId: string | null;
  /** Test aid: show everything the rules of the game hide (tabs, stats, purchases, items). Default: off. */
  readonly revealAll?: boolean;
}

/** Nothing selected. */
export const NO_SELECTION: ViewSelection = { augmentRarityId: null };

/** Display data of the Inventory widget. */
export interface InventoryView {
  readonly title: string;
  /** The widget is shown once something can drop or is held. */
  readonly visible: boolean;
  /** One row per item and rarity in the configuration, most common first (one row for an item without rarity); rows with a count of 0 are hidden by the screen. */
  readonly rows: readonly InventoryRowView[];
}

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
  /** The unlock button works: a point is left. */
  readonly canUnlock: boolean;
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

/** Display data of one action of the corporation. */
export interface CorporationActionView {
  readonly id: string;
  readonly name: string;
  /** The run bar is filling. */
  readonly running: boolean;
  /** 0..100, how far through the current run. */
  readonly progressPercent: number;
  /** Starting it now would work. */
  readonly startable: boolean;
  /** The one-line description under the title (the run time). */
  readonly infoText: string;
  /** Hover text: what the action does. Built when read (a getter): only the tip under the pointer is ever shown. */
  readonly tip: string;
}

/** Display data of the Corporation tab. */
export interface CorporationView {
  /** Title of the corporation widget. */
  readonly title: string;
  /** The rows of the corporation widget: none yet, the corporation has no figures of its own. */
  readonly stats: readonly StatRowView[];
  /** The corporation's actions, in order. */
  readonly actions: readonly CorporationActionView[];
}

/** Display data of the whole screen. */
export interface ViewModel {
  /** The balance on its own, e.g. `"12"`. */
  readonly creditsText: string;
  /** The balance line, e.g. `"12 credits"`. */
  readonly creditsLine: string;
  /** The tabs at the top, in order. */
  readonly tabs: readonly TabView[];
  readonly skills: SkillsView;
  /** The latest finished sleeve-runs. */
  readonly runs: RunsView;
  readonly automation: AutomationView;
  readonly network: NetworkView;
  readonly corporation: CorporationView;
  readonly inventory: InventoryView;
  readonly actions: readonly ActionView[];
  readonly sleeve: SleeveView;
  readonly canResleeve: boolean;
  /** The Re-sleeve button works as the Re-sleeve action: false while it is still the purchase of the sleeve-levels unlock. */
  readonly resleeveShown: boolean;
  /** While the button is still the purchase of the sleeve-levels unlock: what to show on it; `null` once bought (or when it is not in reach yet). */
  readonly resleeveBuy: ResleeveBuyView | null;
}
