/**
 * @module ui
 *
 * The shape of the text table (`UiText`), apart from the words.
 *
 * @remarks
 * Split out of `uiText.ts`, which holds the default words and re-exports this type, so import it from there.
 */
import type { KompromatText } from './view/kompromatViewTypes';
import type { DispersalText } from './view/dispersalViewTypes';
import type { AutoBurnText } from './autoBurnText';
import type { FirmwareText } from './firmwareText';

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
  /** Firmware-tab inspector, branch and legend wording. */
  readonly firmware: FirmwareText;
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
    readonly pointsLabel: string;
    readonly firmwareTitle: string;
    readonly online: string;
    readonly offline: string;
    offlineNote(name: string | null): string;
    readonly kompromat: KompromatText;
    readonly dispersal: DispersalText;
    points(points: string): string;
    /** The name and what each feature does. */
    readonly features: Readonly<Record<AutomationFeature, { readonly name: string; readonly description: string }>>;
    /** Auto Burn: where the toggle is, the label of each switch, and the labels of the thresholds and the reserve. */
    readonly autoBurn: AutoBurnText;
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
  /** The same units for a price of exactly one ("1 firmware point"). */
  readonly costUnitsOne: Readonly<Record<Currency, string>>;
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

  /** The re-sleeve box: button words, status words and the lines under the title. The ledger and the Ready state's "on arrival" line read the same `ledger.gains`. */
  readonly resleeve: {
    readonly idle: string;
    /** The verb on the Unlock resleeving button (the price follows it). */
    readonly unlock: string;
    readonly confirm: string;
    readonly cancel: string;
    /** The status light's words (the title row), per state. */
    readonly status: {
      readonly locked: string;
      readonly charging: string;
      readonly ready: string;
      readonly armed: string;
      percent(percent: string): string;
    };
    /** One line under the title while Unlock resleeving is not owned. */
    readonly lockedHint: string;
    /** @param have the credits held, with unit */
    have(have: string): string;
    /** @param toGo what is still missing of the price, with unit */
    haveToGo(have: string, toGo: string): string;
    /** The line of a requirement not yet met: how many sleeve levels (all actions together) the next re-sleeve needs and how many are held. */
    needLevels(kind: 'sleeveLevels', held: string, needed: string): string;
    /** The Ready state's line; `gain` is `ledger.gains.what`. */
    onArrival(gain: string): string;
    /** The three lines of the armed box. */
    readonly ledger: {
      readonly resets: { readonly label: string; readonly what: string };
      readonly keeps: { readonly label: string; readonly what: string };
      readonly gains: { readonly label: string; what(points: number): string };
    };
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
