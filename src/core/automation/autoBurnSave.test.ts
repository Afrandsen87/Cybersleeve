/**
 * How Auto Burn's per-life state is read from a save: the old on/off meaning, the records of what it switched off, and the upper trigger's flag.
 */
import { describe, expect, it } from 'vitest';
import { deserializeState, serializeState } from '..';
import { numberFactory } from '../../numbers';
import { burnConfig, burnGame, burnState } from '../../testing/autoBurnKit';
import { findInvariantViolations } from '../../testing/invariants';
import { asSave, flatSave } from '../../testing/saveKit';

/** The current-version text of a game with its Auto Burn per-life part replaced by `autoBurn`. */
const withLife = (text: string, autoBurn: Record<string, unknown>): string => {
  const data = JSON.parse(text);
  data.sleeves.main.autoBurn = autoBurn;
  return JSON.stringify(data);
};
const loadText = (text: string) => deserializeState(text, burnConfig, numberFactory)!;
const load = (data: Record<string, unknown>) => deserializeState(asSave(data), burnConfig, numberFactory)!;

describe('a save from before the Auto Burn lane had skills', () => {
  const old = (steps: number) => {
    const data = flatSave(serializeState(burnGame(steps).getState()));
    data['automation'] = { autoBurnOn: true, autoBurnCeiling: 33, autosale: {}, dispersal: {} };
    return load(data);
  };

  it('switches Hold on as well when its skill is owned (the old meaning was holding heat at the ceiling)', () => {
    const owned = old(2);
    expect(owned.sleeve.autoBurn.on).toBe(true);
    expect(owned.wallet.automation.autoBurn.switches.hold).toBe(true);
    expect(findInvariantViolations(owned, burnConfig)).toEqual([]);
  });

  it('leaves Hold off without its skill, and a save that was off stays off', () => {
    expect(old(1).wallet.automation.autoBurn.switches.hold).toBe(false);
    const data = flatSave(serializeState(burnGame(2).getState()));
    data['automation'] = { autoBurnOn: false, autoBurnCeiling: 33, autosale: {}, dispersal: {} };
    expect(load(data).wallet.automation.autoBurn.switches.hold).toBe(false);
  });
});

describe('the records of what Auto Burn switched off', () => {
  it('keep only Overclocks that make heat and Auto-runs of actions that make heat', () => {
    const text = withLife(serializeState(burnGame(5).getState()), {
      on: false,
      seconds: 0,
      overclocksOff: { hot: true, warm: true, cold: true, ghost: true },
      autoRunsOff: { 'auto-hot': true, 'auto-warm': true, 'oc-hot': true, ghost: true },
    });
    const life = loadText(text).sleeve.autoBurn;
    expect(Object.keys(life.overclocksOff).sort()).toEqual(['hot', 'warm']);
    expect(Object.keys(life.autoRunsOff).sort()).toEqual(['auto-hot']); // warm's action makes no heat: only its Overclock does;
  });
});

describe("the upper trigger's flag", () => {
  it('is saved only when it has fired, and a missing flag loads as armed', () => {
    const g = burnGame(3, 100, 10);
    expect(JSON.parse(serializeState(g.getState())).sleeves.main.autoBurn).not.toHaveProperty('upperArmed');
    g.automation().autoBurn().setSwitch('upper', true);
    burnState(g).heat = 80;
    g.tick(100);
    expect(g.getState().sleeve.autoBurn.upperArmed).toBe(false);
    const text = serializeState(g.getState());
    expect(JSON.parse(text).sleeves.main.autoBurn).toMatchObject({ upperArmed: false });
    expect(deserializeState(text, burnConfig, numberFactory)!.sleeve.autoBurn.upperArmed).toBe(false);
    expect(JSON.parse(serializeState(loadText(text))).sleeves.main.autoBurn).toEqual(JSON.parse(text).sleeves.main.autoBurn);
    const missing = withLife(text, { on: true, seconds: 0, overclocksOff: {}, autoRunsOff: {} });
    expect(loadText(missing).sleeve.autoBurn.upperArmed).toBe(true);
  });
});
