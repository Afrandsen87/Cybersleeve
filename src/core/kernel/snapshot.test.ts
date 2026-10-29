import { describe, expect, it } from 'vitest';
import { createGame } from '../../app/createGame';
import { testConfig } from '../../testing/testConfig';
import { Snapshot } from './snapshot';

describe('Snapshot', () => {
  it('computes every time outside a scope', () => {
    const snap = new Snapshot();
    let n = 0;
    snap.memo('a', () => ++n);
    snap.memo('a', () => ++n);
    expect(n).toBe(2);
  });

  it('computes once per key inside a scope, and again in the next scope', () => {
    const snap = new Snapshot();
    let n = 0;
    const read = () => [snap.memo('a', () => ++n), snap.memo('a', () => ++n), snap.memo('b', () => ++n)];
    expect(snap.run(read)).toEqual([1, 1, 2]);
    expect(snap.run(read)).toEqual([3, 3, 4]);
  });

  it('keeps the answers until the outermost of nested scopes ends', () => {
    const snap = new Snapshot();
    let n = 0;
    snap.run(() => {
      snap.memo('a', () => ++n);
      snap.run(() => snap.memo('a', () => ++n));
      expect(snap.memo('a', () => ++n)).toBe(1);
    });
    expect(n).toBe(1);
  });

  it('drops the answers when the work throws', () => {
    const snap = new Snapshot();
    let n = 0;
    expect(() =>
      snap.run(() => {
        snap.memo('a', () => ++n);
        throw new Error('boom');
      }),
    ).toThrow('boom');
    snap.memo('a', () => ++n);
    expect(n).toBe(2);
  });

  it('returns what the work returns', () => {
    expect(new Snapshot().run(() => 42)).toBe(42);
  });
});

describe('GameEngine.snapshot', () => {
  it('gives the same answers as asking without a scope', () => {
    const game = createGame({ config: testConfig });
    const plain = [game.sleeveStats(), game.skillPoints()] as const;
    const scoped = game.snapshot(() => [game.sleeveStats(), game.sleeveStats(), game.skillPoints()] as const);
    expect(scoped[0]).toEqual(plain[0]);
    expect(scoped[1]).toBe(scoped[0]);
    expect(scoped[2]).toBe(plain[1]);
  });

  it('sees the state as it is when a new scope opens (nothing is kept between scopes)', () => {
    const game = createGame({ config: testConfig });
    const before = game.snapshot(() => game.sleeveStats().heat);
    (game.getState() as unknown as { sleeve: { heat: number } }).sleeve.heat = before + 5;
    expect(game.snapshot(() => game.sleeveStats().heat)).toBe(before + 5);
  });
});
