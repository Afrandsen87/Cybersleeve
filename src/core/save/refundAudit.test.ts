/**
 * Context: save. A sleeve-skill refund preserves data used after re-buying retention and corporation skills.
 * Called by: vitest. Calls: refundAuditSetup, migrateSave, serializeState, deserializeState.
 */
import { describe, expect, it } from 'vitest';
import { numberFactory } from '../../numbers';
import { refundAuditSetup } from '../../testing/saveRefundKit';
import { migrateSave } from './migrate';
import { serializeState, deserializeState } from './serialization';

describe('refund save-reader audit', () => {
  it('keeps corporation progress, automation settings and last-life records without the refunded skills', () => {
    const { config, state } = refundAuditSetup();
    const raw = JSON.parse(serializeState(state));
    raw.version = 9;
    const ids = config.buyables.filter((b) => b.currency === 'resleevePoints').map((b) => b.id);
    const loaded = deserializeState(migrateSave(JSON.stringify(raw), ids), config, numberFactory)!;
    for (const id of ids) expect(loaded.sleeve.purchased[id]).toBeUndefined();
    expect(loaded.wallet.corporation).toEqual(state.wallet.corporation);
    expect(loaded.wallet.automation).toEqual(state.wallet.automation);
    expect(loaded.sleeve.autoBurn).toEqual(state.sleeve.autoBurn);
    expect(loaded.wallet.lastLifePurchases).toEqual(state.wallet.lastLifePurchases);
    expect(loaded.wallet.lastLifeAutoRunOn).toEqual(state.wallet.lastLifeAutoRunOn);
    const again = deserializeState(serializeState(loaded), config, numberFactory)!;
    expect(serializeState(again)).toBe(serializeState(loaded));
  });
});
