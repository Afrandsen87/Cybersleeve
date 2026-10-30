/**
 * The two re-sleeve unlocks of the REAL content: Sleeve levels and Unlock resleeving both exist, are one-time sleeve purchases, are carried
 * over a re-sleeve, and the second needs the first. Invariants only, never tuning numbers.
 */
import { describe, expect, it } from 'vitest';
import { resleeveGateId, sleeveLevelsGateId, traitsOf } from '../core';
import { RESLEEVE_UNLOCK, SLEEVE_LEVELS, gameConfig } from './gameConfig';

const byId = new Map(gameConfig.buyables.map((b) => [b.id, b]));

describe('the re-sleeve unlocks', () => {
  it('both exist, each with its own effect kind and id', () => {
    expect(byId.get(SLEEVE_LEVELS)!.effect.kind).toBe('unlockSleeveLevels');
    expect(byId.get(RESLEEVE_UNLOCK)!.effect.kind).toBe('unlockResleeve');
    expect(sleeveLevelsGateId(gameConfig.buyables)).toBe(SLEEVE_LEVELS);
    expect(resleeveGateId(gameConfig.buyables)).toBe(RESLEEVE_UNLOCK);
  });

  it('both are one-time sleeve purchases paid in credits, and both are carried over a re-sleeve', () => {
    for (const id of [SLEEVE_LEVELS, RESLEEVE_UNLOCK]) {
      const b = byId.get(id)!;
      expect(b.actionId, id).toBeUndefined();
      expect(b.currency ?? 'credits', id).toBe('credits');
      expect(b.maxPurchases ?? 1, id).toBe(1);
      expect(traitsOf(b).carriedOverResleeve, id).toBe(true);
    }
  });

  it('Unlock resleeving needs Sleeve levels first', () => {
    expect(byId.get(RESLEEVE_UNLOCK)!.requires).toContain(SLEEVE_LEVELS);
  });

  it('each has a player-facing description', () => {
    for (const id of [SLEEVE_LEVELS, RESLEEVE_UNLOCK]) expect(byId.get(id)!.description.length, id).toBeGreaterThan(0);
  });
});
