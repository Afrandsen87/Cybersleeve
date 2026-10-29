import { describe, expect, it } from 'vitest';
import { gameConfig } from '../../content/gameConfig';
import { EFFECTS } from './effectRegistry';

describe('effect registry completeness', () => {
  it('every entry has traits and a validator', () => {
    for (const [kind, entry] of Object.entries(EFFECTS)) {
      expect(entry.traits, kind).toBeDefined();
      expect(typeof entry.validate, kind).toBe('function');
    }
  });

  it('every effect kind used by the real content has an entry', () => {
    for (const b of gameConfig.buyables) expect(EFFECTS[b.effect.kind], `${b.id} (${b.effect.kind})`).toBeDefined();
  });
});
