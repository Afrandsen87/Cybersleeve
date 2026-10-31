// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { num } from '../numbers';
import { mountTestUi } from '../testing/domMountKit';
import { config, loose, pointGame } from '../testing/skillsTabKit';
import { skillViews } from '../testing/skillViews';
import { buildViewModel } from './viewModel';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('skills in the view model', () => {
  it('a new game has no skill point, and the first one comes with the first action level', () => {
    const g = createGame({ config });
    expect(buildViewModel(g).tabs[1]!.label).toBe('Firmware');
    expect(buildViewModel(g).skills.points).toBe(0);
    loose(g).actions['z']!.xp = num(10);
    expect([buildViewModel(g).tabs[1]!.label, buildViewModel(g).tabs[1]!.count]).toEqual(['Firmware', 1]);
  });

  it('has the two tabs, Character and Skills, and shows the points next to Skills unless there are none', () => {
    const g = pointGame();
    expect(buildViewModel(g).tabs).toEqual([
      { id: 'character', label: 'Character', count: null, visible: true, attention: false },
      { id: 'skills', label: 'Firmware', count: 1, visible: true, attention: true },
      { id: 'automation', label: 'Automation', count: null, visible: false, attention: false },
      { id: 'stats', label: 'Stats', count: null, visible: false, attention: false },
      { id: 'corporation', label: 'Corporation', count: null, visible: false, attention: false },
    ]);
    g.buy('s1');
    expect(buildViewModel(g).tabs[1]!.label).toBe('Firmware');
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
    expect(vm.skills.pointsText).toBe('Firmware points: 1');
    expect(vm.sleeve.buyables.map((b) => b.id)).not.toContain('s1');
    expect(vm.sleeve.sections.flatMap((s) => s.buyables.map((b) => b.id))).not.toContain('s1');
  });

  it('a skill tip names the skill, what it does and the cost in skill points', () => {
    const tip = skillViews(buildViewModel(createGame({ config })).skills.lanes)[0]!.tip;
    expect(tip).toBe('Skill s1\nDoes something.\n\nCost = 1 firmware points');
  });

  it('a skill that cannot be paid is not clickable', () => {
    const g = pointGame();
    g.buy('s1');
    const views = skillViews(buildViewModel(g).skills.lanes);
    expect(views.find((b) => b.id === 's1')!.owned).toBe(1);
    expect(views.find((b) => b.id === 's2')!.clickable).toBe(false);
  });
});

describe('the screen', () => {
  const mount = () => {
    const root = document.createElement('div');
    document.body.append(root);
    const game = pointGame();
    const render = mountTestUi(root, game);
    return { root, game, render };
  };
  const panel = (root: HTMLElement, cls: string) => root.querySelector<HTMLElement>(`.${cls}`)!;

  it('has the two tabs on the credits line, and the Skills tab blinks while a point waits', () => {
    const { root } = mount();
    const tabs = root.querySelector<HTMLElement>('.tabs')!;
    expect([...tabs.querySelectorAll('.tab')].map((t) => t.querySelector('.tab-label')!.textContent)).toEqual([
      'Character',
      'Firmware',
      'Automation',
      'Stats',
      'Corporation',
    ]);
    expect(tabs.querySelectorAll<HTMLElement>('.tab[hidden]')).toHaveLength(3); // Automation waits for its first point, Stats for the first re-sleeve, Corporation for its unlock
    expect(tabs.parentElement).toBe(root.querySelector('header')); // the same line as the credits
    expect(root.querySelector('header .credits')).not.toBeNull(); // the balance is in the same bar
    expect(tabs.hidden).toBe(false);
    expect(root.querySelector('.tab.attention .tab-label')!.textContent).toBe('Firmware');
  });

  it('hides the tab bar until the first skill point is earned, then shows it', () => {
    const root = document.createElement('div');
    document.body.append(root);
    const game = createGame({ config });
    const render = mountTestUi(root, game);
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
    expect(root.querySelector('.credits')!.closest('header')).toBe(root.querySelector('header')!);
    expect(root.querySelector('header')!.closest('.tab-panel')).toBeNull();
  });

  it('shows a button for every skill with the points, and buying one updates the tab and the points', () => {
    const { root, game, render } = mount();
    const buttons = [...root.querySelectorAll<HTMLButtonElement>('.skills-widget .upgrade')];
    expect(buttons.map((b) => b.textContent)).toEqual(['S1', 'S2', 'BC']);
    expect(root.querySelector('.skills-points')!.textContent).toBe('Firmware points: 1');
    buttons[0]!.click();
    expect(game.ownedCount('s1')).toBe(1);
    render(); // the game loop redraws the screen a moment after a click
    expect(root.querySelector('.skills-points')!.textContent).toBe('Firmware points: 0');
    expect([...root.querySelectorAll('.tab-label')][1]!.textContent).toBe('Firmware');
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
    expect(game.getState().wallet.inventory['file']!['common']).toBe(2);
    expect(game.getState().sleeve.moles).toBe(5);
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
