/**
 * @module core
 *
 * The automation settings' part of a save (wallet `automation`).
 */
import { isRecord } from '../kernel/readValues';
import type { SavePart } from '../kernel/savePart';
import type { GameConfig } from '../types';
import { type AUTOMATION_FEATURES, isFeatureUnlocked } from './automation';

/**
 * Reads the automation settings (a feature is unlocked when its skill is owned, so this part runs after the purchases are read): Auto Burn is on
 * only when unlocked, the ceiling must be a finite number >= 0, and autosale and dispersal keep only known rarities and actions (shares clamped to 1..100).
 *
 * Called by: {@link automationSavePart}. Calls: `isFeatureUnlocked`.
 */
export const automationSavePart: SavePart<Pick<GameConfig, 'automation' | 'buyables' | 'items' | 'actions'>> = {
  name: 'automation',
  write: (state) => {
    const { automation } = state.wallet;
    return {
      wallet: {
        automation: {
          autoBurnOn: automation.autoBurnOn,
          autoBurnCeiling: automation.autoBurnCeiling,
          autosale: { ...automation.autosale },
          dispersal: { ...automation.dispersal },
        },
      },
    };
  },
  read: (state, saved, config) => {
    const raw = saved.wallet['automation'];
    if (config.automation === undefined || !isRecord(raw)) return;
    const unlocked = (feature: (typeof AUTOMATION_FEATURES)[number]): boolean =>
      isFeatureUnlocked(config.buyables, state.sleeve.purchased, feature);
    const auto = state.wallet.automation;
    const ceiling = raw['autoBurnCeiling'];
    if (typeof ceiling === 'number' && Number.isFinite(ceiling) && ceiling >= 0) auto.autoBurnCeiling = ceiling;
    auto.autoBurnOn = raw['autoBurnOn'] === true && unlocked('autoBurn');
    const savedSale = isRecord(raw['autosale']) ? raw['autosale'] : {};
    const savedShares = isRecord(raw['dispersal']) ? raw['dispersal'] : {};
    if (unlocked('autosale')) for (const r of config.items.rarities) if (savedSale[r.id] === true) auto.autosale[r.id] = true;
    if (unlocked('dispersal')) {
      let room = 100;
      for (const a of config.actions) {
        const share = savedShares[a.id];
        if (typeof share !== 'number' || !Number.isFinite(share) || share <= 0 || room <= 0) continue;
        auto.dispersal[a.id] = Math.min(room, share);
        room -= auto.dispersal[a.id] ?? 0;
      }
    }
  },
};
