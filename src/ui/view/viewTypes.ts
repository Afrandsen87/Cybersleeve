import type { ActionView } from './actionViewTypes';
import type { SleeveView, NetworkView } from './sleeveViewTypes';
import type { InventoryView } from './inventoryViewTypes';
import type { TabView, AutomationView, RunsView, SkillsView, ResleeveBuyView } from './panelViewTypes';
import type { CorporationView } from './corporationViewTypes';

export type { SkillLaneView, SkillNodeView } from './skillTreeTypes';
export type {
  XpTrackView,
  AugmentButtonView,
  SplitButtonView,
  ModeButtonView,
  SquareCellView,
  ActionSquareView,
  ActionView,
} from './actionViewTypes';
export type { BuyableView } from './buyableViewTypes';
export type { SleeveSection, StatBarView, StatRowView, SleeveView, NetworkView } from './sleeveViewTypes';
export type { InventoryRowView, ViewSelection, InventoryView } from './inventoryViewTypes';
export type {
  TabView,
  AutomationFeatureView,
  AutomationView,
  ResleeveSkillsView,
  RunRowView,
  RunsView,
  SkillsView,
  ResleeveBuyView,
} from './panelViewTypes';
export type { CorporationActionView, CorporationView } from './corporationViewTypes';
export { NO_SELECTION } from './inventoryViewTypes';

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
  /**
   * While the button is the Re-sleeve action and the sleeve levels held are short of what the next re-sleeve needs: how many are held and needed;
   * otherwise `null`. Only set once the sleeve-levels unlock is owned (the button, and the idea of sleeve levels, are hidden before).
   */
  readonly resleeveShortfall: { readonly held: number; readonly needed: number } | null;
}
