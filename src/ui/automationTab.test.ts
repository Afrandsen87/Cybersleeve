// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { createConfig, type GameConfig } from '../core';
import { num } from '../numbers';
import { setCredits, testConfig } from '../testing/testConfig';
import { mountUi, type SpeedControl } from './dom';
import { buildViewModel } from './viewModel';

const speed: SpeedControl = { enabled: false, factor: 1, toggle: () => false };

const config: GameConfig = createConfig(testConfig, {
  actions: [...testConfig.actions, { id: 'b', name: 'B', baseDurationMs: 10_000, reward: num(0), xpPerRun: num(1) }],
  items: {
    rarities: testConfig.items.rarities,
    definitions: [
      { id: 'file', name: 'File' },
      { id: 'schem', name: 'Schematic', sellable: false },
      { id: 'lead', name: 'Lead', sellable: false, hasRarity: false },
    ],
    augment: { itemId: 'schem', xpBonusPerItem: 0.01 },
    burnLead: { itemId: 'lead', heatFraction: 0.05 },
  },
  buyables: [
    ...testConfig.buyables,
    {
      id: 'core',
      name: 'Core',
      description: '',
      cost: num(1),
      costGrowth: 10,
      maxPurchases: Infinity,
      effect: { kind: 'automationPoints', perCopy: 1 },
    },
  ],
  automation: { autoBurnCeiling: 10 },
});

const mount = (points = 1) => {
  const root = document.createElement('div');
  document.body.append(root);
  const game = createGame({ config });
  setCredits(game, num(1_000_000));
  for (let i = 0; i < points; i++) game.buy('core');
  const render = mountUi(root, game, speed, () => {});
  return { root, game, render };
};

const panel = (root: HTMLElement): HTMLElement => root.querySelector<HTMLElement>('.automation-panel')!;
const tab = (root: HTMLElement, label: RegExp): HTMLButtonElement =>
  [...root.querySelectorAll<HTMLButtonElement>('.tab')].find((t) => label.test(t.textContent ?? ''))!;

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('automation in the view model', () => {
  it('the tab is hidden until the first point is earned, and blinks while a point is waiting', () => {
    const g = createGame({ config });
    expect(buildViewModel(g).tabs.find((t) => t.id === 'automation')!.visible).toBe(false);
    setCredits(g, num(100));
    g.buy('core');
    const t = buildViewModel(g).tabs.find((x) => x.id === 'automation')!;
    expect([t.visible, t.attention, t.label]).toEqual([true, true, 'Automation (1)']);
    g.automation().unlock('autosale');
    const after = buildViewModel(g).tabs.find((x) => x.id === 'automation')!;
    expect([after.visible, after.attention, after.label]).toEqual([true, false, 'Automation']);
  });

  it('lists the three features with their unlock state, and the current settings', () => {
    const g = createGame({ config });
    setCredits(g, num(100));
    g.buy('core');
    g.automation().unlock('dispersal');
    g.automation().setDispersal('b', 40);
    const view = buildViewModel(g).automation;
    expect(view.features.map((f) => [f.id, f.unlocked, f.canUnlock])).toEqual([
      ['autoBurn', false, false],
      ['autosale', false, false],
      ['dispersal', true, false],
    ]);
    expect(view.pointsText).toBe('Automation points: 0');
    expect(view.autoBurn.ceiling).toBe(10);
    expect(view.rarities.map((r) => r.id)).toEqual(['common', 'rare']);
    expect(view.actions.find((a) => a.id === 'b')!.percent).toBe(40);
  });

  it('the tab bar shows as soon as there is an automation point, even before any skill point', () => {
    const g = createGame({ config });
    setCredits(g, num(100));
    g.buy('core');
    expect(buildViewModel(g).tabs.map((t) => t.visible)).toEqual([true, false, true]);
  });
});

describe('the Automation tab on the screen', () => {
  it('opens from its tab and shows the points and the three features, locked', () => {
    const { root } = mount(2);
    tab(root, /Automation/).click();
    expect(panel(root).hidden).toBe(false);
    expect(panel(root).querySelector('.skills-points')!.textContent).toBe('Automation points: 2');
    const boxes = [...panel(root).querySelectorAll<HTMLElement>('.automation-feature')];
    expect(boxes).toHaveLength(3);
    for (const box of boxes) {
      expect(box.querySelector<HTMLElement>('.automation-unlock')!.hidden).toBe(false);
      expect(box.querySelector<HTMLElement>('.automation-controls')!.hidden).toBe(true);
    }
  });

  it('unlocking spends a point and reveals the controls; with no point left the other unlocks are disabled', () => {
    const { root, game } = mount(1);
    tab(root, /Automation/).click();
    const unlocks = [...panel(root).querySelectorAll<HTMLButtonElement>('.automation-unlock')];
    unlocks[0]!.click();
    expect(game.automation().isUnlocked('autoBurn')).toBe(true);
    expect(panel(root).querySelector<HTMLElement>('.automation-autoBurn .automation-controls')!.hidden).toBe(false);
    expect(panel(root).querySelector<HTMLElement>('.automation-autoBurn .automation-unlock')!.hidden).toBe(true);
    expect(unlocks[1]!.disabled).toBe(true);
    expect(panel(root).querySelector('.skills-points')!.textContent).toBe('Automation points: 0');
  });

  it('the Auto Burn switch and ceiling change the setting', () => {
    const { root, game } = mount(1);
    game.automation().unlock('autoBurn');
    tab(root, /Automation/).click();
    const sw = panel(root).querySelector<HTMLButtonElement>('.automation-autoBurn .automation-switch')!;
    expect(sw.textContent).toBe('Auto Burn: off');
    sw.click();
    expect(game.automation().isAutoBurnOn()).toBe(true);
    expect(sw.textContent).toBe('Auto Burn: on');
    expect(sw.classList.contains('on')).toBe(true);
    const input = panel(root).querySelector<HTMLInputElement>('.automation-autoBurn input')!;
    expect(input.value).toBe('10');
    input.value = '35';
    input.dispatchEvent(new Event('change'));
    expect(game.automation().autoBurnCeiling()).toBe(35);
  });

  it('autosale has a switch per rarity, and dispersal a share per action', () => {
    const { root, game } = mount(2);
    game.automation().unlock('autosale');
    game.automation().unlock('dispersal');
    tab(root, /Automation/).click();
    const rarities = [...panel(root).querySelectorAll<HTMLButtonElement>('.automation-autosale .automation-switch')];
    expect(rarities.map((b) => b.textContent)).toEqual(['Common', 'Rare']);
    rarities[1]!.click();
    expect(game.automation().isAutosaleOn('rare')).toBe(true);
    expect(game.automation().isAutosaleOn('common')).toBe(false);
    expect(rarities[1]!.classList.contains('on')).toBe(true);
    rarities[1]!.click();
    expect(game.automation().isAutosaleOn('rare')).toBe(false);

    const shares = [...panel(root).querySelectorAll<HTMLInputElement>('.automation-dispersal input')];
    expect(shares).toHaveLength(2);
    shares[1]!.value = '60';
    shares[1]!.dispatchEvent(new Event('change'));
    expect(game.automation().dispersal('b')).toBe(60);
  });

  it('does not overwrite what the player is typing while the screen redraws', () => {
    const { root, game, render } = mount(1);
    game.automation().unlock('autoBurn');
    tab(root, /Automation/).click();
    const input = panel(root).querySelector<HTMLInputElement>('.automation-autoBurn input')!;
    input.focus();
    input.value = '7';
    render();
    expect(input.value).toBe('7');
  });
});
