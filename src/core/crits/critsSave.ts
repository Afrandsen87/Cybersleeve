/**
 * @module core
 *
 * The critical-success part of a save (sleeve `bankedCriticals`, `keyToggles`).
 */
import { isRecord, readCount } from '../kernel/readValues';
import type { SavePart } from '../kernel/savePart';
import type { GameConfig } from '../types';

/**
 * The banked critical successes and the key toggles. A key toggle stays on only while the key is held (it switches itself off at 0), so this
 * part must be read after the inventory. The off toggles are not written, so save, load, save gives the same text.
 *
 * Called by: `save/saveParts.ts`. Calls: `readCount`.
 */
export const critsSavePart: SavePart<Pick<GameConfig, 'actions' | 'items'>> = {
  name: 'crits',
  write: (state) => ({
    sleeve: {
      keyToggles: Object.fromEntries(Object.entries(state.sleeve.keyToggles).filter(([, on]) => on)),
      bankedCriticals: { ...state.sleeve.bankedCriticals },
    },
  }),
  read: (state, raw, config) => {
    const sleeve = state.sleeve;
    const savedBank = isRecord(raw.sleeve['bankedCriticals']) ? raw.sleeve['bankedCriticals'] : {};
    for (const def of config.actions) {
      const count = Math.min(readCount(savedBank[def.id]), Number.MAX_SAFE_INTEGER);
      if (count > 0) sleeve.bankedCriticals[def.id] = count;
    }
    const stack = config.items.rarities[0];
    const heldKey = (rule: { itemId: string } | undefined): boolean =>
      rule !== undefined && stack !== undefined && (state.wallet.inventory[rule.itemId]?.[stack.id] ?? 0) > 0;
    const savedKeys = isRecord(raw.sleeve['keyToggles']) ? raw.sleeve['keyToggles'] : {};
    if (savedKeys['zeroDay'] === true && heldKey(config.items.zeroDay)) sleeve.keyToggles['zeroDay'] = true;
    if (savedKeys['adminKey'] === true && heldKey(config.items.adminKey)) sleeve.keyToggles['adminKey'] = true;
  },
};
