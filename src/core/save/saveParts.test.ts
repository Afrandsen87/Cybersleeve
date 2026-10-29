/**
 * The per-context save parts (`SAVE_PARTS`): their order, their keys and their defensive reading.
 *
 * Purpose: `serialization.ts` only composes the parts, so a part that writes a key nobody orders, reads out of order or throws on garbage must fail
 * here. The saved text itself is pinned by `v7Golden.test.ts`.
 * Called by: vitest. Calls: `SAVE_PARTS`, `createInitialState`, `serializeState`, the test config.
 */
import { describe, expect, it } from 'vitest';
import { testConfig } from '../../testing/testConfig';
import { numberFactory } from '../../numbers';
import { SAVE_PARTS, SLEEVE_KEY_ORDER, WALLET_KEY_ORDER, inKeyOrder } from './saveParts';
import { createInitialState } from './state';
import { serializeState } from './serialization';

const fresh = () => createInitialState(testConfig, numberFactory);
const names = SAVE_PARTS.map((p) => p.name);

describe('SAVE_PARTS', () => {
  it('has a unique name per part', () => {
    expect(new Set(names).size).toBe(names.length);
  });

  it('is read in dependency order', () => {
    const at = (n: string) => names.indexOf(n);
    expect(at('purchases')).toBeLessThan(at('toggles'));
    expect(at('purchases')).toBeLessThan(at('synths'));
    expect(at('purchases')).toBeLessThan(at('automation'));
    expect(at('runs')).toBeLessThan(at('synths'));
    expect(at('inventory')).toBeLessThan(at('crits'));
  });

  it('writes only keys that the key-order lists name (so the text never depends on read order)', () => {
    const wallet = new Set(WALLET_KEY_ORDER);
    const sleeve = new Set(SLEEVE_KEY_ORDER);
    for (const part of SAVE_PARTS) {
      const out = part.write(fresh());
      for (const key of Object.keys(out.wallet ?? {})) expect(wallet.has(key), `${part.name} wallet.${key}`).toBe(true);
      for (const key of Object.keys(out.sleeve ?? {})) expect(sleeve.has(key), `${part.name} sleeve.${key}`).toBe(true);
    }
  });

  it('writes every listed key exactly once between the parts', () => {
    const seen: string[] = [];
    for (const part of SAVE_PARTS) {
      const out = part.write(fresh());
      seen.push(...Object.keys(out.wallet ?? {}).map((k) => `wallet.${k}`), ...Object.keys(out.sleeve ?? {}).map((k) => `sleeve.${k}`));
    }
    expect(new Set(seen).size).toBe(seen.length);
    expect(seen.length).toBe(WALLET_KEY_ORDER.length + SLEEVE_KEY_ORDER.length);
  });

  it('writes the keys of the saved objects in the declared order, before the scalars', () => {
    const data = JSON.parse(serializeState(fresh()));
    expect(Object.keys(data.wallet).slice(0, WALLET_KEY_ORDER.length)).toEqual([...WALLET_KEY_ORDER]);
    expect(Object.keys(data.sleeves.main).slice(0, SLEEVE_KEY_ORDER.length)).toEqual([...SLEEVE_KEY_ORDER]);
  });

  it('reading an empty save leaves a fresh game unchanged', () => {
    const state = fresh();
    for (const part of SAVE_PARTS) part.read(state, { wallet: {}, sleeve: {} }, testConfig, numberFactory);
    expect(serializeState(state)).toBe(serializeState(fresh()));
  });

  it('treats a part that is the wrong kind of value as missing (no throw, nothing invented)', () => {
    const junk = [null, 7, 'x', true]; // (a list as `runs` is read entry by entry, by design)
    for (const value of junk) {
      const state = fresh();
      const wallet = Object.fromEntries(WALLET_KEY_ORDER.map((k) => [k, value]));
      const sleeve = Object.fromEntries(SLEEVE_KEY_ORDER.map((k) => [k, value]));
      for (const part of SAVE_PARTS) part.read(state, { wallet, sleeve }, testConfig, numberFactory);
      expect(serializeState(state)).toBe(serializeState(fresh()));
    }
  });
});

describe('inKeyOrder', () => {
  it('puts listed keys first in the listed order, then the others in their own order', () => {
    expect(Object.keys(inKeyOrder({ c: 1, a: 2, z: 3, b: 4 }, ['a', 'b', 'missing']))).toEqual(['a', 'b', 'c', 'z']);
  });

  it('does not change its input', () => {
    const input = { b: 1, a: 2 };
    inKeyOrder(input, ['a']);
    expect(Object.keys(input)).toEqual(['b', 'a']);
  });
});
