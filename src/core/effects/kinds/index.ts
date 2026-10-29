/**
 * @module core
 *
 * The union of every buyable effect kind, composed from the per-family files in this folder.
 *
 * @remarks
 * Add a new `kind` to the file of its family and ONE entry in `effects/effectRegistry.ts` to add a new effect type. Called by:
 * `effects/buyableTypes.ts` (`BuyableDefinition.effect`), the `../types` barrel. Calls: nothing.
 */
import type { ActionEffect } from './action';
import type { SleeveEffect } from './sleeve';
import type { HeatEffect } from './heat';
import type { ItemEffect } from './items';
import type { ResleeveKindEffect } from './resleeve';
import type { CorporationKindEffect } from './corporation';

/**
 * What a purchase does. Add a new `kind` to the file of its family in this folder and one entry in `effectRegistry.ts`.
 * An effect applies once per copy owned (see `BuyableDefinition.maxPurchases`).
 *
 * - Action effects (`autoRun`, `rewardMultiplier`, `itemDrop`, `rarityShiftFromProficiency`) change the action the buyable belongs to. `rewardMultiplier` scales that action's own
 *   reward per run and nothing else: not its XP, not the runs counted towards sleeve XP, not its heat or completion effects.
 * - Sleeve effects (`interfaceSpeed`, `accessLevel`, `networkGrowth`, `networkGrowthFromActionLevel`, `interfaceSpeedPerLnNodes`, `sleeveXpReduction`) change the
 *   game as a whole; the buyable may still belong to an action, which only decides on which card it is shown.
 * - `levelBonusFromSleeveLevel` links two actions: it adds one action's sleeve level to another action's level for speed.
 */
export type BuyableEffect = ActionEffect | SleeveEffect | HeatEffect | ItemEffect | ResleeveKindEffect | CorporationKindEffect;
