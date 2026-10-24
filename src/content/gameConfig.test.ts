/**
 * Guards for the REAL game content. These check invariants that must hold whatever the tuning is (a valid
 * configuration, nothing unreachable, every purchase works), not the tuning numbers themselves, so retuning
 * `gameConfig.ts` does not break them. Exact behaviour is tested against `testing/testConfig.ts` elsewhere.
 */
import { describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { validateConfig } from '../core';
import { num } from '../numbers';
import { setCredits } from '../testing/testConfig';
import { buildViewModel } from '../ui/viewModel';
import { gameConfig } from './gameConfig';

describe('real game content (src/content/gameConfig.ts)', () => {
  it('is a valid configuration', () => {
    expect(validateConfig(gameConfig)).toEqual([]);
  });

  it('can start: the first action is available without any purchase', () => {
    const first = gameConfig.actions[0]!;
    expect(first.requiredAccessLevel ?? 1).toBeLessThanOrEqual(gameConfig.sleeve.baseAccessLevel);
  });

  it('every action is reachable: its required access level is the base level or granted by a buyable', () => {
    const granted = Math.max(
      gameConfig.sleeve.baseAccessLevel,
      ...gameConfig.buyables.flatMap((b) => (b.effect.kind === 'accessLevel' ? [b.effect.level] : [])),
    );
    for (const a of gameConfig.actions) {
      expect(a.requiredAccessLevel ?? 1, `${a.id} needs an unreachable access level`).toBeLessThanOrEqual(granted);
    }
  });

  it('every buyable can be bought once enough credits are available (no dead gates)', () => {
    const g = createGame();
    setCredits(g, num('1e100'));
    // Buy in config order, repeating until nothing more can be bought once (a gate may be listed after what it unlocks).
    for (let pass = 0; pass < gameConfig.buyables.length; pass++) {
      for (const b of gameConfig.buyables) if (g.canBuy(b.id)) expect(g.buy(b.id)).toBe('purchased');
    }
    for (const b of gameConfig.buyables) expect(g.ownedCount(b.id), `${b.id} was never purchasable`).toBeGreaterThan(0);
  });

  it('a fresh game runs: starting the first action eventually pays credits or network nodes', () => {
    const g = createGame();
    const first = gameConfig.actions[0]!;
    g.startAction(first.id);
    g.tick(g.currentDurationMs(first.id) + 1);
    const s = g.getState();
    expect(s.actions[first.id]!.xp.isZero()).toBe(false);
    expect(s.credits.isZero() && s.network.isZero()).toBe(false);
  });

  it('the view model builds for the real content', () => {
    const vm = buildViewModel(createGame());
    expect(vm.actions.map((a) => a.id)).toEqual(gameConfig.actions.map((a) => a.id));
    for (const b of gameConfig.buyables) {
      const owner = b.actionId === undefined ? vm.sleeve.buyables : vm.actions.find((a) => a.id === b.actionId)!.buyables;
      expect(owner.map((v) => v.id)).toContain(b.id);
    }
  });

  it('the player is never charged a negative or non-finite price', () => {
    const g = createGame();
    for (const b of gameConfig.buyables) {
      const price = g.costOf(b.id);
      expect(price.isFinite() && !price.isNegative()).toBe(true);
    }
  });
});
