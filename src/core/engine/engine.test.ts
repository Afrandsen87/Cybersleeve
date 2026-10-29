import { game } from '../../testing/gameKit';
import { describe, expect, it } from 'vitest';
import { num } from '../../numbers';

describe('GameEngine - manual running', () => {
  it('does nothing until the action is started', () => {
    const g = game();
    g.tick(60_000);
    expect(g.getState().wallet.credits.isZero()).toBe(true);
  });

  it('fills the bar over 10 s and pays 0.5 credits + 1 xp on completion', () => {
    const g = game();
    expect(g.startAction('a')).toBe(true);
    g.tick(9_999);
    expect(g.getState().wallet.credits.isZero()).toBe(true);
    expect(g.getState().sleeve.actions['a']!.running).toBe(true);
    g.tick(1);
    expect(g.getState().wallet.credits.eq(num(0.5))).toBe(true);
    expect(g.getState().sleeve.actions['a']!.xp.eq(num(1))).toBe(true);
    expect(g.getState().sleeve.actions['a']!.running).toBe(false);
    expect(g.getState().sleeve.actions['a']!.progress).toBe(0);
  });

  it('needs a new click for the next run and discards leftover time', () => {
    const g = game();
    g.startAction('a');
    g.tick(25_000);
    expect(g.getState().wallet.credits.eq(num(0.5))).toBe(true);
    g.tick(10_000);
    expect(g.getState().wallet.credits.eq(num(0.5))).toBe(true);
  });

  it('ignores unknown actions and non-positive deltas', () => {
    const g = game();
    expect(g.startAction('ghost')).toBe(false);
    g.startAction('a');
    g.tick(0);
    g.tick(-5);
    g.tick(NaN);
    expect(g.getState().sleeve.actions['a']!.progress).toBe(0);
  });
});
