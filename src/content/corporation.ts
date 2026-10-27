/**
 * @module content
 *
 * The corporation: the actions of the Corporation tab. Data only.
 */
import type { CorporationConfig } from '../core';
import { INSIDER_BACKSTABBING, KOMPROMAT } from './ids';

/**
 * The corporation's actions. A corporation run always takes its own duration: interface speed does not apply to the corporation.
 */
export const corporationConfig: CorporationConfig = {
  actions: [
    {
      id: INSIDER_BACKSTABBING,
      name: 'Insider backstabbing',
      /** One run takes 30 seconds. */
      baseDurationMs: 30_000,
      /** Each completed run gives 1 action XP; the levels follow `progression.actionLevels`. */
      xpPerRun: 1,
      effects: [
        /** Each completed run has a 1% chance to upgrade one random Kompromat file you hold to the next rarity (placeholder). */
        { kind: 'upgradeRandomItem', itemId: KOMPROMAT, chance: 0.01 },
      ],
    },
  ],
};
