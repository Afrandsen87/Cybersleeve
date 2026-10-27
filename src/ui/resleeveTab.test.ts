// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { type BuyableDefinition, createConfig } from '../core';
import { num } from '../numbers';
import { networkAction, testConfig } from '../testing/testConfig';
import { mountUi, type SpeedControl } from './dom';
import { buildViewModel, statRow } from './viewModel';

const speed: SpeedControl = { enabled: false, factor: 1, toggle: () => false };

const resleeveSkill = (id: string, effect: BuyableDefinition['effect'], requires?: string[]): BuyableDefinition => ({
  id,
  name: `Skill ${id}`,
  description: id === 'inc' ? 'Does nothing for now.' : 'Does something.',
  symbol: id.toUpperCase(),
  currency: 'resleevePoints',
  cost: num(1),
  effect,
  ...(requires ? { requires } : {}),
});
const tree = [
  resleeveSkill('eu', { kind: 'actionXpReductionFromSleeveLevel', remainingPerOrder: 0.5, maxReduction: 0.999 }),
  resleeveSkill('syn', { kind: 'synthSleeves' }, ['eu']),
  resleeveSkill('inc', { kind: 'placeholder' }, ['eu']),
];
const config = createConfig(testConfig, { actions: [testConfig.actions[0]!, networkAction], buyables: [...testConfig.buyables, ...tree] });

type Loose = { network: unknown; actions: Record<string, { xp: unknown }> };
const loose = (g: { getState(): unknown }): Loose => g.getState() as unknown as Loose;

/** A game that has re-sleeved `times` times (each gives a re-sleeve point). */
const resleeved = (times: number, c = config): ReturnType<typeof createGame> => {
  const g = createGame({ config: c });
  for (let i = 0; i < times; i++) g.resleeve();
  return g;
};

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('the Network entry for synthetic sleeves', () => {
  it('is hidden until the skill is bought, and then has exactly two lines: how many, and what they earn together', () => {
    const g = resleeved(2);
    const hidden = () => buildViewModel(g).network.stats.filter((s) => s.id === 'synths' || s.id === 'synthIncome');
    expect(hidden().map((s) => [s.id, s.hidden])).toEqual([
      ['synths', true],
      ['synthIncome', true],
    ]);
    g.buy('eu');
    g.buy('syn');
    const rows = hidden();
    expect(rows.map((s) => [s.id, s.hidden])).toEqual([
      ['synths', false],
      ['synthIncome', false],
    ]);
    expect(rows.map((s) => s.label)).toEqual(['Synthetic sleeves', 'Synthetic credits per second']);
    expect(rows[0]!.text).toBe('1');
  });

  it('shows the number of sleeves and their summed income', () => {
    const g = resleeved(1);
    g.buy('eu');
    g.resleeve();
    g.buy('syn');
    const state = g.getState() as unknown as {
      runs: { creditsPerSecond: unknown; actionLevelsTotal: number }[];
      synths: { runIndex: number }[];
    };
    state.runs.push({ creditsPerSecond: num(40), actionLevelsTotal: 0 }, { creditsPerSecond: num(2), actionLevelsTotal: 0 });
    state.synths.push({ runIndex: 2 }, { runIndex: 3 });
    const stats = buildViewModel(g).network.stats;
    expect(statRow(stats, 'synths').text).toBe('3');
    expect(statRow(stats, 'synthIncome').text).toBe('+42'); // the first sleeve copies an empty run
    expect(statRow(stats, 'synths').tip).toContain('Synthetic Sleeves = 3');
    expect(statRow(stats, 'synths').tip).toContain('Credits per Second = 42');
  });
});

describe('the re-sleeve skills in the view model', () => {
  it('are hidden until the first re-sleeve, and then listed in rows by depth: the root first, then what needs it', () => {
    expect(buildViewModel(createGame({ config })).skills.resleeve.visible).toBe(false);
    const vm = buildViewModel(resleeved(1)).skills.resleeve;
    expect(vm.visible).toBe(true);
    expect(vm.tiers.map((row) => row.map((b) => b.id))).toEqual([['eu'], ['syn', 'inc']]);
  });

  it('show the re-sleeve points, keep the skills out of the Sleeve purchases, and add the points to the Skills tab label', () => {
    const g = resleeved(2);
    const vm = buildViewModel(g);
    expect(vm.skills.resleeve.points).toBe(2);
    expect(vm.skills.resleeve.pointsText).toBe('Re-sleeve points: 2');
    expect(vm.sleeve.buyables.map((b) => b.id)).not.toContain('eu');
    expect(vm.skills.buyables.map((b) => b.id)).not.toContain('eu');
    expect(vm.tabs[1]!.label).toBe('Skills (2)');
  });

  it('mark what cannot be bought yet as unavailable, and what is bought as owned', () => {
    const g = resleeved(1);
    const find = (id: string) =>
      buildViewModel(g)
        .skills.resleeve.tiers.flat()
        .find((b) => b.id === id)!;
    expect(find('syn').available).toBe(false);
    expect(find('eu').clickable).toBe(true);
    g.buy('eu');
    expect(find('eu').owned).toBe(1);
    expect(find('syn').available).toBe(true);
  });

  it('costs are in re-sleeve points', () => {
    const view = buildViewModel(resleeved(1))
      .skills.resleeve.tiers.flat()
      .find((b) => b.id === 'eu')!;
    expect(view.costUnit).toBe('re-sleeve points');
    expect(view.tip).toContain('Cost = 1 re-sleeve points');
  });
});

describe('the Stats tab in the view model', () => {
  it('lists nothing before the first re-sleeve', () => {
    expect(buildViewModel(createGame({ config })).runs.rows).toEqual([]);
  });

  it('lists the finished runs, newest first, with their income and level total', () => {
    const g = createGame({ config });
    loose(g).network = num(1000);
    loose(g).actions['a']!.xp = num(110); // level 2
    g.resleeve();
    g.resleeve();
    const rows = buildViewModel(g).runs.rows;
    expect(rows.map((r) => r.label)).toEqual(['Run 2', 'Run 1']);
    expect(rows[1]).toEqual({ label: 'Run 1', incomeText: '+50', levelsText: '2' });
    expect(rows[0]!.incomeText).toBe('+0');
    expect(rows[0]!.levelsText).toBe('0');
  });

  it('lists only the latest ten, numbered by their place in the whole history', () => {
    const g = resleeved(13);
    const rows = buildViewModel(g).runs.rows;
    expect(rows).toHaveLength(10);
    expect(rows[0]!.label).toBe('Run 13');
    expect(rows[9]!.label).toBe('Run 4');
  });

  it('follows the number of runs shown in the settings', () => {
    const three = createConfig(config, { resleeve: { runsShown: 3 } });
    expect(buildViewModel(resleeved(6, three)).runs.rows.map((r) => r.label)).toEqual(['Run 6', 'Run 5', 'Run 4']);
  });
});

describe('the screen', () => {
  const mount = (game = resleeved(1)) => {
    const root = document.createElement('div');
    document.body.append(root);
    const render = mountUi(root, game, speed, () => {});
    return { root, game, render };
  };
  const click = (root: HTMLElement, label: string) =>
    [...root.querySelectorAll<HTMLButtonElement>('.tab')].find((t) => t.textContent?.startsWith(label))!.click();

  it('has five tabs: Character, Skills, Automation, Stats and Corporation', () => {
    const { root } = mount();
    expect([...root.querySelectorAll('.tab')].map((t) => t.textContent)).toEqual([
      'Character',
      'Skills (1)',
      'Automation',
      'Stats',
      'Corporation',
    ]);
  });

  it('shows the re-sleeve skills as a tree of rows, a locked skill dimmed, and lets the player buy from the top', () => {
    const { root, game, render } = mount();
    click(root, 'Skills');
    const widget = root.querySelector<HTMLElement>('.resleeve-skills')!;
    expect(widget.hidden).toBe(false);
    expect(widget.querySelector('.skills-points')!.textContent).toBe('Re-sleeve points: 1');
    const tiers = [...widget.querySelectorAll('.skill-tier')].map((row) => [...row.querySelectorAll('button')].map((b) => b.textContent));
    expect(tiers).toEqual([['EU'], ['SYN', 'INC']]);
    const button = (symbol: string) => [...widget.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === symbol)!;
    expect(button('SYN').classList.contains('locked')).toBe(true);
    expect(button('SYN').hidden).toBe(false);
    button('EU').click();
    render();
    expect(game.ownedCount('eu')).toBe(1);
    expect(button('SYN').classList.contains('locked')).toBe(false);
    expect(widget.querySelector('.skills-points')!.textContent).toBe('Re-sleeve points: 0');
  });

  it('hides the re-sleeve group before the first re-sleeve', () => {
    const { root } = mount(createGame({ config }));
    expect(root.querySelector<HTMLElement>('.resleeve-skills')!.hidden).toBe(true);
  });

  it('shows the Network entry when the skill is bought', () => {
    const { root, game, render } = mount(resleeved(2));
    const rowOf = (label: string) =>
      [...root.querySelectorAll<HTMLElement>('.network-widget .stat')].find((r) => r.textContent?.startsWith(label))!;
    expect(rowOf('Synthetic sleeves').hidden).toBe(true);
    game.buy('eu');
    game.buy('syn');
    render();
    expect(rowOf('Synthetic sleeves').hidden).toBe(false);
    expect(rowOf('Synthetic credits per second').hidden).toBe(false);
  });

  it('opens the Stats tab with the latest runs, and says so when there are none', () => {
    const empty = mount(createGame({ config }));
    click(empty.root, 'Stats');
    const panelOf = (root: HTMLElement) => root.querySelector<HTMLElement>('.stats-panel')!;
    expect(panelOf(empty.root).hidden).toBe(false);
    expect(panelOf(empty.root).querySelector<HTMLElement>('.runs-empty')!.hidden).toBe(false);

    const { root, game, render } = mount(resleeved(2));
    click(root, 'Stats');
    expect([...panelOf(root).querySelectorAll('.run-row:not(.run-head)')].map((r) => r.firstElementChild!.textContent)).toEqual([
      'Run 2',
      'Run 1',
    ]);
    expect(panelOf(root).querySelector<HTMLElement>('.runs-empty')!.hidden).toBe(true);
    game.resleeve();
    render();
    expect(panelOf(root).querySelectorAll('.run-row:not(.run-head)')).toHaveLength(3);
  });

  it('the Character, Skills and Stats panels are shown one at a time', () => {
    const { root } = mount();
    const shown = () => ['character-panel', 'skills-panel', 'stats-panel'].map((c) => !root.querySelector<HTMLElement>(`.${c}`)!.hidden);
    expect(shown()).toEqual([true, false, false]);
    click(root, 'Skills');
    expect(shown()).toEqual([false, true, false]);
    click(root, 'Stats');
    expect(shown()).toEqual([false, false, true]);
  });
});
