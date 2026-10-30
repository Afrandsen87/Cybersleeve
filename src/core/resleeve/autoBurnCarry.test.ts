/**
 * Reflex Archive's record of last life's Auto-runs and Auto Burn: an Auto-run that Auto Burn paused counts as on, because the player left it on.
 */
import { describe, expect, it } from 'vitest';
import { burnConfig } from '../../testing/autoBurnKit';
import type { GameState } from '..';
import { recordLastLife } from './resleeveCarry';

/** The parts of the old and new state the record reads and writes. */
function lives(purchased: Record<string, number>, autoRunOff: Record<string, boolean>, paused: Record<string, true>) {
  const old = { sleeve: { purchased, autoRunOff, autoBurn: { autoRunsOff: paused } } };
  const fresh = { wallet: { lastLifePurchases: {} as Record<string, number>, lastLifeAutoRunOn: {} as Record<string, true> } };
  return { old: old as unknown as GameState, fresh: fresh as unknown as GameState };
}

describe('the Auto-run record at a re-sleeve', () => {
  const owned = { 'auto-hot': 1, 'auto-warm': 1, 'auto-cold': 1 };

  it('lists an Auto-run that was on, and one that Auto Burn paused, but not one the player switched off', () => {
    const { old, fresh } = lives(owned, { 'auto-hot': true, 'auto-cold': true }, { 'auto-hot': true });
    recordLastLife(old, fresh, burnConfig.buyables);
    expect(Object.keys(fresh.wallet.lastLifeAutoRunOn).sort()).toEqual(['auto-hot', 'auto-warm']);
    expect(fresh.wallet.lastLifePurchases['auto-cold']).toBe(1);
  });
});
