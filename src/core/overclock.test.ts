import { describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { num, numberFactory } from '../numbers';
import { findInvariantViolations } from '../testing/invariants';
import { networkAction, setCredits, testConfig } from '../testing/testConfig';
import { coolHeat, createConfig, deserializeState, serializeState, validateConfig, type BuyableDefinition, type GameConfig } from './index';

/** Overclock on the test action: 50% faster, 1 heat per minute. The second action ('net') has no Overclock rule. */
const RULE = { speedBonus: 0.5, heatPerMinute: 1 };

const unlock = (id: string, actionId: string, kind: 'overclockUnlock' | 'focusUnlock'): BuyableDefinition => ({
  id,
  name: id,
  description: '',
  actionId,
  cost: num(1),
  effect: { kind },
});

/** Makes every Overclock 10% stronger per copy. */
const strengthUpgrade = (over: Partial<BuyableDefinition> = {}): BuyableDefinition => ({
  id: 'ocs',
  name: 'Overclock upgrade',
  description: '',
  cost: num(1),
  costGrowth: 1000,
  maxPurchases: Infinity,
  effect: { kind: 'overclockStrength', perCopy: 0.1 },
  ...over,
});

/** Adds one Focus slot per copy (the test content has one free slot to start with). */
const slotUpgrade = (over: Partial<BuyableDefinition> = {}): BuyableDefinition => ({
  id: 'slots',
  name: 'Focus upgrade',
  description: '',
  cost: num(1),
  maxPurchases: 3,
  effect: { kind: 'focusSlots', perCopy: 1 },
  ...over,
});

const ALL = (): BuyableDefinition[] => [
  unlock('oc-a', 'a', 'overclockUnlock'),
  unlock('fo-a', 'a', 'focusUnlock'),
  unlock('fo-net', 'net', 'focusUnlock'),
  strengthUpgrade(),
  slotUpgrade(),
];

/** Action and sleeve levels are pushed out of reach so that the speed of an action stays exactly what the toggles make it. */
function configWith(extra: BuyableDefinition[] = ALL()): GameConfig {
  const base = createConfig(testConfig, {
    buyables: [...testConfig.buyables, ...extra],
    progression: { actionLevels: { firstLevelXp: 1e12, growthFactor: 10 }, sleeveLevels: { firstLevelXp: 1e12, growthFactor: 10 } },
    network: { creditsPerNodePerSecond: 0 },
  });
  return createConfig(base, { actions: [{ ...base.actions[0]!, overclock: RULE }, networkAction] });
}

function game(config = configWith()) {
  const g = createGame({ config });
  setCredits(g, num(1e12));
  return g;
}

const buyTimes = (g: ReturnType<typeof game>, id: string, n = 1): void => {
  for (let i = 0; i < n; i++) expect(g.buy(id)).toBe('purchased');
};

describe('Overclock', () => {
  it('has no toggle before the action unlocks it, and toggling does nothing', () => {
    const g = game();
    expect(g.overclockStatus('a')).toBeNull();
    expect(g.toggleOverclock('a')).toBe(false);
    expect(g.getState().overclocked).toEqual({});
  });

  it('the upgrade alone does not unlock it', () => {
    const g = game();
    buyTimes(g, 'ocs');
    expect(g.overclockStatus('a')).toBeNull();
  });

  it('the unlock adds the toggle, off at first, with the full effect of the action rule', () => {
    const g = game();
    buyTimes(g, 'oc-a');
    expect(g.overclockStatus('a')).toEqual({
      on: false,
      blocksHeatCooling: false,
      chain: null,
      speedBonus: 0.5,
      rewardBonus: 0,
      heatPerMinute: 1,
      heatPerRunFactor: 1,
      completionEffects: [],
      alsoPays: null,
      strength: 1,
    });
  });

  it('an action without an Overclock rule has no toggle', () => {
    const g = game();
    buyTimes(g, 'oc-a');
    expect(g.overclockStatus('net')).toBeNull();
    expect(g.toggleOverclock('net')).toBe(false);
    expect(g.getState().overclocked).toEqual({});
  });

  it('every upgrade copy makes the gains 10% stronger: strength 1, 1.1, 1.2, 1.3 and a speed bonus of 50%, 55%, 60%, 65%', () => {
    const g = game();
    buyTimes(g, 'oc-a');
    const seen: [number, number][] = [];
    for (let copies = 0; copies <= 3; copies++) {
      if (copies > 0) buyTimes(g, 'ocs');
      const s = g.overclockStatus('a')!;
      seen.push([s.strength, s.speedBonus]);
      expect(s.heatPerMinute).toBe(1); // the heat cost does not grow with the upgrades
    }
    seen.forEach(([strength, bonus], i) => {
      expect(strength).toBeCloseTo(1 + 0.1 * i, 12);
      expect(bonus).toBeCloseTo(0.5 * (1 + 0.1 * i), 12);
    });
  });

  it('toggling switches it on and off and says which', () => {
    const g = game();
    buyTimes(g, 'oc-a');
    expect(g.toggleOverclock('a')).toBe(true);
    expect(g.overclockStatus('a')!.on).toBe(true);
    expect(g.toggleOverclock('a')).toBe(false);
    expect(g.overclockStatus('a')!.on).toBe(false);
    expect(g.getState().overclocked).toEqual({});
  });

  it('while on, the action is 50% faster; while off, nothing changes', () => {
    const g = game();
    buyTimes(g, 'oc-a');
    expect(g.currentDurationMs('a')).toBeCloseTo(10_000, 9);
    g.toggleOverclock('a');
    expect(g.currentSpeed('a')).toBeCloseTo(1.5, 12);
    expect(g.currentDurationMs('a')).toBeCloseTo(10_000 / 1.5, 9);
    g.toggleOverclock('a');
    expect(g.currentDurationMs('a')).toBeCloseTo(10_000, 9);
  });

  it('a stronger Overclock makes the action faster by the scaled bonus', () => {
    const g = game();
    buyTimes(g, 'oc-a');
    buyTimes(g, 'ocs', 2);
    g.toggleOverclock('a');
    expect(g.currentSpeed('a')).toBeCloseTo(1.6, 12);
  });

  it('lists its own factor in the speed factors', () => {
    const g = game();
    buyTimes(g, 'oc-a');
    g.toggleOverclock('a');
    expect(g.speedFactors('a').find((f) => f.id === 'overclock')!.factor).toBeCloseTo(1.5, 12);
  });

  it('is reset by re-sleeving', () => {
    const g = game();
    buyTimes(g, 'oc-a');
    g.toggleOverclock('a');
    g.resleeve();
    expect(g.getState().overclocked).toEqual({});
  });
});

describe('Overclock heat', () => {
  const run = (ms: number, on = true) => {
    const g = game();
    buyTimes(g, 'oc-a');
    buyTimes(g, 'auto');
    if (on) g.toggleOverclock('a');
    g.startAction('a');
    g.tick(ms);
    return g;
  };

  it('adds heat in fractions: half a point after 30 s of running', () => {
    expect(run(30_000).getState().heat).toBeCloseTo(0.5, 9);
  });

  it('adds nothing while it is off', () => {
    expect(run(30_000, false).getState().heat).toBe(0);
  });

  it('adds one point per minute of running: 90 s gives 1.5 heat (the first cooldown cycle is not over yet)', () => {
    expect(run(90_000).getState().heat).toBeCloseTo(1.5, 9);
  });

  it('is charged only for the time the action ran: a manual run of 6.67 s on a 100 s tick', () => {
    const g = game();
    buyTimes(g, 'oc-a');
    g.toggleOverclock('a');
    g.startAction('a');
    g.tick(100_000);
    expect(g.getState().actions['a']!.running).toBe(false);
    expect(g.getState().heat).toBeCloseTo(10_000 / 1.5 / 60_000, 9);
  });

  it('is not charged to an action that is not running', () => {
    const g = game();
    buyTimes(g, 'oc-a');
    g.toggleOverclock('a');
    g.tick(60_000);
    expect(g.getState().heat).toBe(0);
  });

  it('one long tick and many short ones add the same heat and pay the same credits', () => {
    const one = run(90_000);
    const many = game();
    buyTimes(many, 'oc-a');
    buyTimes(many, 'auto');
    many.toggleOverclock('a');
    many.startAction('a');
    for (let i = 0; i < 1800; i++) many.tick(50);
    expect(many.getState().heat).toBeCloseTo(one.getState().heat, 6);
    expect(many.getState().credits.toNumber()).toBeCloseTo(one.getState().credits.toNumber(), 6);
  });

  it('overclocking pays more runs in the same time: 15 runs in 100 s instead of 10', () => {
    const credits = (g: ReturnType<typeof game>) => g.getState().credits.toNumber();
    const off = run(100_000, false);
    const on = run(100_000, true);
    expect(credits(on) - credits(off)).toBeCloseTo(5 * 0.5, 6); // both games bought the same things; 10 runs against 15 at 0.5 each
  });
});

describe('heat in fractions of a point', () => {
  it('does not cool below one whole point: 0.9 heat stays for ten minutes', () => {
    const g = game();
    (g.getState() as { heat: number }).heat = 0.9;
    g.tick(600_000);
    expect(g.getState().heat).toBeCloseTo(0.9, 12);
    expect(g.getState().heatCooldownMs).toBe(0);
  });

  it('removes whole points only: 3.5 heat cools to 0.5 and stays there', () => {
    const g = game();
    (g.getState() as { heat: number }).heat = 3.5;
    g.tick(60_000 * 10);
    expect(g.getState().heat).toBeCloseTo(0.5, 12);
  });

  it('starts cooling when the heat reaches 1: the cycle waits at 0 until then', () => {
    const r = coolHeat({ heat: 0.99, cooldownMs: 0 }, 120_000, 60_000, 1);
    expect(r).toEqual({ heat: 0.99, cooldownMs: 0 });
    const reached = coolHeat({ heat: 1, cooldownMs: 0 }, 60_000, 60_000, 1);
    expect(reached.heat).toBe(0);
  });

  it('counts floating-point dust below a whole point as a whole point', () => {
    let heat = 0;
    for (let i = 0; i < 60; i++) heat += 1 / 60; // adds up to 0.9999999999999999 or 1.0000000000000002
    expect(coolHeat({ heat, cooldownMs: 0 }, 60_000, 60_000, 1).heat).toBe(0);
  });

  it('keeps the progress of the current cycle while there is more to cool', () => {
    const r = coolHeat({ heat: 5.5, cooldownMs: 10_000 }, 20_000, 60_000, 1);
    expect(r).toEqual({ heat: 5.5, cooldownMs: 30_000 });
  });

  it('survives a save with fractional heat', () => {
    const g = game();
    (g.getState() as { heat: number }).heat = 1.25;
    const restored = deserializeState(serializeState(g.getState()), configWith(), numberFactory)!;
    expect(restored.heat).toBe(1.25);
  });
});

describe('Focus', () => {
  it('has no toggle before the action unlocks it, and toggling does nothing', () => {
    const g = game();
    expect(g.focusStatus('a')).toBeNull();
    expect(g.toggleFocus('a')).toBe(false);
  });

  it('the slot upgrade alone does not unlock it', () => {
    const g = game();
    buyTimes(g, 'slots');
    expect(g.focusStatus('a')).toBeNull();
  });

  it('the unlock gives that action the toggle, off at first, with one free slot and a bonus of 25%; other actions stay locked', () => {
    const g = game();
    buyTimes(g, 'fo-a');
    expect(g.focusStatus('a')).toEqual({
      on: false,
      speedBonus: 0.25,
      slots: 1,
      used: 0,
      canSwitchOn: true,
      count: 0,
      stacking: false,
      canAdd: true,
      canRemove: false,
    });
    expect(g.focusStatus('net')).toBeNull();
  });

  it('while on, the action runs 25% faster', () => {
    const g = game();
    buyTimes(g, 'fo-a');
    expect(g.toggleFocus('a')).toBe(true);
    expect(g.currentSpeed('a')).toBeCloseTo(1.25, 12);
    expect(g.currentDurationMs('a')).toBeCloseTo(8_000, 9);
  });

  it('works on an action that has no Overclock rule', () => {
    const g = game();
    buyTimes(g, 'fo-net');
    g.toggleFocus('net');
    expect(g.currentSpeed('net')).toBeCloseTo(1.25, 12);
  });

  it('with one slot, a second action cannot be focused until the first is switched off', () => {
    const g = game();
    buyTimes(g, 'fo-a');
    buyTimes(g, 'fo-net');
    g.toggleFocus('a');
    const netSpeed = g.currentSpeed('net');
    expect(g.focusStatus('net')).toMatchObject({ used: 1, slots: 1, canSwitchOn: false });
    expect(g.toggleFocus('net')).toBe(false);
    expect(g.currentSpeed('net')).toBe(netSpeed); // the refused toggle changed nothing
    expect(g.getState().focused).toEqual({ a: true });
    expect(g.toggleFocus('a')).toBe(false); // switching off always works
    expect(g.toggleFocus('net')).toBe(true);
    expect(g.getState().focused).toEqual({ net: true });
  });

  it('each slot upgrade is one more slot: with a second slot two actions are focused at the same 25% each', () => {
    const g = game();
    buyTimes(g, 'fo-a');
    buyTimes(g, 'fo-net');
    buyTimes(g, 'slots');
    expect(g.toggleFocus('a')).toBe(true);
    expect(g.toggleFocus('net')).toBe(true);
    expect(g.focusStatus('a')).toMatchObject({ used: 2, slots: 2 });
    expect(g.currentSpeed('a')).toBeCloseTo(1.25, 12);
    expect(g.currentSpeed('net')).toBeCloseTo(1.25, 12);
  });

  it('the slot upgrade cannot be bought beyond its cap', () => {
    const g = game();
    buyTimes(g, 'slots', 3);
    expect(g.buy('slots')).toBe('max-reached');
  });

  it('multiplies with Overclock: 1.5 x 1.25', () => {
    const g = game();
    buyTimes(g, 'oc-a');
    buyTimes(g, 'fo-a');
    g.toggleOverclock('a');
    g.toggleFocus('a');
    expect(g.currentSpeed('a')).toBeCloseTo(1.5 * 1.25, 12);
  });

  it('adds no heat', () => {
    const g = game();
    buyTimes(g, 'fo-a');
    buyTimes(g, 'auto');
    g.toggleFocus('a');
    g.startAction('a');
    g.tick(120_000);
    expect(g.getState().heat).toBe(0);
  });

  it('is reset by re-sleeving', () => {
    const g = game();
    buyTimes(g, 'fo-a');
    g.toggleFocus('a');
    g.resleeve();
    expect(g.getState().focused).toEqual({});
  });
});

describe('saving and loading the toggles', () => {
  const owned = (): ReturnType<typeof game> => {
    const g = game();
    buyTimes(g, 'oc-a');
    buyTimes(g, 'fo-net');
    g.toggleOverclock('a');
    g.toggleFocus('net');
    return g;
  };

  it('round-trips both toggles', () => {
    const restored = deserializeState(serializeState(owned().getState()), configWith(), numberFactory)!;
    expect(restored.overclocked).toEqual({ a: true });
    expect(restored.focused).toEqual({ net: true });
  });

  it('a save without the toggle fields loads with both off', () => {
    const json = JSON.parse(serializeState(owned().getState()));
    delete json.overclocked;
    delete json.focused;
    const restored = deserializeState(JSON.stringify(json), configWith(), numberFactory)!;
    expect(restored.overclocked).toEqual({});
    expect(restored.focused).toEqual({});
  });

  it('ignores a toggle whose unlock is not owned, that has no rule, or that names an unknown action', () => {
    const json = JSON.parse(serializeState(game().getState()));
    json.overclocked = { a: true, net: true, ghost: true };
    json.focused = { a: true, net: true, ghost: true };
    const restored = deserializeState(JSON.stringify(json), configWith(), numberFactory)!;
    expect(restored.overclocked).toEqual({});
    expect(restored.focused).toEqual({});
  });

  it('keeps no more focused actions than there are slots, and none whose unlock is missing', () => {
    const g = game();
    buyTimes(g, 'oc-a');
    buyTimes(g, 'fo-a');
    buyTimes(g, 'fo-net');
    const json = JSON.parse(serializeState(g.getState()));
    json.focused = { a: true, net: true }; // one free slot only
    json.overclocked = { net: true, a: 'yes' };
    const restored = deserializeState(JSON.stringify(json), configWith(), numberFactory)!;
    expect(restored.focused).toEqual({ a: true });
    expect(restored.overclocked).toEqual({});
  });

  it('a loaded game keeps every invariant', () => {
    const config = configWith();
    const restored = deserializeState(serializeState(owned().getState()), config, numberFactory)!;
    expect(findInvariantViolations(restored, config)).toEqual([]);
  });
});

describe('validation of Overclock and Focus', () => {
  const problems = (config: GameConfig): string => validateConfig(config).join('|');

  it('the test content is valid', () => {
    expect(validateConfig(configWith())).toEqual([]);
  });

  it.each([
    [strengthUpgrade({ effect: { kind: 'overclockStrength', perCopy: 0 } }), 'perCopy must be > 0'],
    [strengthUpgrade({ effect: { kind: 'overclockStrength', perCopy: Number.NaN } }), 'perCopy must be > 0'],
    [slotUpgrade({ effect: { kind: 'focusSlots', perCopy: 0 } }), 'perCopy must be an integer >= 1'],
    [slotUpgrade({ effect: { kind: 'focusSlots', perCopy: 1.5 } }), 'perCopy must be an integer >= 1'],
    [unlock('x', 'net', 'overclockUnlock'), 'overclockUnlock needs an action that has an overclock rule'],
    [{ ...unlock('x', 'a', 'focusUnlock'), actionId: undefined }, 'focusUnlock needs an actionId'],
  ])('rejects a bad buyable', (b, message) => {
    expect(problems(configWith([b]))).toContain(message);
  });

  it.each([
    [{ speedBonus: 0, heatPerMinute: 1 }, 'overclock speedBonus must be > 0'],
    [{ speedBonus: 0.5, heatPerMinute: -1 }, 'overclock heatPerMinute must be >= 0'],
  ])('rejects a bad action rule', (rule, message) => {
    const base = configWith();
    const config = createConfig(base, { actions: [{ ...base.actions[0]!, overclock: rule }] });
    expect(problems(config)).toContain(message);
  });

  it.each([
    [{ speedBonus: 0 }, 'focus.speedBonus must be > 0'],
    [{ baseSlots: 0 }, 'focus.baseSlots must be an integer >= 1'],
  ])('rejects a bad focus section %j', (focus, message) => {
    expect(problems(createConfig(configWith(), { focus }))).toContain(message);
  });
});
