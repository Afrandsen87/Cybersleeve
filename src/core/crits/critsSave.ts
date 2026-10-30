/**
 * @module core
 *
 * The critical-success part of a save (sleeve `bankedCriticals`, `keyToggles`, `hardeningCrits`).
 */
import { isRecord, readCount } from '../kernel/readValues';
import type { SavePart } from '../kernel/savePart';
import type { GameConfig } from '../types';

/**
 * The banked critical successes and the key toggles. A key toggle stays on only while the key is held (it switches itself off at 0), so this
 * part must be read after the inventory and the purchases. `hardeningCrits` (one count per buyable, `{}` when none) is read only for owned buyables
 * (missing or malformed loads {}); each count is a whole number > 0. The off toggles are not written, so save, load, save gives the same text.
 *
 * Called by: `save/saveParts.ts`. Calls: `readCount`.
 */
export const critsSavePart: SavePart<Pick<GameConfig, 'actions' | 'items' | 'buyables'>> = {
  name: 'crits',
  write: (state) => ({
    sleeve: {
      keyToggles: Object.fromEntries(Object.entries(state.sleeve.keyToggles).filter(([, on]) => on)),
      bankedCriticals: { ...state.sleeve.bankedCriticals },
      hardeningCrits: { ...state.sleeve.hardeningCrits },
    },
  }),
  read: (state, raw, config) => {
    const sleeve = state.sleeve;
    const savedBank = isRecord(raw.sleeve['bankedCriticals']) ? raw.sleeve['bankedCriticals'] : {};
    for (const def of config.actions) {
      const count = Math.min(readCount(savedBank[def.id]), Number.MAX_SAFE_INTEGER);
      if (count > 0) sleeve.bankedCriticals[def.id] = count;
    }
    const savedHardening = isRecord(raw.sleeve['hardeningCrits']) ? raw.sleeve['hardeningCrits'] : {};
    for (const b of config.buyables) {
      const count = Math.min(readCount(savedHardening[b.id]), Number.MAX_SAFE_INTEGER);
      if (count > 0 && (sleeve.purchased[b.id] ?? 0) > 0) sleeve.hardeningCrits[b.id] = count;
    }
    const stack = config.items.rarities[0];
    const heldKey = (rule: { itemId: string } | undefined): boolean =>
      rule !== undefined && stack !== undefined && (state.wallet.inventory[rule.itemId]?.[stack.id] ?? 0) > 0;
    const savedKeys = isRecord(raw.sleeve['keyToggles']) ? raw.sleeve['keyToggles'] : {};
    if (savedKeys['zeroDay'] === true && heldKey(config.items.zeroDay)) sleeve.keyToggles['zeroDay'] = true;
    if (savedKeys['adminKey'] === true && heldKey(config.items.adminKey)) sleeve.keyToggles['adminKey'] = true;
  },
};
