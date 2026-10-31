/** Automation context: manual owner reuse, precedence, eligibility and stack-independent work. */
import { describe, expect, it } from 'vitest';
import { rarityGame, rarityState } from '../../testing/rarityAutomationKit';

describe('auto backchannel', () => {
  it('gives the exact manual payout, consumes before autosale, and leaves off or locked rarities held', () => {
    const auto = rarityGame([1, 2, 3, 4, 5, 6]);
    const manual = rarityGame([1, 2, 3, 4, 5, 6]);
    for (const g of [auto, manual]) rarityState(g).wallet.inventory['file'] = { common: 11, uncommon: 7, rare: 3, legendary: 2 };
    auto.automation().setAutoBackchannel('common', true);
    auto.automation().setAutoBackchannel('rare', true);
    auto.automation().setAutosale('common', true);
    rarityState(auto).wallet.automation.autoBackchannel['legendary'] = true;
    manual.giveUpForMoles('file', 'common', 'all');
    manual.giveUpForMoles('file', 'rare', 'all');
    auto.tick(1);
    expect(rarityState(auto).sleeve.moles).toBe(rarityState(manual).sleeve.moles);
    expect(rarityState(auto).wallet.inventory).toEqual(rarityState(manual).wallet.inventory);
    expect(rarityState(auto).wallet.credits.eq(rarityState(manual).wallet.credits)).toBe(true);
  });
  it('requires the manual channel and its rarity support', () => {
    const g = rarityGame([1, 2, 3, 4, 5, 6], false);
    rarityState(g).wallet.inventory['file'] = { common: 4, uncommon: 3 };
    g.automation().setAutoBackchannel('common', true);
    g.automation().setAutoBackchannel('uncommon', true);
    g.tick(1);
    expect(rarityState(g).sleeve.moles).toBe(0);
    (rarityState(g).sleeve.purchased as Record<string, number>)['channel'] = 1;
    g.tick(1);
    expect(rarityState(g).sleeve.moles).toBe(20);
    expect(rarityState(g).wallet.inventory['file']?.['uncommon']).toBe(3);
  });
  it('handles zero and huge stacks with no random draws', () => {
    const g = rarityGame([1, 2, 3, 4]);
    g.automation().setAutoBackchannel('common', true);
    expect(() => g.tick(1)).not.toThrow();
    rarityState(g).wallet.inventory['file'] = { common: 1e100 };
    g.tick(1);
    expect(rarityState(g).wallet.inventory['file']?.['common']).toBe(0);
    expect(rarityState(g).sleeve.moles).toBe(5e100);
  });
});
