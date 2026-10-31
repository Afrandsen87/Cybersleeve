/** Automation context: per-rarity skill gating and registry validation. */
import { describe, expect, it } from 'vitest';
import { validateConfig, createConfig } from '..';
import { rarityConfig, rarityGame, raritySkills, rarityState } from '../../testing/rarityAutomationKit';

describe('automation rarity permissions', () => {
  it('does not sell without skills, even when a locked switch was set in memory', () => {
    const g = rarityGame();
    rarityState(g).wallet.inventory['file'] = { common: 3 };
    rarityState(g).wallet.automation.autosale['common'] = true;
    expect(g.automation().setAutosale('common', true)).toBe(false);
    expect(g.automation().isAutosaleOn('common')).toBe(false);
    g.tick(1);
    expect(rarityState(g).wallet.inventory['file']).toEqual({ common: 3 });
  });
  it('each skill grants exactly its one rarity and no switch starts on', () => {
    for (const b of raritySkills) {
      const slot = Number(b.id.split('-').at(-1));
      const g = rarityGame([slot]);
      const channel = b.effect.kind === 'allowsAutoBackchannel';
      const feature = channel ? 'autoBackchannel' : 'autosale';
      const rarity = b.effect.kind === 'unlocksAutomation' ? b.effect.allowsAutosale : 'rarity' in b.effect ? b.effect.rarity : undefined;
      expect(g.automation().allowedRarities(feature)).toEqual([rarity]);
      for (const r of rarityConfig.items.rarities) {
        expect(g.automation().isAutosaleOn(r.id)).toBe(false);
        expect(g.automation().isAutoBackchannelOn(r.id)).toBe(false);
      }
    }
  });
  it('only sells allowed, enabled stacks when all rarity skills are present', () => {
    const g = rarityGame([1, 2, 3, 4, 5, 6, 7, 8]);
    rarityState(g).wallet.inventory['file'] = { common: 2, uncommon: 3, rare: 4, legendary: 5, crisis: 6 };
    for (const r of rarityConfig.items.rarities) {
      g.automation().setAutosale(r.id, true);
      g.tick(1);
      expect(g.getState().wallet.inventory['file']?.[r.id]).toBe(0);
      g.automation().setAutosale(r.id, false);
    }
    expect(g.automation().setAutoBackchannel('unknown', true)).toBe(false);
  });
  it('validates both permission kinds and the optional root rarity against configured rarity ids', () => {
    for (const effect of [
      { kind: 'allowsAutosale', rarity: 'unknown' },
      { kind: 'allowsAutoBackchannel', rarity: 'unknown' },
      { kind: 'unlocksAutomation', feature: 'autosale', allowsAutosale: 'unknown' },
    ] as const) {
      const config = createConfig(rarityConfig, { buyables: [{ ...raritySkills[0]!, effect }] });
      expect(validateConfig(config).some((e) => e.includes('unknown rarity'))).toBe(true);
    }
  });
});
