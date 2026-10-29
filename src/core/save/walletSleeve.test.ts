/**
 * Which field lives in the wallet and which in the sleeve, the v7 save shape, and what a re-sleeve keeps of each part.
 *
 * Purpose: pins the ownership decided in S8 (structure only, no gameplay) so a field cannot drift to the other part unnoticed, and proves that the
 * re-sleeve keeps exactly the fields on the positive lists (`CARRIED_OVER_WALLET_FIELDS`, `CARRIED_OVER_ACTION_FIELDS`) and resets all others.
 * Called by: vitest. Calls: `createInitialState`, `resetForResleeve`, `serializeState`, `findInvariantViolations`.
 */
import { describe, expect, it } from 'vitest';
import { num, numberFactory } from '../../numbers';
import { findInvariantViolations } from '../../testing/invariants';
import { testConfig } from '../../testing/testConfig';
import {
  CARRIED_OVER_ACTION_FIELDS,
  CARRIED_OVER_WALLET_FIELDS,
  SAVE_VERSION,
  SCALAR_FIELDS,
  createInitialState,
  deserializeState,
  resetForResleeve,
  serializeState,
} from '..';

const config = testConfig;
const fresh = () => createInitialState(config, numberFactory);

const WALLET_KEYS = [
  'allTimePeakCredits',
  'allTimePeakNetwork',
  'automation',
  'corporation',
  'credits',
  'inventory',
  'lastLifePurchases',
  'runs',
  'synths',
];
const SLEEVE_KEYS = [
  'actions',
  'autoRunOff',
  'bankedCriticals',
  'chains',
  'focusStacks',
  'focused',
  'hackingProficiency',
  'heat',
  'heatCooldownMs',
  'iceRating',
  'keyToggles',
  'legend',
  'legendCooldownMs',
  'moles',
  'network',
  'networkRemainder',
  'nodePayoutBonus',
  'overclocked',
  'peakCredits',
  'peakNetwork',
  'purchased',
  'resleeveLockoutMs',
];

describe('ownership of the state', () => {
  it('the wallet holds the shared fields and the sleeve holds the life being lived', () => {
    const state = fresh();
    expect(Object.keys(state.wallet).sort()).toEqual(WALLET_KEYS);
    expect(Object.keys(state.sleeve).sort()).toEqual(SLEEVE_KEYS);
  });

  it("the scalar table names the owner of each scalar, and the all-time peaks (statistics) are the wallet's", () => {
    const state = fresh();
    for (const f of SCALAR_FIELDS) expect(f.key in state[f.owner], f.key).toBe(true);
    expect(
      SCALAR_FIELDS.filter((f) => f.owner === 'wallet')
        .map((f) => f.key)
        .sort(),
    ).toEqual(['allTimePeakCredits', 'allTimePeakNetwork', 'credits']);
  });

  it('a fresh state satisfies the invariants, including the all-time peaks being at least the life peaks', () => {
    expect(findInvariantViolations(fresh(), config)).toEqual([]);
    const s = fresh();
    s.sleeve.peakCredits = num(500);
    expect(findInvariantViolations(s, config).some((m) => m.includes('allTimePeakCredits'))).toBe(true);
  });
});

describe('the v7 save shape', () => {
  it('is nested: the wallet, and the sleeves keyed by id with one entry', () => {
    const data = JSON.parse(serializeState(fresh()));
    expect(data.version).toBe(SAVE_VERSION);
    expect(Object.keys(data).sort()).toEqual(['sleeves', 'version', 'wallet']);
    expect(Object.keys(data.sleeves)).toEqual(['main']);
    expect(Object.keys(data.wallet.corporations)).toEqual(['main']);
    expect(Object.keys(data.wallet).sort()).toEqual([...WALLET_KEYS.filter((k) => k !== 'corporation'), 'corporations'].sort());
    expect(Object.keys(data.sleeves.main).sort()).toEqual(SLEEVE_KEYS);
  });

  it('round-trips the all-time peaks and the key toggles', () => {
    const s = fresh();
    s.wallet.allTimePeakCredits = num(1234);
    s.wallet.allTimePeakNetwork = num(56);
    s.sleeve.peakCredits = num(10);
    const back = deserializeState(serializeState(s), config, numberFactory)!;
    expect(back.wallet.allTimePeakCredits.toNumber()).toBe(1234);
    expect(back.wallet.allTimePeakNetwork.toNumber()).toBe(56);
    expect(back.sleeve.peakCredits.toNumber()).toBe(10);
  });

  it('a save without a sleeve entry or wallet loads as a fresh game for the optional parts, and refuses a missing required amount', () => {
    expect(deserializeState(`{"version":${SAVE_VERSION}}`, config, numberFactory)).toBeNull();
    const ok = JSON.stringify({ version: SAVE_VERSION, wallet: { credits: '3' }, sleeves: { main: { network: '2' } } });
    const state = deserializeState(ok, config, numberFactory)!;
    expect(state.wallet.credits.toNumber()).toBe(3);
    expect(state.sleeve.network.toNumber()).toBe(2);
    expect(Object.keys(state.sleeve.actions)).toEqual(Object.keys(fresh().sleeve.actions));
  });
});

describe('a re-sleeve keeps exactly the fields on the positive lists', () => {
  /** A state in which every field of both parts differs from a fresh game. */
  function dirty() {
    const s = fresh();
    s.wallet.credits = num(7);
    s.wallet.allTimePeakCredits = num(70);
    s.wallet.allTimePeakNetwork = num(71);
    s.wallet.runs = [{ creditsPerSecond: num(1), actionLevelsTotal: 2 }];
    s.wallet.synths = [{ runIndex: 0 }];
    s.wallet.corporation.stocks = 5;
    s.wallet.automation.autoBurnCeiling = 9;
    s.wallet.inventory = { file: { common: 3 } };
    s.wallet.lastLifePurchases = { ghost: 1 };
    for (const f of SCALAR_FIELDS) {
      if (f.owner === 'sleeve') (s.sleeve as unknown as Record<string, unknown>)[f.key] = f.kind === 'big' ? num(7) : 7;
    }
    s.sleeve.purchased = { ghost: 1 };
    s.sleeve.autoRunOff = { ghost: true };
    s.sleeve.overclocked = { a: true };
    s.sleeve.focused = { a: true };
    s.sleeve.focusStacks = { a: 1 };
    s.sleeve.chains = { a: 1 };
    s.sleeve.bankedCriticals = { a: 1 };
    s.sleeve.keyToggles = { zeroDay: true };
    const action = s.sleeve.actions['a']!;
    Object.assign(action, {
      xp: num(9),
      sleeveXp: num(5),
      runsTowardSleeveXp: 3,
      augments: { common: 1 },
      skillShards: 2,
      running: true,
      progress: 0.5,
    });
    return s;
  }

  it('wallet: the listed fields are kept, every other one is what a fresh game has', () => {
    const before = dirty();
    const after = dirty();
    resetForResleeve(after, config, numberFactory);
    const reference = fresh();
    const kept = CARRIED_OVER_WALLET_FIELDS as readonly string[];
    for (const key of WALLET_KEYS) {
      const want = kept.includes(key) ? before.wallet : reference.wallet;
      expect(after.wallet[key as keyof typeof after.wallet], key).toEqual(want[key as keyof typeof want]);
    }
  });

  it('sleeve: every field is what a fresh game has, but the action fields on the list', () => {
    const before = dirty();
    const after = dirty();
    resetForResleeve(after, config, numberFactory);
    const reference = fresh();
    for (const key of SLEEVE_KEYS.filter((k) => k !== 'actions')) {
      expect(after.sleeve[key as keyof typeof after.sleeve], key).toEqual(reference.sleeve[key as keyof typeof reference.sleeve]);
    }
    const kept = CARRIED_OVER_ACTION_FIELDS as readonly string[];
    for (const [id, action] of Object.entries(after.sleeve.actions)) {
      for (const field of Object.keys(action)) {
        const source = kept.includes(field) ? before.sleeve.actions[id] : reference.sleeve.actions[id];
        expect(action[field as keyof typeof action], `${id}.${field}`).toEqual(source![field as keyof typeof action]);
      }
    }
  });
});
