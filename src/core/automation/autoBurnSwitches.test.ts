/**
 * Auto Burn's switches: the upper threshold trigger (skill 3), switching heat-making Overclocks and Auto-runs off when out of leads (skills 4
 * and 5) and back on (skills 6 and 7), choosing the categories apart (skill 8), and how all of it is saved.
 */
import { describe, expect, it } from 'vitest';
import { deserializeState, serializeState } from '..';
import { numberFactory } from '../../numbers';
import { allOn, burnConfig, burnGame, burnState } from '../../testing/autoBurnKit';
import { findInvariantViolations } from '../../testing/invariants';
import { asSave, flatSave } from '../../testing/saveKit';

type Game = ReturnType<typeof burnGame>;
const burn = (g: Game) => g.automation().autoBurn();
const ocOn = (g: Game, id: string): boolean => g.overclockStatus(id)?.on === true;
const autoOn = (g: Game, id: string): boolean => g.getState().sleeve.autoRunOff[`auto-${id}`] !== true;
/** Skill count that owns every step up to and including the named one (skill 1 is the unlock). */
const STEP = {
  hold: 2,
  upper: 3,
  offOverclocks: 4,
  offActions: 5,
  onActions: 6,
  onOverclocks: 7,
  choose: 8,
  thresholds: 9,
  reserve: 10,
} as const;

describe('switch on at the upper threshold (skill 3)', () => {
  it('switches the toggle on when heat reaches the upper threshold, only with the switch on', () => {
    const idle = burnGame(STEP.upper, 100, 60);
    idle.tick(100);
    expect(idle.burnLeadToggle()?.on).toBe(false);
    const g = burnGame(STEP.upper, 100, 60);
    burn(g).setSwitch('upper', true);
    g.tick(100);
    expect(g.burnLeadToggle()?.on).toBe(true);
    const below = burnGame(STEP.upper, 100, 40);
    burn(below).setSwitch('upper', true);
    below.tick(100);
    expect(below.burnLeadToggle()?.on).toBe(false);
  });

  it('without hold it then uses a lead a second until the player switches it off or heat is 0', () => {
    const g = burnGame(STEP.upper, 100, 60);
    burn(g).setSwitch('upper', true);
    g.tick(5_000);
    expect(burnState(g).inventory['lead']?.['common']).toBe(95);
    g.toggleBurnLead();
    g.tick(5_000);
    expect(burnState(g).inventory['lead']?.['common']).toBe(95);
  });
});

describe('switching off when out of leads (skills 4 and 5)', () => {
  const outOfLeads = (steps: number) => {
    const g = burnGame(steps, 0, 100);
    allOn(g);
    g.toggleBurnLead(); // the off rules act only while the Burn lead toggle is on
    return g;
  };

  it('does nothing without the switches, and while heat is at or below the lower threshold', () => {
    const idle = outOfLeads(STEP.offActions);
    idle.tick(100);
    expect(ocOn(idle, 'hot') && autoOn(idle, 'hot')).toBe(true);
    const cool = burnGame(STEP.offActions, 0, 5);
    allOn(cool);
    burn(cool).setSwitch('offActions', true);
    cool.tick(100);
    expect(ocOn(cool, 'hot') && autoOn(cool, 'hot')).toBe(true);
  });

  it('switches off every Overclock that makes heat (through the action or through its Overclock), and leaves the others', () => {
    const g = outOfLeads(STEP.offOverclocks);
    burn(g).setSwitch('offOverclocks', true);
    g.tick(100);
    expect(ocOn(g, 'hot')).toBe(false);
    expect(ocOn(g, 'warm')).toBe(false);
    expect(ocOn(g, 'cold')).toBe(true);
    expect(autoOn(g, 'hot')).toBe(true);
  });

  it('with the leads in the reserve counts as out of leads', () => {
    const g = burnGame(STEP.reserve, 5, 100);
    allOn(g);
    burn(g).setReserve(5);
    burn(g).setSwitch('offOverclocks', true);
    g.toggleBurnLead();
    g.tick(100);
    expect(ocOn(g, 'hot')).toBe(false);
  });

  it('acts only while the Burn lead toggle is on', () => {
    const g = burnGame(STEP.offOverclocks, 0, 100);
    allOn(g);
    burn(g).setSwitch('offOverclocks', true);
    g.tick(100);
    expect(ocOn(g, 'hot') && ocOn(g, 'warm')).toBe(true);
    g.toggleBurnLead();
    g.tick(100);
    expect(ocOn(g, 'hot') || ocOn(g, 'warm')).toBe(false);
  });

  it('is not triggered while a lead can be used', () => {
    const g = burnGame(STEP.offOverclocks, 1, 100);
    allOn(g);
    burn(g).setSwitch('offOverclocks', true);
    g.tick(100);
    expect(ocOn(g, 'hot')).toBe(true);
  });

  it('before skill 8 the Auto-run switch (5) implies the Overclock one (4); after it each is its own choice', () => {
    const before = outOfLeads(STEP.offActions);
    burn(before).setSwitch('offActions', true);
    expect(burn(before).rules()).toMatchObject({ offOverclocks: true, offActions: true });
    burn(before).setSwitch('offOverclocks', false);
    expect(burn(before).rules()).toMatchObject({ offOverclocks: false, offActions: false });

    const after = outOfLeads(STEP.choose);
    burn(after).setSwitch('offActions', true);
    expect(burn(after).rules()).toMatchObject({ offOverclocks: false, offActions: true });
    after.tick(100);
    expect(autoOn(after, 'hot')).toBe(false);
    expect(autoOn(after, 'warm')).toBe(true); // warm's action makes no heat: only its Overclock does
    expect(ocOn(after, 'hot')).toBe(true);
  });
});

describe('switching back on (skills 6 and 7)', () => {
  /** Out of leads with everything on and both off rules set, so the automation switches the heat-making things off. */
  const switchedOff = (steps: number) => {
    const g = burnGame(steps, 0, 100);
    allOn(g);
    burn(g).setSwitch('offOverclocks', true);
    burn(g).setSwitch('offActions', true);
    g.toggleBurnLead(); // the off rules act only while the Burn lead toggle is on
    g.tick(100);
    expect(ocOn(g, 'hot') || autoOn(g, 'hot')).toBe(false);
    return g;
  };
  /** Leads arrive and heat is low. */
  const cooledWithLeads = (g: Game): void => {
    burnState(g).inventory['lead'] = { common: 10 };
    burnState(g).heat = 5;
  };

  it('switches back on only what it switched off, and the toggle', () => {
    const g = switchedOff(STEP.onOverclocks);
    g.toggleOverclock('cold'); // the player turns a harmless one off by hand: not the automation's to restore
    g.toggleBurnLead(); // the player switches the toggle off; the on rules switch it back on
    burn(g).setSwitch('onActions', true);
    burn(g).setSwitch('onOverclocks', true);
    cooledWithLeads(g);
    g.tick(100);
    expect(ocOn(g, 'hot') && ocOn(g, 'warm') && autoOn(g, 'hot')).toBe(true);
    expect(ocOn(g, 'cold')).toBe(false);
    expect(g.burnLeadToggle()?.on).toBe(true);
  });

  it('does not act while heat is not below the lower threshold, or no lead is available, or the switches are off', () => {
    for (const setup of [(g: Game) => (burnState(g).heat = 30), (g: Game) => (burnState(g).inventory['lead'] = { common: 0 })]) {
      const g = switchedOff(STEP.onOverclocks);
      burn(g).setSwitch('onActions', true);
      burn(g).setSwitch('onOverclocks', true);
      cooledWithLeads(g);
      setup(g);
      g.tick(100);
      expect(ocOn(g, 'hot') || autoOn(g, 'hot')).toBe(false);
    }
    const off = switchedOff(STEP.onOverclocks);
    cooledWithLeads(off);
    off.tick(100);
    expect(ocOn(off, 'hot') || autoOn(off, 'hot')).toBe(false);
  });

  it('what the player switched by hand after the automation is not switched back on', () => {
    const g = switchedOff(STEP.onOverclocks);
    g.toggleOverclock('hot'); // on by hand ...
    g.toggleOverclock('hot'); // ... and off by hand again: the record of the automation is gone
    burn(g).setSwitch('onActions', true);
    burn(g).setSwitch('onOverclocks', true);
    cooledWithLeads(g);
    g.tick(100);
    expect(ocOn(g, 'hot')).toBe(false);
    expect(ocOn(g, 'warm')).toBe(true);
    expect(autoOn(g, 'hot')).toBe(true);
    g.toggleAutoRun('auto-hot'); // by hand: off
    expect(autoOn(g, 'hot')).toBe(false);
  });

  it('before skill 8 the Overclock switch (7) implies the Auto-run one (6); after it they are independent', () => {
    const before = switchedOff(STEP.onOverclocks);
    burn(before).setSwitch('onOverclocks', true);
    expect(burn(before).rules()).toMatchObject({ onActions: true, onOverclocks: true });
    const after = switchedOff(STEP.choose);
    burn(after).setSwitch('onActions', true);
    cooledWithLeads(after);
    after.tick(100);
    expect(autoOn(after, 'hot')).toBe(true);
    expect(ocOn(after, 'hot')).toBe(false); // actions back on without their Overclock
  });

  it('the record is per life: a re-sleeve clears it', () => {
    const g = switchedOff(STEP.onOverclocks);
    expect(Object.keys(g.getState().sleeve.autoBurn.overclocksOff).length).toBeGreaterThan(0);
    g.resleeve();
    expect(g.getState().sleeve.autoBurn.overclocksOff).toEqual({});
    expect(g.getState().sleeve.autoBurn.on).toBe(false);
  });
});

describe('Auto Burn is saved', () => {
  const setup = () => {
    const g = burnGame(STEP.reserve, 20, 100);
    allOn(g);
    burn(g).setThresholds(15, 80);
    burn(g).setReserve(3);
    for (const name of ['hold', 'upper', 'offOverclocks', 'offActions', 'onActions', 'onOverclocks'] as const)
      burn(g).setSwitch(name, true);
    g.toggleBurnLead();
    burnState(g).inventory['lead'] = { common: 0 };
    g.tick(100);
    return g;
  };

  it('a save restores the settings, the toggle and the record of what was switched off, and keeps every invariant', () => {
    const g = setup();
    const restored = deserializeState(serializeState(g.getState()), burnConfig, numberFactory)!;
    expect(restored.wallet.automation.autoBurn).toEqual(g.getState().wallet.automation.autoBurn);
    expect(restored.sleeve.autoBurn).toEqual(g.getState().sleeve.autoBurn);
    expect(restored.sleeve.autoBurn.on).toBe(true);
    expect(Object.keys(restored.sleeve.autoBurn.overclocksOff)).toContain('hot');
    expect(findInvariantViolations(restored, burnConfig)).toEqual([]);
  });

  it('saving, loading and saving again gives the same text', () => {
    const saved = serializeState(setup().getState());
    expect(serializeState(deserializeState(saved, burnConfig, numberFactory)!)).toBe(saved);
  });

  it('a save written before the lane had skills loads with the toggle on and the old ceiling as the lower threshold', () => {
    const data = flatSave(serializeState(burnGame(1).getState()));
    data.automation = { autoBurnOn: true, autoBurnCeiling: 33, autosale: {}, dispersal: {} };
    const restored = deserializeState(asSave(data), burnConfig, numberFactory)!;
    expect(restored.sleeve.autoBurn.on).toBe(true);
    expect(restored.wallet.automation.autoBurn.lower).toBe(33);
    expect(restored.wallet.automation.autoBurn.upper).toBeGreaterThan(33);
    expect(findInvariantViolations(restored, burnConfig)).toEqual([]);
  });

  it('a save cannot switch the toggle on without the unlock, and bad numbers fall back', () => {
    const data = flatSave(serializeState(burnGame(0).getState()));
    data.automation = { autoBurnOn: true, autoBurn: { lower: -4, upper: Number.NaN, reserve: 2.5, switches: { hold: true } } };
    const restored = deserializeState(asSave(data), burnConfig, numberFactory)!;
    expect(restored.sleeve.autoBurn.on).toBe(false);
    expect(restored.wallet.automation.autoBurn).toMatchObject({ lower: 10, upper: 50, reserve: 0 });
  });
});
