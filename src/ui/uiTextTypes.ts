/**
 * @module ui
 *
 * The shape of the text table (`UiText`), apart from the words.
 *
 * @remarks
 * Split out of `uiText.ts`, which holds the default words and re-exports this type, so import it from there.
 */
import type { AutoBurnText } from './autoBurnText';

import type { AutomationFeature, CorporationEffect, Currency, RewardKind } from '../core';
import type { TipTexts } from './tipTextTypes';
import type { ActionText } from './parts/actionText';
import type { StashText } from './parts/stashText';
import type { MainScreenText } from './parts/hudText';
import type { UpgradeTileText } from './parts/upgradeText';

import type { SleeveSectionId, StatId } from './uiTextParts';

export * from './uiTextParts';

/** All display text of the interface. */
export interface UiText {
  /** Inventory slot captions and gains. */
  readonly stash: StashText;
  /** An amount per second, e.g. `"0.015/s"`. */
  perSecond(amount: string): string;
  /** Small display forms of numbers that other texts are built from. */
  readonly format: {
    /** A speed multiplier, e.g. `x1.5`. */
    speed(value: string): string;
    /** An income per second with its sign, e.g. `+12`. */
    income(value: string): string;
    /** A number of heat points, e.g. `200 heat`. */
    heatPoints(value: string): string;
    /** A power of ten, e.g. `1e200`. */
    powerOfTen(exponent: string): string;
    /** A duration in seconds, e.g. `3.33s`. */
    seconds(value: string): string;
  };
  /** The balance line, e.g. `"12 credits"`. */
  credits(amount: string): string;
  /** Widget titles; upgrades heads both currency rows. */
  readonly titles: {
    readonly sleeve: string;
    readonly network: string;
    readonly inventory: string;
    readonly upgrades: string;
    readonly skills: string;
    readonly resleeveSkills: string;
    readonly stats: string;
    readonly automation: string;
    readonly corporation: string;
    /** The three widgets beside the corporation widget on the Corporation tab. */
    readonly holdings: string;
    readonly assetAcquisition: string;
    readonly hostileNegotiation: string;
    /** The widget the Synthetic Procurement skill opens on the Corporation tab. */
    readonly syntheticSleeves: string;
  };
  /** The tabs at the top. The Skills tab shows the points available, unless there are none. */
  readonly tabs: {
    readonly character: string;
    readonly skills: string;
    readonly automation: string;
    readonly stats: string;
    readonly corporation: string;
  };
  /** The Corporation tab: how its actions are described. */
  readonly corporation: {
    /** The line under an action's title. */
    info(duration: string): string;
    /** The line under the title of an action the rank does not reach yet. */
    locked(rank: number): string;
    /** The hover text of an action: its name, its run time and what it does (one line per effect). */
    tip(parts: { readonly name: string; readonly duration: string; readonly effects: readonly string[] }): string;
    /** One sentence per kind of effect; a kind without one does not compile. */
    readonly effects: {
      readonly [K in CorporationEffect['kind']]: (
        effect: Extract<CorporationEffect, { kind: K }>,
        itemName: (id: string) => string,
        percent: string,
      ) => string;
    };
  };
  /** The Automation tab: the points, each feature and its controls. */
  readonly automation: {
    points(points: string): string;
    /** The name and what each feature does. */
    readonly features: Readonly<Record<AutomationFeature, { readonly name: string; readonly description: string }>>;
    /** Auto Burn: where the toggle is, the label of each switch, and the labels of the thresholds and the reserve. */
    readonly autoBurn: AutoBurnText;
    /** Automation context: selected action count and owned capacity. */
    dispersalCount(selected: number, slots: number): string;
    /** Automation context: permitted schematic rarities the player already knows. */
    dispersalRarities(rarities: readonly string[]): string;
    /** Automation context: the label of an owned rarity switch. */
    autoBackchannel(rarity: string): string;
  };
  /** The Skills box and the sleeve skills group. */
  readonly skills: {
    points(points: string): string;
    resleevePoints(points: string): string;
    /** Stands in for the name, description, price and tip of a skill while it is masked (its gate is not met, or until the first re-sleeve). */
    readonly hidden: string;
    /** The titles of the skill-tree branches by branch id (`content/ids.ts`); a branch without a title shows its id. */
    readonly branches: Readonly<Record<string, string>>;
    /** The title of the lane that holds the skills without a branch. */
    readonly generalBranch: string;
    /** The note at the top of the Skills tab, shown while some skill is still masked. */
    readonly note: string;
  };
  /** The Stats tab: the list of the latest finished sleeve-runs. */
  readonly runs: {
    readonly empty: string;
    readonly headers: { readonly run: string; readonly income: string; readonly levels: string };
    /** The number of a run, e.g. `"Run 3"`. */
    label(number: number): string;
    /** The level one action had reached in a run, e.g. `"Grow network 12"`. */
    actionLevel(name: string, level: string): string;
  };
  /** The Inventory widget. */
  readonly inventory: {
    /** The name of a stack, e.g. `"Common Kompromat file"`. */
    label(rarity: string, item: string): string;
    /** The headings of the two sections: items that are kept or used, and items that can be sold (selected, then sold with the buttons). */
    readonly sections: { readonly kept: string; readonly sellable: string };
    readonly sellOne: string;
    readonly sellAll: string;
    readonly backChannel: string;
  };
  readonly sections: Readonly<Record<SleeveSectionId, string>>;
  readonly statLabels: Readonly<Record<StatId, string>>;
  /** Label of the bar under a decaying stat; says so when the cycle is paused. */
  readonly bars: { heat(running: boolean): string; readonly legend: string };
  /** Display unit of each reward kind (UI text only; logic never reads it). */
  readonly rewardUnits: Readonly<Record<RewardKind, string>>;
  /** Display unit of each currency a buyable can be paid in. */
  readonly costUnits: Readonly<Record<Currency, string>>;
  /** Why an action is locked, in a few words. */
  readonly lock: { access(level: number): string; poster(level: number): string };
  /** What starting an action costs. */
  readonly startCost: {
    amount(amount: string, unit: string): string;
    share(percent: string, unit: string, current: string | null): string;
    join(parts: readonly string[]): string;
    none(unit: string): string;
  };
  /** The texts of an action card (see `ActionText`). */
  readonly action: ActionText;
  readonly tips: TipTexts;
  /** The top bar, the Sleeve stat groups, the heat gauge and the panel status lights. */
  readonly mainScreen: MainScreenText;
  /** Wording for opt-in purchase tiles. */
  readonly upgradeTiles: UpgradeTileText;

  readonly resleeve: {
    readonly idle: string;
    readonly armed: string;
    readonly cancel: string;
    /** The tip of the disabled Re-sleeve button: how many sleeve levels (all actions together) are held and how many the next re-sleeve needs. */
    needLevels(kind: 'sleeveLevels', held: string, needed: string): string;
  };
  /** Messages shown over the game. */
  readonly notices: { readonly otherTab: string; readonly taken: string };
  /** The buttons and messages for moving a save in and out as text. */
  readonly saveTools: {
    readonly export: string;
    readonly exportTip: string;
    readonly import: string;
    readonly importTip: string;
    readonly exported: string;
    readonly exportFailed: string;
    readonly importPrompt: string;
    readonly imported: string;
    readonly importInvalid: string;
  };
  /** The changelog button and its modal. */
  readonly changelog: {
    readonly button: string;
    readonly tip: string;
    readonly title: string;
    readonly empty: string;
    readonly close: string;
  };
  readonly controls: {
    readonly resetSave: string;
    readonly resetSaveTip: string;
    readonly revealLocked: string;
    readonly revealLockedTip: string;
    readonly testDrop: string;
    readonly testDropTip: string;
    readonly doubleCredits: string;
    readonly doubleCreditsTip: string;
    /** Label of the icon button in the corner of an action card that starts a run. */
    readonly startRun: string;
    speedToggle(factor: number): string;
    readonly speedToggleTip: string;
  };
}
