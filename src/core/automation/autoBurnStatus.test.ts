/**
 * Auto Burn's status: the activity (first match wins), the firing flags, the available leads under a reserve, edge heat values, and that
 * `AutoBurnControls.status` reads the live game.
 */
import { describe, expect, it } from 'vitest';
import { blockCooling, burnGame, burnRules } from '../../testing/autoBurnKit';
import { autoBurnStatus, availableLeads, shouldSwitchOff, shouldSwitchOn } from './autoBurnStatus';

/** A snapshot: toggle on, 5 leads held and usable, heat 30. */
const snap = (over: Partial<{ heat: number; toggleOn: boolean; held: number; usable: boolean }> = {}) => ({
  heat: 30,
  toggleOn: true,
  held: 5,
  usable: true,
  ...over,
});

describe('activity, first match wins', () => {
  it('standby when the toggle is off, even with nothing else going on', () => {
    expect(autoBurnStatus(burnRules(), snap({ toggleOn: false, held: 0, usable: false })).activity).toBe('standby');
  });

  it('idle with no whole point of heat, before blocked or dry', () => {
    expect(autoBurnStatus(burnRules(), snap({ heat: 0.5, held: 0, usable: false })).activity).toBe('idle');
  });

  it('blocked while leads cannot be used, before dry', () => {
    expect(autoBurnStatus(burnRules(), snap({ held: 0, usable: false })).activity).toBe('blocked');
  });

  it('dry with no leads available', () => {
    expect(autoBurnStatus(burnRules(), snap({ held: 0 })).activity).toBe('dry');
  });

  it('holding when hold is on and heat is at or under the lower threshold, burning above it', () => {
    expect(autoBurnStatus(burnRules({ hold: true }), snap({ heat: 10 })).activity).toBe('holding');
    expect(autoBurnStatus(burnRules({ hold: true }), snap({ heat: 11 })).activity).toBe('burning');
  });

  it('burning without hold, whatever the heat', () => {
    expect(autoBurnStatus(burnRules(), snap({ heat: 5 })).activity).toBe('burning');
  });
});

describe('firing flags', () => {
  it('trigger: upper on and heat at or above the upper threshold', () => {
    expect(autoBurnStatus(burnRules({ upper: true }), snap({ heat: 50 })).firing.trigger).toBe(true);
    expect(autoBurnStatus(burnRules({ upper: true }), snap({ heat: 49 })).firing.trigger).toBe(false);
    expect(autoBurnStatus(burnRules(), snap({ heat: 50 })).firing.trigger).toBe(false);
  });

  it('throttle: hold on while burning, not while holding', () => {
    expect(autoBurnStatus(burnRules({ hold: true }), snap({ heat: 30 })).firing.throttle).toBe(true);
    expect(autoBurnStatus(burnRules({ hold: true }), snap({ heat: 5 })).firing.throttle).toBe(false);
    expect(autoBurnStatus(burnRules(), snap()).firing.throttle).toBe(false);
  });

  it('failsafe: an off switch, out of leads above the lower threshold with the toggle on', () => {
    const off = burnRules({ offActions: true });
    expect(autoBurnStatus(off, snap({ held: 0 })).firing.failsafe).toBe(true);
    expect(autoBurnStatus(burnRules({ offOverclocks: true }), snap({ usable: false })).firing.failsafe).toBe(true);
    expect(autoBurnStatus(off, snap({ held: 0, toggleOn: false })).firing.failsafe).toBe(false);
    expect(autoBurnStatus(off, snap({ held: 0, heat: 10 })).firing.failsafe).toBe(false);
    expect(autoBurnStatus(burnRules(), snap({ held: 0 })).firing.failsafe).toBe(false);
  });

  it('restart: an on switch, leads available below the lower threshold', () => {
    expect(autoBurnStatus(burnRules({ onActions: true }), snap({ heat: 5 })).firing.restart).toBe(true);
    expect(autoBurnStatus(burnRules({ onOverclocks: true }), snap({ heat: 5, toggleOn: false })).firing.restart).toBe(true);
    expect(autoBurnStatus(burnRules({ onActions: true }), snap({ heat: 10 })).firing.restart).toBe(false);
    expect(autoBurnStatus(burnRules({ onActions: true }), snap({ heat: 5, held: 0 })).firing.restart).toBe(false);
    expect(autoBurnStatus(burnRules(), snap({ heat: 5 })).firing.restart).toBe(false);
  });
});

describe('leads and the reserve', () => {
  it('available is held minus the reserve, and 0 when the reserve is larger or leads cannot be used', () => {
    expect(autoBurnStatus(burnRules({ reserve: 2 }), snap({ held: 5 }))).toMatchObject({ held: 5, available: 3 });
    expect(autoBurnStatus(burnRules({ reserve: 9 }), snap({ held: 5 }))).toMatchObject({ held: 5, available: 0, activity: 'dry' });
    expect(availableLeads(burnRules(), { held: 5, usable: false })).toBe(0);
  });

  it('the off and on conditions read the reserve', () => {
    expect(shouldSwitchOff(burnRules({ reserve: 5 }), snap({ held: 5 }))).toBe(true);
    expect(shouldSwitchOn(burnRules({ reserve: 5 }), snap({ held: 5, heat: 0 }))).toBe(false);
  });
});

describe('edge heat values', () => {
  it('heat 0 and a fraction below 1 are idle', () => {
    expect(autoBurnStatus(burnRules(), snap({ heat: 0 })).activity).toBe('idle');
    expect(autoBurnStatus(burnRules(), snap({ heat: 0.999 })).activity).toBe('idle');
  });

  it('huge heat burns and fires the trigger', () => {
    const s = autoBurnStatus(burnRules({ upper: true }), snap({ heat: 1e300 }));
    expect(s).toMatchObject({ activity: 'burning', heat: 1e300 });
    expect(s.firing.trigger).toBe(true);
  });

  it('NaN and negative heat show as 0 and idle, and do not throw', () => {
    for (const heat of [Number.NaN, -5]) {
      expect(autoBurnStatus(burnRules({ upper: true, onActions: true }), snap({ heat }))).toMatchObject({ heat: 0, activity: 'idle' });
    }
  });

  it('the firing flags agree with the conditions the step uses, NaN heat included', () => {
    const rules = burnRules({ upper: true, hold: true, offActions: true, onActions: true });
    for (const heat of [Number.NaN, -5, 0, 5, 30, 1e300]) {
      for (const held of [0, 5]) {
        const s = snap({ heat, held });
        const { firing } = autoBurnStatus(rules, s);
        expect(firing.failsafe).toBe(shouldSwitchOff(rules, s));
        expect(firing.restart).toBe(shouldSwitchOn(rules, s));
      }
    }
    expect(autoBurnStatus(rules, snap({ heat: Number.NaN })).firing).toEqual({
      trigger: false,
      throttle: false,
      failsafe: false,
      restart: false,
    });
  });
});

describe('AutoBurnControls.status', () => {
  it('reads heat, the toggle and the held leads of the live game', () => {
    const g = burnGame(1, 3, 20);
    const burn = g.automation().autoBurn();
    expect(burn.status()).toMatchObject({ activity: 'standby', held: 3, available: 3, heat: 20, toggleOn: false });
    g.toggleBurnLead();
    expect(burn.status().activity).toBe('burning');
  });

  it('is blocked while an Overclock stops heat cooling', () => {
    const g = burnGame(1, 3, 20);
    blockCooling(g);
    g.toggleBurnLead();
    expect(g.automation().autoBurn().status()).toMatchObject({ activity: 'blocked', available: 0 });
  });
});
