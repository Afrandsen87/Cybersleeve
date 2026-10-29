import { describe, expect, it } from 'vitest';
import { numberFactory } from '../../numbers';
import { findInvariantViolations } from '../../testing/invariants';
import { BuyableCaps } from './buyableCaps';
import { deserializeState, serializeState, validateConfig } from '..';
import { loose, newGame, plainBuyable, resleeveSkill, resleeveTimes, tryBuy, withBuyables } from '../../testing/resleeveSkillsKit';
import { asSave, flatSave } from '../../testing/saveKit';

const wide = plainBuyable('wide', { kind: 'accessLevel', amount: 1 }, { maxPurchases: 2 });
const bonus = resleeveSkill('bonus', { kind: 'buyableCapBonus', targetId: 'wide', extra: 1 });
const config = withBuyables([wide, bonus]);

const buyWide = (g: ReturnType<typeof newGame>): string => tryBuy(g, 'wide');

describe('BuyableCaps', () => {
  it('allows the own maxPurchases without the skill and one more copy with it', () => {
    const caps = new BuyableCaps([wide, bonus]);
    expect(caps.maxCopies(wide, {})).toBe(2);
    expect(caps.maxCopies(wide, { bonus: 1 })).toBe(3);
    expect(caps.bonusOf({ bonus: 1 }, 'wide')).toBe(1);
    expect(caps.bonusOf({ bonus: 1 }, 'other')).toBe(0);
  });

  it('keeps Infinity unlimited', () => {
    const open = plainBuyable('open', { kind: 'accessLevel', amount: 1 }, { maxPurchases: Infinity });
    expect(new BuyableCaps([open, bonus]).maxCopies(open, { bonus: 1 })).toBe(Infinity);
  });
});

describe('a buyableCapBonus skill in the shop', () => {
  it('lets a third copy be bought only after the skill is owned', () => {
    const g = newGame(config);
    buyWide(g);
    buyWide(g);
    expect(buyWide(g)).toBe('max-reached');
    resleeveTimes(g, 1);
    expect(tryBuy(g, 'bonus')).toBe('purchased');
    expect(g.getState().sleeve.purchased['wide'], 'a re-sleeve resets the plain purchases').toBeUndefined();
    for (let i = 0; i < 3; i++) expect(buyWide(g)).toBe('purchased');
    expect(buyWide(g)).toBe('max-reached');
  });

  it('is valid content, and rejects an unknown target or a bonus below 1', () => {
    expect(validateConfig(config)).toEqual([]);
    const bad = withBuyables([resleeveSkill('b1', { kind: 'buyableCapBonus', targetId: 'nope', extra: 1 })]);
    expect(validateConfig(bad).join()).toContain('unknown buyable "nope"');
    const zero = withBuyables([wide, resleeveSkill('b0', { kind: 'buyableCapBonus', targetId: 'wide', extra: 0 })]);
    expect(validateConfig(zero).join()).toContain('extra must be an integer >= 1');
  });

  it('survives a save: the extra copy loads with the skill, and is cut back when the skill is missing from the save', () => {
    const g = newGame(config);
    resleeveTimes(g, 1);
    tryBuy(g, 'bonus');
    for (let i = 0; i < 3; i++) buyWide(g);
    const text = serializeState(g.getState());
    const loaded = deserializeState(text, config, numberFactory)!;
    expect(loaded.sleeve.purchased['wide']).toBe(3);
    expect(findInvariantViolations(loaded, config)).toEqual([]);

    const edited = flatSave(text) as { purchased: Record<string, number> };
    delete edited.purchased['bonus'];
    const cut = deserializeState(asSave(edited), config, numberFactory)!;
    expect(cut.sleeve.purchased['wide']).toBe(2);
    expect(loose(g).runs).toHaveLength(1);
  });
});
