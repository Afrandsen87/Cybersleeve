/**
 * @module core
 * Context: save. Refund sleeve skills before defensive purchase caps are applied.
 * Called by: migrateSave. Calls: revealKey, isRecord.
 */
import { revealKey } from '../economy/revealLedger';
import { isRecord } from '../kernel/readValues';

/**
 * Copies a parsed v9 save to v10, removing sleeve-skill purchases and their reveal keys without mutation.
 * Called by: migrateSave. Calls: revealKey, isRecord.
 * @param save parsed save
 * @param sleeveSkillIds config ids paid in sleeve skill points
 * @returns new v10 object preserving all unrelated data
 */
export function migrateV9(save: Record<string, unknown>, sleeveSkillIds: readonly string[]): Record<string, unknown> {
  const ids = new Set(sleeveSkillIds);
  const keys = new Set(sleeveSkillIds.map((id) => revealKey('skill', id)));
  const sleeves = save['sleeves'];
  const wallet = save['wallet'];
  return {
    ...save,
    version: 10,
    ...(isRecord(sleeves)
      ? {
          sleeves: Object.fromEntries(
            Object.entries(sleeves).map(([id, sleeve]) => {
              if (!isRecord(sleeve) || !isRecord(sleeve['purchased'])) return [id, sleeve];
              return [
                id,
                { ...sleeve, purchased: Object.fromEntries(Object.entries(sleeve['purchased']).filter(([key]) => !ids.has(key))) },
              ];
            }),
          ),
        }
      : {}),
    ...(isRecord(wallet) && Array.isArray(wallet['revealed'])
      ? { wallet: { ...wallet, revealed: wallet['revealed'].filter((key) => !keys.has(key)) } }
      : {}),
  };
}
