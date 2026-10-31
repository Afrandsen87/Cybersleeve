/**
 * Auto Burn and the heat it can act on: heat below 1 counts as cooled, leads that cannot be used count as none, Hold's target below 1, and the
 * upper trigger that fires when heat REACHES the threshold.
 */
import { describe, expect, it } from 'vitest';
import { allOn, blockCooling, burnGame, burnState } from '../../testing/autoBurnKit';

type Game = ReturnType<typeof burnGame>;
const burn = (g: Game) => g.automation().autoBurn();
const leads = (g: Game): number => burnState(g).inventory['lead']?.['common'] ?? 0;
/** Skill count that owns every step up to and including the named one (skill 1 is the unlock). */
const STEP = { hold: 2, upper: 3, offOverclocks: 4, thresholds: 8 } as const;

describe('heat below 1 counts as cooled', () => {
  it('the toggle uses no lead on a leftover fraction of a point, and one a second from 1 point up', () => {
    const g = burnGame(1, 100, 0.5);
    g.toggleBurnLead();
    g.tick(60_000);
    expect(leads(g)).toBe(100);
    const hot = burnGame(1, 100, 1);
    hot.toggleBurnLead();
    hot.tick(1_000);
    expect(leads(hot)).toBe(99);
  });

  it('burning stops once the leads have taken heat below 1', () => {
    const g = burnGame(1, 100, 1.2);
    g.toggleBurnLead();
    for (let i = 0; i < 10; i++) g.tick(1_000);
    expect(burnState(g).heat).toBeLessThan(1);
    expect(leads(g)).toBeGreaterThan(90);
    const used = leads(g);
    g.tick(10_000);
    expect(leads(g)).toBe(used);
  });
});

describe('Hold with a lower threshold of 0', () => {
  const holdAtZero = (heat: number, held: number): Game => {
    const g = burnGame(STEP.thresholds, held, heat);
    burn(g).setThresholds(0, 50);
    burn(g).setSwitch('hold', true);
    g.toggleBurnLead();
    return g;
  };

  it('uses only the leads needed to get heat below 1, not everything beyond the reserve', () => {
    const g = holdAtZero(1, 500);
    g.tick(100);
    expect(leads(g)).toBe(499);
    expect(burnState(g).heat).toBeLessThan(1);
  });

  it('from a high heat it stops at the first lead count that gets below 1', () => {
    const g = holdAtZero(80, 500);
    g.tick(100);
    expect(burnState(g).heat).toBeLessThan(1);
    expect(burnState(g).heat / 0.95).toBeGreaterThanOrEqual(1); // one lead fewer would not have been enough
    expect(leads(g)).toBeGreaterThan(300);
  });
});

describe('leads that cannot be used count as none', () => {
  it('while an Overclock holds heat in place, the off rules act even though leads are held', () => {
    const g = burnGame(STEP.offOverclocks, 50, 100);
    allOn(g);
    blockCooling(g);
    burn(g).setSwitch('offOverclocks', true);
    g.toggleBurnLead();
    g.tick(100);
    expect(g.overclockStatus('hot')?.on).toBe(false);
    expect(leads(g)).toBe(50);
  });

  it('with cooling free and leads held, the off rules do nothing', () => {
    const g = burnGame(STEP.offOverclocks, 50, 100);
    allOn(g);
    burn(g).setSwitch('offOverclocks', true);
    g.tick(100);
    expect(g.overclockStatus('hot')?.on).toBe(true);
  });
});

describe('the upper trigger fires when heat reaches the threshold', () => {
  const armed = (heat: number): Game => {
    const g = burnGame(STEP.upper, 1000, heat);
    burn(g).setSwitch('upper', true);
    return g;
  };

  it('a player who switches the toggle off while heat stays above the threshold is left alone', () => {
    const g = armed(40);
    g.tick(100);
    expect(g.burnLeadToggle()?.on).toBe(false);
    burnState(g).heat = 80;
    g.tick(100);
    expect(g.burnLeadToggle()?.on).toBe(true);
    g.toggleBurnLead();
    burnState(g).heat = 80;
    g.tick(100);
    expect(g.burnLeadToggle()?.on).toBe(false);
    burnState(g).heat = 30; // falls below the threshold: armed again
    g.tick(100);
    burnState(g).heat = 80;
    g.tick(100);
    expect(g.burnLeadToggle()?.on).toBe(true);
  });

  it('one long tick and many short ones give the same result', () => {
    const run = (slices: number): [boolean | undefined, number] => {
      const g = armed(60);
      for (let i = 0; i < slices; i++) g.tick(10_000 / slices);
      return [g.burnLeadToggle()?.on, leads(g)];
    };
    expect(run(1)[0]).toBe(true);
    expect(run(100)[0]).toBe(true);
  });
});
