import { describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { gameConfig } from '../content/gameConfig';
import { createConfig } from '../core';
import { num } from '../numbers';
import { testConfig } from '../testing/testConfig';
import { buildViewModel, statRow } from './viewModel';

const game = (overrides = {}) => createGame({ config: createConfig(testConfig, overrides) });
const sleeveTip = (g: ReturnType<typeof game>, id: Parameters<typeof statRow>[1]): string =>
  statRow(buildViewModel(g).sleeve.stats, id).tip ?? '';
const set = (g: ReturnType<typeof game>, patch: Record<string, unknown>): void => void Object.assign(g.getState(), patch);

describe('Access Level tooltip', () => {
  const locked = { ...testConfig.actions[0]!, id: 'b', name: 'Locked action', requiredAccessLevel: 3 };

  it('shows the formula, the start level, what purchases added, the level, and the next unlock', () => {
    const g = game({ actions: [testConfig.actions[0]!, locked] });
    expect(sleeveTip(g, 'access').split('\n')).toEqual([
      'Access Level = Start Level + Purchases',
      '',
      'Start Level = 1',
      'Purchases = 0',
      '',
      'Access Level = 1',
      '',
      'Next unlock: Locked action at Access Level 3',
    ]);
  });

  it('counts purchases, and names the lowest level above the current one as the next unlock', () => {
    const g = game({ actions: [testConfig.actions[0]!, { ...locked, id: 'c', name: 'Later', requiredAccessLevel: 5 }, locked] });
    set(g, { credits: num(1000) });
    g.buy('access');
    const tip = sleeveTip(g, 'access');
    expect(tip).toContain('Purchases = 1');
    expect(tip).toContain('Access Level = 2');
    expect(tip).toContain('Next unlock: Locked action at Access Level 3');
  });

  it('has no "next unlock" line once every action is open', () => {
    expect(sleeveTip(game(), 'access')).not.toContain('Next unlock');
  });
});

describe('Heat, ICE Rating and Legend tooltips', () => {
  it('Heat: formula, a blank line, the variables, a blank line, the result', () => {
    const g = game();
    set(g, { heat: 7 });
    expect(sleeveTip(g, 'heat').split('\n')).toEqual([
      'Heat Tax = Heat x Tax per Point x (1 - Heat Reduction)',
      '',
      'Heat = 7',
      'Tax per Point = 1%',
      'Heat Reduction = 0% (from ICE Rating)',
      '',
      'Heat Tax = 7% of all credits earned from nodes',
      'Node credits stop at 100 heat',
      'Heat falls by 1 every 60s, once at least 1 heat is held',
    ]);
  });

  it('ICE Rating: orders of magnitude times the reduction per order', () => {
    const g = game();
    set(g, { iceRating: num('1e100') });
    expect(sleeveTip(g, 'iceRating').split('\n')).toEqual([
      'ICE Rating = Earned',
      '',
      'Earned = 1e100',
      'ICE Rating = 1e100',
      '',
      'Heat Reduction = Orders of Magnitude x Reduction per Order',
      '',
      'Orders of Magnitude = 100',
      'Reduction per Order = 0.5%',
      '',
      'Heat Reduction = 50%',
      'Reaches 100% at 1e200',
    ]);
  });

  it('ICE Rating: says nothing about 100% when the reduction never gets there', () => {
    const g = game({ sleeve: { iceRatingReductionPerOrder: 0 } });
    expect(sleeveTip(g, 'iceRating')).not.toContain('Reaches 100%');
  });

  it('Legend: the heat cooldown time it causes, and how fast it falls', () => {
    const g = game();
    set(g, { legend: 2 });
    expect(sleeveTip(g, 'legend').split('\n')).toEqual([
      'Heat Cooldown Time = Base Time / (1 + Speedup per Legend x Legend)',
      '',
      'Base Time = 60s',
      'Speedup per Legend = 10%',
      'Legend = 2',
      '',
      'Heat Cooldown Time = 50s',
      'Legend falls by 1 every 10 min',
    ]);
  });
});

describe('purchase tooltips', () => {
  const tipOf = (id: string, g = game()): string => {
    const vm = buildViewModel(g);
    return [...vm.sleeve.buyables, ...vm.actions.flatMap((a) => a.buyables)].find((b) => b.id === id)!.tip;
  };

  it('a purchase not yet owned: name, what it does, then the cost; a repeatable one also shows how many are owned', () => {
    const g = game({
      buyables: [
        { id: 'once', name: 'Once', description: 'Does one thing.', cost: num(5), effect: { kind: 'interfaceSpeed', amount: 1 } },
        {
          id: 'many',
          name: 'Many',
          description: 'Does it again.',
          cost: num(7),
          maxPurchases: Infinity,
          effect: { kind: 'interfaceSpeed', amount: 1 },
        },
      ],
    });
    expect(tipOf('once', g)).toBe('Once\nDoes one thing.\n\nCost = 5 credits');
    expect(tipOf('many', g)).toBe('Many\nDoes it again.\n\nCost = 7 credits\nOwned = 0');
  });

  it('a purchase with a formula shows it right under the description, in every state', () => {
    const buyable = {
      id: 'grow',
      name: 'Grow',
      description: 'Grows by a percentage.',
      formula: 'Percentage = Level / 1000',
      cost: num(5),
      effect: { kind: 'interfaceSpeed', amount: 1 },
    } as const;
    const g = game({ buyables: [buyable] });
    expect(tipOf('grow', g)).toBe('Grow\nGrows by a percentage.\nPercentage = Level / 1000\n\nCost = 5 credits');
    set(g, { credits: num(5) });
    g.buy('grow');
    expect(tipOf('grow', g)).toBe('Grow\nGrows by a percentage.\nPercentage = Level / 1000\n\nOwned');
  });

  it('a purchase without a formula has none', () => {
    const g = game({
      buyables: [{ id: 'once', name: 'Once', description: 'Does one thing.', cost: num(5), effect: { kind: 'interfaceSpeed', amount: 1 } }],
    });
    expect(tipOf('once', g)).toBe('Once\nDoes one thing.\n\nCost = 5 credits');
  });

  it('a purchase that is owned says so', () => {
    const g = game({
      buyables: [{ id: 'once', name: 'Once', description: 'Does one thing.', cost: num(5), effect: { kind: 'interfaceSpeed', amount: 1 } }],
    });
    set(g, { credits: num(5) });
    g.buy('once');
    expect(tipOf('once', g)).toBe('Once\nDoes one thing.\n\nOwned');
  });

  it('an auto-run says whether it is on and what a click does', () => {
    const g = game();
    set(g, { credits: num(10) });
    g.buy('auto');
    expect(tipOf('auto', g)).toContain('Auto (on)');
    expect(tipOf('auto', g)).toContain('Click to switch off');
  });
});

describe('the tooltips of the real game follow one standard', () => {
  const real = () => {
    const g = createGame();
    set(g, { credits: num('1e100'), network: num(5000) });
    for (let pass = 0; pass < 12; pass++) for (const b of gameConfig.buyables) if (g.canBuy(b.id)) g.buy(b.id);
    return buildViewModel(g);
  };
  const calculationTips = (vm: ReturnType<typeof real>): string[] =>
    [...vm.sleeve.stats, ...vm.network.stats]
      .flatMap((s) => (s.tip ? [s.tip] : []))
      .concat(vm.actions.filter((a) => a.unlocked).map((a) => a.speedTip));
  const allTips = (vm: ReturnType<typeof real>): string[] => [
    ...calculationTips(vm),
    ...vm.sleeve.buyables.map((b) => b.tip),
    ...vm.actions.flatMap((a) => a.buyables.map((b) => b.tip)),
  ];

  it('every calculation starts with its formula and has a blank line between the formulas and the numbers', () => {
    const tips = calculationTips(real());
    expect(tips.length).toBeGreaterThan(6);
    for (const tip of tips) {
      expect(tip.split('\n')[0], tip).toMatch(/^[A-Z][A-Za-z ]+ = /);
      expect(tip, tip).toContain('\n\n');
    }
  });

  it('every Sleeve attribute has a tooltip', () => {
    const vm = real();
    expect(vm.sleeve.stats.map((s) => s.id)).toEqual([
      'access',
      'interfaceSpeed',
      'hackingProficiency',
      'iceRating',
      'heat',
      'legend',
      'criticalChance',
    ]);
    for (const s of vm.sleeve.stats) expect(s.tip, `${s.id} has no tooltip`).toBeTruthy();
  });

  it('says what things do and never what they do not: no "not", "never" or "no" in any tooltip or purchase description', () => {
    const texts = [...allTips(real()), ...gameConfig.buyables.flatMap((b) => [b.description, b.formula ?? ''])];
    for (const text of texts) expect(text, text).not.toMatch(/\b(not|never|no)\b/i);
  });

  it('Self-replication explains itself with a formula, like the other calculations', () => {
    const vm = real();
    const tip = vm.actions.flatMap((a) => a.buyables).find((b) => b.id === 'self-replication')!.tip;
    expect(tip.split('\n').slice(0, 3)).toEqual([
      'Self-replication',
      'The network grows by a percentage every second.',
      'Growth factor percentage = Action level / 1000',
    ]);
    expect(tip.split('\n')[3]).toBe('');
  });

  it('Self-replication shows the live numbers under its formula: the action level and the growth it gives', () => {
    const g = createGame();
    set(g, { credits: num('1e100') });
    const tipNow = (): string =>
      buildViewModel(g)
        .actions.flatMap((a) => a.buyables)
        .find((b) => b.id === 'self-replication')!.tip;
    // Grow network is level 0 at the start: 0 / 1000 = 0 percent a second.
    expect(tipNow().split('\n')).toEqual([
      'Self-replication',
      'The network grows by a percentage every second.',
      'Growth factor percentage = Action level / 1000',
      '',
      'Action level = 0',
      '',
      'Growth factor percentage = 0%',
      '',
      'Cost = 10B credits',
    ]);
    // At level 12 it is 0.012 percent: the numbers follow the game.
    set(g, { actions: { ...g.getState().actions, 'grow-network': { ...g.getState().actions['grow-network']!, xp: num(1e10) } } });
    const level = g.actionLevel('grow-network');
    expect(level).toBeGreaterThan(0);
    expect(tipNow()).toContain(`Action level = ${level}`);
    expect(tipNow()).toContain(`Growth factor percentage = ${Number((level / 1000).toFixed(4))}%`);
  });

  it('keeps showing the numbers once it is owned', () => {
    const g = createGame();
    set(g, { credits: num('1e100') });
    g.buy('self-replication');
    const tip = buildViewModel(g)
      .actions.flatMap((a) => a.buyables)
      .find((b) => b.id === 'self-replication')!.tip;
    expect(tip).toContain('Action level = 0');
    expect(tip).toContain('Growth factor percentage = 0%');
    expect(tip.endsWith('Owned')).toBe(true);
  });

  it('the labels of the live numbers are the words of the formula in the content', () => {
    const formula = gameConfig.buyables.find((b) => b.id === 'self-replication')!.formula!;
    expect(formula).toContain('Growth factor percentage');
    expect(formula).toContain('Action level');
  });

  it('a purchase without a formula to fill in shows no extra numbers', () => {
    const tip = buildViewModel(createGame())
      .actions.flatMap((a) => a.buyables)
      .find((b) => b.id === 'network-auto-run')!.tip;
    expect(tip.split('\n')).toEqual(['Auto-run', 'Restarts the action automatically when it finishes.', '', 'Cost = 10 credits']);
  });

  it('uses the names of the things the player sees, not internal ones', () => {
    for (const tip of allTips(real())) {
      for (const hidden of ['network factor', 'run multiplier', 'earned from actions', 'practice hacking bonus', 'output multiplier']) {
        expect(tip).not.toContain(hidden);
      }
    }
  });
});

describe('the Action Speed tooltip adds up on its own numbers', () => {
  it('the speed is the product of the three factors shown, and the run time is the base time divided by that speed', () => {
    const g = createGame();
    set(g, { credits: num('1e100'), hackingProficiency: num(0.031) });
    for (let i = 0; i < 2; i++) g.buy('access-upgrade');
    g.buy('interface-boost');
    const tip = buildViewModel(g).actions.find((a) => a.id === 'practice-hacking')!.speedTip;
    const value = (label: string): number => Number(new RegExp(`^${label} = ([0-9.]+)`, 'm').exec(tip)![1]);
    const speed = value('Action Level') * value('Sleeve Level') * value('Interface Speed');
    expect(value('Action Speed')).toBeCloseTo(speed, 4);
    const run = /^Run Time = ([0-9.]+)s \(([0-9.]+)s \/ ([0-9.]+)\)/m.exec(tip)!;
    expect(Number(run[2]) / Number(run[3])).toBeCloseTo(Number(run[1]), 1);
  });
});

describe('Critical success tooltip', () => {
  const withCritical = createConfig(testConfig, {
    buyables: [
      ...testConfig.buyables,
      { id: 'crit', name: 'Crit', description: '', cost: num(1), maxPurchases: Infinity, effect: { kind: 'criticalChance', chance: 0.05 } },
    ],
  });

  it('is hidden until a Critical success is owned, then shows the chance and what a critical run gives', () => {
    const g = createGame({ config: withCritical });
    expect(statRow(buildViewModel(g).sleeve.stats, 'criticalChance').hidden).toBe(true);
    set(g, { credits: num(100) });
    g.buy('crit');
    g.buy('crit');
    const row = statRow(buildViewModel(g).sleeve.stats, 'criticalChance');
    expect(row.hidden).toBe(false);
    expect(row.text).toBe('10%');
    expect(row.tip?.split('\n')).toEqual([
      'Chance per completed run = 10%',
      '',
      'Each critical success gives 2x action XP and pays 3x the reward',
      'Above 100% a run can have several critical successes: 150% is one for sure and a 50% chance of a second',
      'Some actions may have other effects as well',
    ]);
  });
});

describe('Calculation tooltips name every purchase behind a multiplier', () => {
  const real = () => createGame({ config: gameConfig });

  it('ICE Rating: lists the earned value, each multiplying purchase with its copies, and the total', () => {
    const g = real();
    set(g, { iceRating: num(10), purchased: { 'ice-rating-boost': 2 } });
    const tip = statRow(buildViewModel(g).sleeve.stats, 'iceRating').tip ?? '';
    expect(tip).toContain('ICE Rating = Earned x ICE Rating boost (2 copies)');
    expect(tip).toContain('Earned = 10');
    expect(tip).toContain('ICE Rating boost (2 copies) = x4');
    expect(tip).toContain('ICE Rating = 40');
  });

  it('Payout per node: names each boost with its value instead of one aggregated number', () => {
    const g = real();
    set(g, { purchased: { 'node-payout': 3, 'skill-bandwidth': 1 } });
    const tip = statRow(buildViewModel(g).network.stats, 'payout').tip ?? '';
    expect(tip).toContain('(Base + Action Bonus) x Bandwidth Leech x Node payout (3 copies)');
    expect(tip).toContain('Node payout (3 copies) = x8');
    expect(tip).toContain('Bandwidth Leech = x1.1');
    expect(tip).not.toContain('Purchases');
  });

  it('the named factors multiply to the payout multiplier the game really uses', () => {
    const g = real();
    set(g, { purchased: { 'node-payout': 2, 'skill-bandwidth': 1 } });
    const stats = g.sleeveStats();
    const product = stats.nodePayoutTerms.reduce((p, t) => p * t.factor, 1);
    expect(product).toBeCloseTo(stats.nodePayoutMultiplier, 10);
  });
});
