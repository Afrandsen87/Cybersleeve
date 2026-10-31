/**
 * @module core
 *
 * Auto Burn: the save migration for the removal of the Pick Targets skill and the arrival of the resume checklists.
 *
 * @remarks
 * Context: automation. Wired into `save/migrate.ts` (v8 to v9): `migrateV8` runs {@link migrateAutoBurnResume} on the
 * saved wallet and sleeve of each sleeve. It is pure and defensive (untrusted input).
 */
import { isRecord } from '../kernel/readValues';
import type { RawSave } from '../kernel/savePart';

/** Id of the removed Pick Targets skill (slot 8 of the Auto Burn lane). */
export const PICK_TARGETS_SKILL_ID = 'skill-autoBurn-8';

/** The ids set to `true` in a saved record, as a fresh record (anything else is ignored). */
function trueIds(from: unknown): Record<string, true> {
  const out: Record<string, true> = {};
  if (isRecord(from)) for (const id of Object.keys(from)) if (from[id] === true) out[id] = true;
  return out;
}

/**
 * Migrates a save written before the resume checklists: drops the owned Pick Targets purchase (its points are given back, because available
 * points are earned minus the price of what is owned), and adds `resumeOverclocks` / `resumeAutoRuns` to the saved Auto Burn settings, ticking
 * whatever the life had recorded as switched off (`overclocksOff` / `autoRunsOff`) so the old "switch back on what was switched off" behaviour
 * carries over. Lists that already exist are kept and merged. Does not change its input.
 *
 * Called by: `save/migrate.ts` (`migrateV8`). Calls: nothing.
 *
 * @param raw the saved wallet and sleeve of one sleeve
 * @returns the migrated wallet and sleeve
 */
export function migrateAutoBurnResume(raw: RawSave): RawSave {
  const { [PICK_TARGETS_SKILL_ID]: _removed, ...purchased } = isRecord(raw.sleeve['purchased']) ? raw.sleeve['purchased'] : {};
  const sleeve: Record<string, unknown> = { ...raw.sleeve };
  if (isRecord(raw.sleeve['purchased'])) sleeve['purchased'] = purchased;
  const life = isRecord(raw.sleeve['autoBurn']) ? raw.sleeve['autoBurn'] : {};
  const automation = isRecord(raw.wallet['automation']) ? raw.wallet['automation'] : {};
  const burn = isRecord(automation['autoBurn']) ? automation['autoBurn'] : {};
  const wallet: Record<string, unknown> = {
    ...raw.wallet,
    automation: {
      ...automation,
      autoBurn: {
        ...burn,
        resumeOverclocks: { ...trueIds(life['overclocksOff']), ...trueIds(burn['resumeOverclocks']) },
        resumeAutoRuns: { ...trueIds(life['autoRunsOff']), ...trueIds(burn['resumeAutoRuns']) },
      },
    },
  };
  return { wallet, sleeve };
}
