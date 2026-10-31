/**
 * The reveal ledger (`wallet.revealed`): noting keys, the save part, the migration piece, the re-sleeve carry-over and the invariant.
 *
 * Called by: vitest. Calls: `noteRevealed`, `isKnownRevealKey`, `addRevealedLedger`, `serializeState`, `resetForResleeve`.
 */
import { describe, expect, it } from 'vitest';
import { numberFactory } from '../../numbers';
import { findInvariantViolations } from '../../testing/invariants';
import { game } from '../../testing/gameKit';
import { testConfig } from '../../testing/testConfig';
import {
  addRevealedLedger,
  createInitialState,
  deserializeState,
  isKnownRevealKey,
  noteRevealed,
  resetForResleeve,
  serializeState,
} from '..';

const fresh = () => createInitialState(testConfig, numberFactory);

describe('known keys', () => {
  it('resolve stats, tabs and buyables by id, and reject the rest', () => {
    const ok = ['stat:heat', 'tab:skills', 'skill:speed', 'buyable:dup'];
    for (const key of ok) expect(isKnownRevealKey(key, testConfig.buyables), key).toBe(true);
    for (const key of ['stat:nope', 'tab:nope', 'buyable:nope', 'speed', 'thing:speed', ''])
      expect(isKnownRevealKey(key, testConfig.buyables), key).toBe(false);
  });
});

describe('noteRevealed', () => {
  it('adds new keys once, ignoring repeats, known ones and unknown ones', () => {
    const state = fresh();
    expect(noteRevealed(state, testConfig, ['stat:heat', 'stat:heat', 'bogus:1', 'tab:skills'])).toBe(2);
    expect(noteRevealed(state, testConfig, ['stat:heat'])).toBe(0);
    expect(state.wallet.revealed).toEqual(['stat:heat', 'tab:skills']);
  });

  it('is the engine command, and the invariant accepts the result', () => {
    const g = game();
    g.noteRevealed(['buyable:dual', 'tab:character']);
    expect(g.getState().wallet.revealed).toEqual(['buyable:dual', 'tab:character']);
    expect(findInvariantViolations(g.getState(), testConfig)).toEqual([]);
  });

  it('the invariant flags a key for something that does not exist and a repeated key', () => {
    const state = fresh();
    state.wallet.revealed = ['stat:nope', 'tab:skills', 'tab:skills'];
    expect(findInvariantViolations(state, testConfig)).toEqual([
      'the reveal ledger holds a key twice',
      'the reveal ledger holds an unknown key: stat:nope',
    ]);
  });
});

describe('survives', () => {
  it('a re-sleeve', () => {
    const state = fresh();
    noteRevealed(state, testConfig, ['stat:heat', 'buyable:dup']);
    resetForResleeve(state, testConfig, numberFactory);
    expect(state.wallet.revealed).toEqual(['stat:heat', 'buyable:dup']);
  });

  it('a save and load, and drops unknown or repeated keys on load', () => {
    const state = fresh();
    noteRevealed(state, testConfig, ['tab:stats']);
    const back = deserializeState(serializeState(state), testConfig, numberFactory)!;
    expect(back.wallet.revealed).toEqual(['tab:stats']);
    const data = JSON.parse(serializeState(state));
    data.wallet.revealed = ['tab:stats', 'tab:stats', 'gone:1', 7];
    expect(deserializeState(JSON.stringify(data), testConfig, numberFactory)!.wallet.revealed).toEqual(['tab:stats']);
  });

  it('a save without the field, which loads empty and leaves an empty ledger out of the text', () => {
    const text = serializeState(fresh());
    expect(JSON.parse(text).wallet.revealed).toBeUndefined();
    expect(deserializeState(text, testConfig, numberFactory)!.wallet.revealed).toEqual([]);
  });
});

describe('addRevealedLedger (migration piece)', () => {
  it('adds an empty ledger to a wallet without one, and leaves an existing one and non-saves alone', () => {
    expect(addRevealedLedger({ version: 8, wallet: { credits: '1' } })).toEqual({ version: 8, wallet: { credits: '1', revealed: [] } });
    const has = { wallet: { revealed: ['tab:skills'] } };
    expect(addRevealedLedger(has)).toBe(has);
    expect(addRevealedLedger(null)).toBeNull();
    expect(addRevealedLedger({ version: 8 })).toEqual({ version: 8 });
  });

  it('does not change its input', () => {
    const input = { wallet: { credits: '1' } };
    addRevealedLedger(input);
    expect(input).toEqual({ wallet: { credits: '1' } });
  });
});
