import { describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { createConfig } from '../core';
import { num } from '../numbers';
import { practiceAction, testConfig } from '../testing/testConfig';
import { buildViewModel, statRow } from './viewModel';

const synergy = {
  id: 'syn',
  name: 'Synergy',
  description: '',
  actionId: 'a',
  cost: num(1),
  effect: { kind: 'interfaceSpeedPerLnNodes', perLn: 0.01 },
} as const;
const boost = {
  id: 'boost',
  name: 'Boost',
  description: '',
  cost: num(1),
  maxPurchases: 10,
  effect: { kind: 'interfaceSpeed', amount: 0.05 },
} as const;

interface Setup {
  sleeve?: object;
  proficiency?: number;
  nodes?: number;
  withSynergy?: boolean;
  boosts?: number;
}

/** A game with the given sleeve settings, Hacking Proficiency, node count and purchases. */
const gameWith = (opts: Setup = {}) => {
  const buyables = [...testConfig.buyables.filter((b) => b.id !== 'speed'), boost, ...(opts.withSynergy ? [synergy] : [])];
  const g = createGame({ config: createConfig(testConfig, { buyables, sleeve: { baseInterfaceSpeed: 1, ...opts.sleeve } }) });
  (g.getState() as unknown as { wallet: { credits: unknown } }).wallet.credits = num(100);
  for (let i = 0; i < (opts.boosts ?? 0); i++) g.buy('boost');
  if (opts.withSynergy) g.buy('syn');
  (g.getState() as unknown as { sleeve: { hackingProficiency: unknown } }).sleeve.hackingProficiency = num(opts.proficiency ?? 0);
  if (opts.nodes !== undefined) (g.getState() as unknown as { sleeve: { network: unknown } }).sleeve.network = num(opts.nodes);
  return g;
};
const sleeveTip = (id: 'interfaceSpeed' | 'hackingProficiency', opts?: Setup): string =>
  statRow(buildViewModel(gameWith(opts)).sleeve.stats, id).tip ?? '';

describe('the Interface Speed tooltip: formulas, a blank line, the variables, a blank line, the total', () => {
  it('has exactly that layout (the blank lines are intentional)', () => {
    const tip = sleeveTip('interfaceSpeed', { sleeve: { baseInterfaceSpeed: 0.1, earnedSpeedExponent: 1 }, proficiency: 1 });
    expect(tip.split('\n')).toEqual([
      'Interface Speed = (base + boost) x Hacking Multiplier',
      'Hacking Multiplier = 1 + 1 x Hacking Proficiency',
      '',
      'Base = 0.1',
      'Boosts = 0',
      'Hacking Multiplier = 2',
      '',
      'Interface Speed = 0.2',
    ]);
  });

  it('lists the base and the boosts separately: base from the sleeve, boosts from the purchases', () => {
    const tip = sleeveTip('interfaceSpeed', { sleeve: { baseInterfaceSpeed: 0.1 }, boosts: 3 });
    expect(tip).toContain('Base = 0.1');
    expect(tip).toContain('Boosts = 0.15'); // three copies of +0.05
    expect(tip).toContain('Interface Speed = 0.25');
  });

  it('writes the real curve as the second formula', () => {
    expect(sleeveTip('interfaceSpeed', { sleeve: { earnedSpeedExponent: 0.25 } })).toContain(
      'Hacking Multiplier = 1 + 1 x ((1 + Hacking Proficiency)^0.25 - 1) / 0.25',
    );
    expect(sleeveTip('interfaceSpeed', { sleeve: { earnedSpeedExponent: 0 } })).toContain(
      'Hacking Multiplier = 1 + 1 x ln(1 + Hacking Proficiency)',
    );
    expect(sleeveTip('interfaceSpeed', { sleeve: { earnedSpeedScale: 3, earnedSpeedExponent: 1 } })).toContain(
      'Hacking Multiplier = 1 + 3 x Hacking Proficiency',
    );
  });

  it('shows the multiplier the curve gives: (1 + 15)^0.25 = 2, so (2 - 1) / 0.25 = 4 and the multiplier is 5', () => {
    const tip = sleeveTip('interfaceSpeed', { sleeve: { earnedSpeedExponent: 0.25 }, proficiency: 15 });
    expect(tip).toContain('Hacking Multiplier = 5');
    expect(tip).toContain('Interface Speed = 5');
  });

  it('shows each single 0.001 step in the multiplier (not rounded away)', () => {
    const shown = [0.03, 0.031, 0.032, 0.033].map((p) =>
      sleeveTip('interfaceSpeed', { proficiency: p, sleeve: { earnedSpeedExponent: 1 } }),
    );
    expect(new Set(shown).size).toBe(shown.length);
  });

  it('adds the Node Bonus, with the node count behind it, only once a network-based purchase is owned', () => {
    expect(sleeveTip('interfaceSpeed', {})).not.toContain('Node Bonus');
    // ln(e^100) = 100, so the bonus is 1 + 100 / 100 = 2
    const tip = sleeveTip('interfaceSpeed', {
      sleeve: { baseInterfaceSpeed: 2, earnedSpeedExponent: 1 },
      proficiency: 0.5,
      withSynergy: true,
      nodes: Math.E ** 100,
    });
    const lines = tip.split('\n');
    expect(lines[0]).toBe('Interface Speed = (base + boost) x Node Bonus x Hacking Multiplier');
    expect(tip).toContain('Node Bonus = 2 (1 + ln(nodes) / 100, with 2.69e43 nodes)');
    expect(lines.at(-1)).toBe('Interface Speed = 6'); // 2 x 2 x 1.5
  });

  it('uses no names the player cannot find: no "network factor", no "run multiplier", no "practice hacking bonus"', () => {
    const tip = sleeveTip('interfaceSpeed', { withSynergy: true, nodes: 1000 });
    for (const old of ['network factor', 'run multiplier', 'practice hacking bonus', 'earned']) expect(tip).not.toContain(old);
  });
});

describe('Hacking Proficiency as a Sleeve attribute', () => {
  const row = (opts?: Setup) => statRow(buildViewModel(gameWith(opts)).sleeve.stats, 'hackingProficiency');

  it('is listed under the Sleeve, right after Interface speed', () => {
    const labels = buildViewModel(gameWith()).sleeve.stats.map((s) => s.label);
    expect(labels.indexOf('Hacking Proficiency')).toBe(labels.indexOf('Interface speed') + 1);
  });

  it('shows the stored total, with every 0.001 step visible', () => {
    expect(row({ proficiency: 0 }).text).toBe('0');
    expect(row({ proficiency: 0.031 }).text).toBe('0.031');
    expect(row({ proficiency: 0.032 }).text).toBe('0.032');
    expect(row({ proficiency: 1000 }).text).toBe('1K');
  });

  it('has a tooltip: the formulas, a blank line, the variable, a blank line, the result', () => {
    const tip = sleeveTip('hackingProficiency', { sleeve: { earnedSpeedExponent: 0.25 }, proficiency: 15 });
    expect(tip.split('\n')).toEqual([
      'Hacking Multiplier = 1 + 1 x ((1 + Hacking Proficiency)^0.25 - 1) / 0.25',
      'Interface Speed = (base + boost) x Hacking Multiplier',
      '',
      'Hacking Proficiency = 15 (each further point adds less)',
      '',
      'Hacking Multiplier = 5',
    ]);
  });

  it('is paid by actions whose reward is Hacking Proficiency, shown with that name on the action card', () => {
    const g = createGame({ config: createConfig(testConfig, { actions: [practiceAction], buyables: [] }) });
    for (let run = 1; run <= 3; run++) {
      g.startAction(practiceAction.id);
      g.tick(1_000);
      expect(g.getState().sleeve.hackingProficiency.toNumber()).toBeCloseTo(run * 0.001, 12); // each completed run adds 0.001
    }
    const card = buildViewModel(g).actions[0]!;
    expect(card.rewardUnit).toBe('hacking proficiency');
    expect(card.rewardLine).toContain('hacking proficiency/run');
  });
});

describe('the tips say where the curve changes shape', () => {
  const bent = { sleeve: { earnedSpeedExponent: 0.25, earnedSpeedKnee: 1, earnedSpeedExponentBeyond: 0.1 }, proficiency: 15 };
  const line = 'Past 1 Hacking Proficiency the exponent is 0.1: each further point adds even less';

  it('both tips have a line for it right under the formula', () => {
    for (const id of ['interfaceSpeed', 'hackingProficiency'] as const) {
      const lines = sleeveTip(id, bent).split('\n');
      const at = lines.findIndex((l) => l.startsWith('Hacking Multiplier = 1 + '));
      expect(lines[at + 1], id).toBe(line);
    }
  });

  it('a curve with one shape has no such line', () => {
    expect(sleeveTip('interfaceSpeed', { sleeve: { earnedSpeedExponent: 0.25 }, proficiency: 15 })).not.toContain('Past ');
    expect(
      sleeveTip('interfaceSpeed', { sleeve: { earnedSpeedExponent: 0.25, earnedSpeedExponentBeyond: 0.25 }, proficiency: 15 }),
    ).not.toContain('Past ');
  });

  it('a steeper second shape says so, and the tips say what things do and never what they do not', () => {
    const steeper = { sleeve: { earnedSpeedExponent: 0.25, earnedSpeedKnee: 2, earnedSpeedExponentBeyond: 0.5 }, proficiency: 15 };
    expect(sleeveTip('hackingProficiency', steeper)).toContain(
      'Past 2 Hacking Proficiency the exponent is 0.5: each further point adds more',
    );
    for (const id of ['interfaceSpeed', 'hackingProficiency'] as const) expect(sleeveTip(id, bent)).not.toMatch(/\b(not|never|no)\b/i);
  });

  it('the real game shows it', () => {
    const tip = statRow(buildViewModel(createGame()).sleeve.stats, 'interfaceSpeed').tip ?? '';
    expect(tip).toContain('Past 1 Hacking Proficiency the exponent is 0.1');
  });
});
