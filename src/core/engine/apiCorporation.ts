/**
 * @module core
 *
 * The corporation's face for the outside world: questions and commands, keyed by corporation id.
 *
 * @remarks
 * Split out of `api.ts` (which re-exports both interfaces) to keep that file small. While there is one corporation the optional
 * {@link CorporationId} on each method is ignored; a later layer with several corporations passes it.
 */
import type { BigNum } from '../../numbers';
import type { CorporationId } from '../kernel/savePart';
import type { CorporationActionDefinition, CorporationActionId } from '../types';

/** Read-only questions about the corporation. Called by: `ui/view/corporationView.ts`. */
export interface CorporationQueries {
  /** True while the Corporation tab is open (a purchase with the `unlocksCorporation` effect is owned). */
  isCorporationUnlocked(corporationId?: CorporationId): boolean;
  /** The corporate rank (what gates the corporation's actions). */
  corporateRank(corporationId?: CorporationId): number;
  /** True once the option to buy synthetic sleeves on the Corporation tab is open (the Synthetic Procurement skill). */
  synthPurchaseUnlocked(corporationId?: CorporationId): boolean;
  /** How long one run of a corporation action takes now, in milliseconds (its action level speeds it up). */
  corporationRunMs(id: CorporationActionId, corporationId?: CorporationId): number;
  /** Stocks of competitors the corporation holds. */
  corporationStocks(corporationId?: CorporationId): number;
  /** The action level of a corporation action (0 at the start). */
  corporationLevel(id: CorporationActionId, corporationId?: CorporationId): number;
  /** Action XP gathered inside the current level of a corporation action. */
  corporationXpIntoLevel(id: CorporationActionId, corporationId?: CorporationId): BigNum;
  /** Action XP the current level of a corporation action costs on its own. */
  corporationXpForLevel(id: CorporationActionId, corporationId?: CorporationId): BigNum;
  /** How far through its current level a corporation action is, from 0 to 1. */
  corporationLevelProgress(id: CorporationActionId, corporationId?: CorporationId): number;
  /** The corporation's actions, in the order the tab lists them. */
  corporationActions(corporationId?: CorporationId): readonly CorporationActionDefinition[];
  /** True when starting the corporation action now would work. */
  canStartCorporationAction(id: CorporationActionId, corporationId?: CorporationId): boolean;
}

/** Commands on the corporation. Called by: `ui/widgets/corporationCards.ts`. */
export interface CorporationCommands {
  /** Starts a corporation action. @returns true when it is now running */
  startCorporationAction(id: CorporationActionId, corporationId?: CorporationId): boolean;
}
