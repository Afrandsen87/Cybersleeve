// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { type BuyableDefinition, createConfig } from '../core';
import { num } from '../numbers';
import { testConfig } from '../testing/testConfig';
import { mountUi, type SpeedControl } from './dom';
import { buildViewModel, statRow } from './viewModel';
import { skillViews } from '../testing/skillViews';

const speed: SpeedControl = { enabled: false, factor: 1, toggle: () => false };

const skill = (id: string, effect: BuyableDefinition['effect'], symbol = id.toUpperCase()): BuyableDefinition => ({
  id,
  name: `Skill ${id}`,
  description: 'Does something.',
  symbol,
  currency: 'skillPoints',
  cost: num(1),
  effect,
});
const skills = [
  skill('s1', { kind: 'interfaceSpeedMultiplier', factor: 1.05 }),
  skill('s2', { kind: 'heatCooldownSpeed', factor: 1.05 }),
  skill('bc', { kind: 'backChannel', itemId: 'file', rarityId: 'common', molesPerItem: 5, cooldownBoost: 0.5 }),
];
/** An action that does nothing: its level 1 is how a test earns the first skill point without touching the other actions. */
const inert = { id: 'z', name: 'Z', baseDurationMs: 1_000, reward: num(0), xpPerRun: num(1) };
const config = createConfig(testConfig, { actions: [...testConfig.actions, inert], buyables: [...testConfig.buyables, ...skills] });

type Loose = { inventory: unknown; moles: number; heat: number; actions: Record<string, { xp: unknown }> };
const loose = (g: { getState(): unknown }): Loose => g.getState() as unknown as Loose;

/** A game in which the first skill point has been earned (the inert action reached level 1). */
const pointGame = (): ReturnType<typeof createGame> => {
  const g = createGame({ config });
  loose(g).actions['z']!.xp = num(10);
  return g;
};

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('skills in the view model', () => {
  it('a new game has no skill point, and the first one comes with the first action level', () => {
    const g = createGame({ config });
    expect(buildViewModel(g).tabs[1]!.label).toBe('Skills');
    expect(buildViewModel(g).skills.points).toBe(0);
    loose(g).actions['z']!.xp = num(10);
    expect(buildViewModel(g).tabs[1]!.label).toBe('Skills (1)');
  });

  it('has the two tabs, Character and Skills, and shows the points next to Skills unless there are none', () => {
    const g = pointGame();
    expect(buildViewModel(g).tabs).toEqual([
      { id: 'character', label: 'Character', visible: true, attention: false },
      { id: 'skills', label: 'Skills (1)', visible: true, attention: true },
      { id: 'automation', label: 'Automation', visible: false, attention: false },
      { id: 'stats', label: 'Stats', visible: false, attention: false },
      { id: 'corporation', label: 'Corporation', visible: false, attention: false },
    ]);
    g.buy('s1');
    expect(buildViewModel(g).tabs[1]!.label).toBe('Skills');
  });

  it('no tab shows until the first skill point is earned, and the Skills tab blinks only while a point is waiting', () => {
    const g = createGame({ config });
    expect(buildViewModel(g).tabs.map((t) => t.visible)).toEqual([false, false, false, false, false]);
    loose(g).actions['z']!.xp = num(10);
    expect(buildViewModel(g).tabs.map((t) => [t.visible, t.attention])).toEqual([
      [true, false],
      [true, true],
      [false, false],
      [false, false],
      [false, false],
    ]);
    g.buy('s1'); // the point is spent: the tabs stay, the blinking stops
    expect(buildViewModel(g).tabs.map((t) => [t.visible, t.attention])).toEqual([
      [true, false],
      [true, false],
      [false, false],
      [false, false],
      [false, false],
    ]);
  });

  it('lists the skills, and keeps them out of the Sleeve purchases', () => {
    const vm = buildViewModel(pointGame());
    expect(skillViews(vm.skills.lanes).map((b) => b.id)).toEqual(['s1', 's2', 'bc']);
    expect(vm.skills.points).toBe(1);
    expect(vm.skills.pointsText).toBe('Skill points: 1');
    expect(vm.sleeve.buyables.map((b) => b.id)).not.toContain('s1');
    expect(vm.sleeve.sections.flatMap((s) => s.buyables.map((b) => b.id))).not.toContain('s1');
  });

  it('a skill tip names the skill, what it does and the cost in skill points', () => {
    const tip = skillViews(buildViewModel(createGame({ config })).skills.lanes)[0]!.tip;
    expect(tip).toBe('Skill s1\nDoes something.\n\nCost = 1 skill points');
  });

  it('a skill that cannot be paid is not clickable', () => {
    const g = pointGame();
    g.buy('s1');
    const views = skillViews(buildViewModel(g).skills.lanes);
    expect(views.find((b) => b.id === 's1')!.owned).toBe(1);
    expect(views.find((b) => b.id === 's2')!.clickable).toBe(false);
  });
});

describe('Moles and the back channel in the view model', () => {
  it('the Moles row is hidden until the Back Channel Deals skill is owned (or Moles are held)', () => {
    const g = pointGame();
    expect(statRow(buildViewModel(g).network.stats, 'moles').hidden).toBe(true);
    g.buy('bc');
    const row = statRow(buildViewModel(g).network.stats, 'moles');
    expect(row.hidden).toBe(false);
    expect(row.text).toBe('0');
    loose(g).moles = 12;
    expect(statRow(buildViewModel(g).network.stats, 'moles').text).toBe('12');
    expect(statRow(buildViewModel(g).network.stats, 'moles').tip).toContain('Moles = 12');
  });

  it('the back channel button is offered on the common stack only, once the skill is owned', () => {
    const g = pointGame();
    loose(g).inventory = { file: { common: 2, rare: 1 } };
    expect(buildViewModel(g).inventory.rows.some((r) => r.backChannel)).toBe(false);
    g.buy('bc');
    const rows = buildViewModel(g).inventory.rows;
    expect(rows.map((r) => [r.rarityId, r.backChannel])).toEqual([
      ['common', true],
      ['rare', false],
    ]);
    expect(rows[0]!.backChannelTip).toContain('Give up one for 5 Moles');
    expect(rows[0]!.backChannelTip).toContain('50% faster');
    expect(rows[1]!.backChannelTip).toBe('');
  });

  it('the heat tip mentions the Moles while there are some', () => {
    const g = pointGame();
    g.buy('bc');
    expect(statRow(buildViewModel(g).sleeve.stats, 'heat').tip).not.toContain('Moles make it');
    loose(g).moles = 7;
    expect(statRow(buildViewModel(g).sleeve.stats, 'heat').tip).toContain('7 Moles make it 50% faster');
  });

  it('the interface speed tip lists the skill factor once a skill gives one', () => {
    const g = pointGame();
    expect(statRow(buildViewModel(g).sleeve.stats, 'interfaceSpeed').tip).not.toContain('Skills');
    g.buy('s1');
    const tip = statRow(buildViewModel(g).sleeve.stats, 'interfaceSpeed').tip!;
    expect(tip).toContain('x Skills');
    expect(tip).toContain('Skills = 1.05');
  });
});

describe('the screen', () => {
  const mount = () => {
    const root = document.createElement('div');
    document.body.append(root);
    const game = pointGame();
    const render = mountUi(root, game, speed, () => {});
    return { root, game, render };
  };
  const panel = (root: HTMLElement, cls: string) => root.querySelector<HTMLElement>(`.${cls}`)!;

  it('has the two tabs on the credits line, and the Skills tab blinks while a point waits', () => {
    const { root } = mount();
    const tabs = root.querySelector<HTMLElement>('.tabs')!;
    expect([...tabs.querySelectorAll('.tab')].map((t) => t.textContent)).toEqual([
      'Character',
      'Skills (1)',
      'Automation',
      'Stats',
      'Corporation',
    ]);
    expect(tabs.querySelectorAll<HTMLElement>('.tab[hidden]')).toHaveLength(3); // Automation waits for its first point, Stats for the first re-sleeve, Corporation for its unlock
    expect(tabs.parentElement).toBe(root.querySelector('header')); // the same line as the credits
    expect(tabs.previousElementSibling).toBe(root.querySelector('.credits'));
    expect(tabs.hidden).toBe(false);
    expect(root.querySelector('.tab.attention')!.textContent).toBe('Skills (1)');
  });

  it('hides the tab bar until the first skill point is earned, then shows it', () => {
    const root = document.createElement('div');
    document.body.append(root);
    const game = createGame({ config });
    const render = mountUi(root, game, speed, () => {});
    expect(root.querySelector<HTMLElement>('.tabs')!.hidden).toBe(true);
    loose(game).actions['z']!.xp = num(10);
    render();
    expect(root.querySelector<HTMLElement>('.tabs')!.hidden).toBe(false);
  });

  it('starts on Character, which holds everything so far; the Skills tab holds only the skills box', () => {
    const { root } = mount();
    expect(panel(root, 'character-panel').hidden).toBe(false);
    expect(panel(root, 'skills-panel').hidden).toBe(true);
    expect(panel(root, 'character-panel').querySelector('.layout')).not.toBeNull();
    expect(panel(root, 'character-panel').querySelector('.resleeve')).not.toBeNull();
    expect(panel(root, 'skills-panel').querySelector('.skills-widget')).not.toBeNull();
    expect(panel(root, 'skills-panel').querySelector('.layout')).toBeNull();
  });

  it('clicking a tab switches the panel and marks the tab active', () => {
    const { root } = mount();
    const [character, skillsTab] = [...root.querySelectorAll<HTMLButtonElement>('.tab')];
    skillsTab!.click();
    expect(panel(root, 'character-panel').hidden).toBe(true);
    expect(panel(root, 'skills-panel').hidden).toBe(false);
    expect(skillsTab!.classList.contains('active')).toBe(true);
    expect(character!.classList.contains('active')).toBe(false);
    character!.click();
    expect(panel(root, 'character-panel').hidden).toBe(false);
  });

  it('the credits stay visible on both tabs', () => {
    const { root } = mount();
    expect(root.querySelector('.credits')!.parentElement).toBe(root.querySelector('header')!);
    expect(root.querySelector('header')!.closest('.tab-panel')).toBeNull();
  });

  it('shows a button for every skill with the points, and buying one updates the tab and the points', () => {
    const { root, game, render } = mount();
    const buttons = [...root.querySelectorAll<HTMLButtonElement>('.skills-widget .upgrade')];
    expect(buttons.map((b) => b.textContent)).toEqual(['S1', 'S2', 'BC']);
    expect(root.querySelector('.skills-points')!.textContent).toBe('Skill points: 1');
    buttons[0]!.click();
    expect(game.ownedCount('s1')).toBe(1);
    render(); // the game loop redraws the screen a moment after a click
    expect(root.querySelector('.skills-points')!.textContent).toBe('Skill points: 0');
    expect([...root.querySelectorAll('.tab')][1]!.textContent).toBe('Skills');
    expect(buttons[1]!.disabled).toBe(true);
    expect(buttons[0]!.classList.contains('owned')).toBe(true);
  });

  it('the Moles row is hidden at first and appears with the skill', () => {
    const { root, game, render } = mount();
    const row = () => [...root.querySelectorAll<HTMLElement>('.stat')].find((r) => r.textContent?.startsWith('Moles'))!;
    expect(row().hidden).toBe(true);
    game.buy('bc');
    render();
    expect(row().hidden).toBe(false);
  });

  it('the Back channel button gives up one common file for Moles, once its stack is selected', () => {
    const { root, game, render } = mount();
    loose(game).inventory = { file: { common: 3 } };
    game.buy('bc');
    render();
    const button = [...root.querySelectorAll<HTMLButtonElement>('.inventory-action')].find((b) => b.textContent === 'Back channel')!;
    expect(button.hidden).toBe(false);
    expect(button.disabled).toBe(true); // nothing is selected yet
    root.querySelector<HTMLButtonElement>('.item-tile')!.click();
    expect(button.disabled).toBe(false);
    button.click();
    expect(game.getState().inventory['file']!['common']).toBe(2);
    expect(game.getState().moles).toBe(5);
    const moles = [...root.querySelectorAll<HTMLElement>('.stat')].find((r) => r.textContent?.startsWith('Moles'))!;
    expect(moles.textContent).toBe('Moles5');
  });

  it('the Back channel button is hidden before the skill, and disabled while a stack that cannot be given up is selected', () => {
    const { root, game, render } = mount();
    loose(game).inventory = { file: { common: 3, rare: 1 } };
    render();
    const button = () => [...root.querySelectorAll<HTMLButtonElement>('.inventory-action')].find((b) => b.textContent === 'Back channel')!;
    expect(button().hidden).toBe(true);
    game.buy('bc');
    render();
    expect(button().hidden).toBe(false);
    const tiles = root.querySelectorAll<HTMLButtonElement>('.item-tile');
    tiles[1]!.click(); // the rare stack
    expect(button().disabled).toBe(true);
    tiles[0]!.click(); // the common stack
    expect(button().disabled).toBe(false);
  });
});
