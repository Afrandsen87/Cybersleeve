/**
 * Shop: prices, purchases, requirements and reveal.
 */
import { describe, expect, it } from 'vitest';
import { num, numberFactory } from '../../numbers';
import { testConfig } from '../../testing/testConfig';
import { LevelRule, Shop, createInitialState, type LevelRuleConfig } from '..';

const config = testConfig;
const _rule = (c: LevelRuleConfig) => new LevelRule(c, numberFactory);

describe('Shop', () => {
  const shop = new Shop(config.buyables, numberFactory, 1);
  const fresh = () => createInitialState(config, numberFactory);

  it('refuses when credits are insufficient and changes nothing', () => {
    const s = fresh();
    s.wallet.credits = num(9.99);
    expect(shop.canBuy(s, 'auto')).toBe(false);
    expect(shop.buy(s, 'auto')).toBe('cannot-afford');
    expect(s.wallet.credits.eq(num(9.99))).toBe(true);
    expect(s.sleeve.purchased['auto']).toBeUndefined();
  });

  it('buys at exactly the cost and deducts it', () => {
    const s = fresh();
    s.wallet.credits = num(12);
    expect(shop.buy(s, 'auto')).toBe('purchased');
    expect(s.wallet.credits.eq(num(2))).toBe(true);
    expect(s.sleeve.purchased['auto']).toBe(1);
  });

  it('one-time buyables cannot be bought twice; unknown ids are rejected', () => {
    const s = fresh();
    s.wallet.credits = num(100);
    shop.buy(s, 'auto');
    expect(shop.buy(s, 'auto')).toBe('max-reached');
    expect(shop.buy(s, 'ghost')).toBe('unknown');
    expect(s.wallet.credits.eq(num(90))).toBe(true);
  });

  it('a gated buyable is locked until its requirement is owned', () => {
    const s = fresh();
    s.wallet.credits = num(1000);
    expect(shop.isAvailable(s, 'dup')).toBe(false);
    expect(shop.buy(s, 'dup')).toBe('locked');
    expect(s.wallet.credits.eq(num(1000))).toBe(true);
    shop.buy(s, 'dual');
    expect(shop.isAvailable(s, 'dup')).toBe(true);
  });

  it('a repeatable buyable costs 10x more each time, without limit (150, 1500, 15000, ...)', () => {
    const s = fresh();
    s.wallet.credits = num('1e30');
    shop.buy(s, 'dual');
    for (let n = 0; n < 12; n++) {
      expect(shop.costOf(s, 'dup').eq(num(150).mul(num(10).pow(n)))).toBe(true);
      expect(shop.buy(s, 'dup')).toBe('purchased');
    }
    expect(s.sleeve.purchased['dup']).toBe(12);
    expect(shop.isMaxed(s, 'dup')).toBe(false);
  });

  it('charges the price of the copy being bought and refuses when it cannot be paid', () => {
    const s = fresh();
    s.wallet.credits = num(15 + 150 + 1000);
    shop.buy(s, 'dual');
    expect(shop.buy(s, 'dup')).toBe('purchased'); // 150
    expect(s.wallet.credits.eq(num(1000))).toBe(true);
    expect(shop.buy(s, 'dup')).toBe('cannot-afford'); // 1500 > 1000
    expect(s.wallet.credits.eq(num(1000))).toBe(true);
  });

  it('the global cost multiplier scales every price', () => {
    const pricey = new Shop(config.buyables, numberFactory, 2);
    const s = fresh();
    expect(pricey.costOf(s, 'auto').eq(num(20))).toBe(true);
    s.wallet.credits = num(19);
    expect(pricey.buy(s, 'auto')).toBe('cannot-afford');
  });

  it('maxPurchases limits repeatable buyables', () => {
    const limited = new Shop([{ ...config.buyables[0]!, maxPurchases: 2 }], numberFactory, 1);
    const s = fresh();
    s.wallet.credits = num(100);
    expect(limited.buy(s, 'auto')).toBe('purchased');
    expect(limited.buy(s, 'auto')).toBe('purchased');
    expect(limited.buy(s, 'auto')).toBe('max-reached');
  });
});
