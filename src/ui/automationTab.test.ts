// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { createConfig, type GameConfig } from '../core';
import { num } from '../numbers';
import { automationLaneBuyables, laneSkillId } from '../testing/automationKit';
import { setCredits, testConfig } from '../testing/testConfig';
import { buildViewModel } from './viewModel';
import { mountTestUi } from '../testing/domMountKit';

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
    ...automationLaneBuyables(),
  ],
  automation: { autoBurnCeiling: 10, autoBurnUpper: 50 },
});

const mount = (points = 1) => {
  const root = document.createElement('div');
  document.body.append(root);
  const game = createGame({ config });
  setCredits(game, num(1_000_000));
  for (let i = 0; i < points; i++) game.buy('core');
  const render = mountTestUi(root, game);
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
    expect([t.visible, t.attention, t.label, t.count]).toEqual([true, true, 'Automation', 1]);
    g.automation().unlock('autosale');
    const after = buildViewModel(g).tabs.find((x) => x.id === 'automation')!;
    expect([after.visible, after.attention, after.label, after.count]).toEqual([true, false, 'Automation', null]);
  });

  it('lists the three features with their unlock state, and the current settings', () => {
    const g = createGame({ config });
    setCredits(g, num(100));
    g.buy('core');
    g.automation().unlock('dispersal');
    g.automation().setDispersalTarget('b', true);
    const view = buildViewModel(g).automation;
    expect(view.features.map((f) => [f.id, f.unlocked])).toEqual([
      ['autoBurn', false],
      ['autosale', false],
      ['dispersal', true],
    ]);
    expect(view.pointsText).toBe('Automation points: 0');
    expect(view.autoBurn.strip).toMatchObject({ visible: false, floor: { value: 10 }, redline: { value: 50 } });
    expect(view.autoBurn.rows.some((row) => row.visible)).toBe(false); // nothing is shown before its skill is owned
    expect(view.rarities.map((r) => r.id)).toEqual(['common', 'rare']);
    expect(view.actions.find((a) => a.id === 'b')!.selected).toBe(true);
    expect(view.dispersalCount).toBe('Actions selected: 1 / 1');
  });

  it('the tab bar shows as soon as there is an automation point, even before any skill point', () => {
    const g = createGame({ config });
    setCredits(g, num(100));
    g.buy('core');
    expect(buildViewModel(g).tabs.map((t) => t.visible)).toEqual([true, false, true, false, false]); // Stats waits for the first re-sleeve, Corporation for its unlock
  });

  it('only lists actions whose access level is unlocked, after the dispersal skill is owned', () => {
    const g = createGame({
      config: createConfig(config, {
        actions: [
          ...config.actions,
          { id: 'locked', name: 'Locked', requiredAccessLevel: 2, baseDurationMs: 1000, reward: num(0), xpPerRun: num(1) },
        ],
      }),
    });
    expect(buildViewModel(g).automation.actions.every((a) => !a.visible)).toBe(true);
    setCredits(g, num(100));
    g.buy('core');
    g.automation().unlock('dispersal');
    const actions = buildViewModel(g).automation.actions;
    expect(actions.filter((a) => a.visible).map((a) => a.id)).toEqual(['a', 'b']);
    expect(actions.find((a) => a.id === 'locked')!.visible).toBe(false);
  });
});

describe('the Automation tab on the screen', () => {
  it('opens from its tab and shows the points and the three features, locked', () => {
    const { root } = mount(2);
    tab(root, /Automation/).click();
    expect(panel(root).hidden).toBe(false);
    expect(panel(root).querySelector('.skills-points')!.textContent).toBe('2AUTOMATION POINTS');
    const boxes = [...panel(root).querySelectorAll<HTMLElement>('.automation-feature')];
    expect(boxes).toHaveLength(3);
    for (const box of boxes) {
      expect(box.querySelector<HTMLElement>('.automation-controls')!.hidden).toBe(true);
      expect(box.classList.contains('panel')).toBe(true);
      expect(box.querySelector('.ph')!.textContent).toContain('OFFLINE');
      expect(box.querySelector('.lane-header')).not.toBeNull();
    }
  });

  it('buying the first skill of a lane spends a point and reveals the controls; with no point left the other lanes cannot be started', () => {
    const { root, game, render } = mount(1);
    tab(root, /Automation/).click();
    const first = (feature: string) => panel(root).querySelector<HTMLButtonElement>(`.automation-${feature} .skill-node`)!;
    first('autoBurn').click();
    panel(root).querySelector<HTMLButtonElement>('.automation-slot .firmware-install')!.click();
    render();
    expect(game.automation().isUnlocked('autoBurn')).toBe(true);
    expect(panel(root).querySelector('.automation-autoBurn .ph')!.textContent).toContain('ONLINE');
    expect(panel(root).querySelector<HTMLElement>('.automation-autoBurn .automation-controls')!.hidden).toBe(false);
    first('autosale').click();
    expect(game.automation().isUnlocked('autosale')).toBe(false);
    expect(panel(root).querySelector('.skills-points')!.textContent).toBe('0AUTOMATION POINTS');
  });

  it('autosale has a switch per allowed rarity, and dispersal selects actions up to its capacity', () => {
    const { root, game } = mount(3);
    game.automation().unlock('autosale');
    game.automation().unlock('dispersal');
    game.buy(laneSkillId('autosale', 2));
    tab(root, /Automation/).click();
    const rarities = [...panel(root).querySelectorAll<HTMLButtonElement>('.automation-autosale [data-protocol="autosale"]')];
    expect(rarities.map((b) => b.querySelector('.nm')!.textContent)).toEqual(['Common', 'Rare']);
    rarities[1]!.click();
    expect(game.automation().isAutosaleOn('rare')).toBe(true);
    expect(game.automation().isAutosaleOn('common')).toBe(false);
    expect(rarities[1]!.classList.contains('on')).toBe(true);
    rarities[1]!.click();
    expect(game.automation().isAutosaleOn('rare')).toBe(false);

    expect(panel(root).querySelectorAll('.automation-dispersal input')).toHaveLength(0);
    expect(panel(root).textContent).not.toContain('Share (%)');
    const targets = [...panel(root).querySelectorAll<HTMLButtonElement>('.automation-dispersal .automation-controls button')];
    expect(targets).toHaveLength(2);
    expect(panel(root).querySelector('.automation-dispersal-count')!.textContent).toBe('0/1');
    targets[1]!.click();
    expect(game.automation().dispersalTargets()).toEqual(['b']);
    expect(targets[0]!.disabled).toBe(true);
    expect(targets[1]!.disabled).toBe(false);
    expect(targets[1]!.getAttribute('aria-pressed')).toBe('true');
    expect(panel(root).querySelector('.automation-dispersal-count')!.textContent).toBe('1/1');
    targets[1]!.click();
    expect(game.automation().dispersalTargets()).toEqual([]);
    expect(targets[0]!.disabled).toBe(false);
  });

  it('only names schematic rarities already seen, and updates their summary after reveal', () => {
    const { root, game, render } = mount(1);
    game.automation().unlock('dispersal');
    tab(root, /Automation/).click();
    const summary = panel(root).querySelector<HTMLElement>('.automation-dispersal-rarities')!;
    expect(summary.closest<HTMLElement>('.rule')!.hidden).toBe(true);
    (game.getState().wallet.seenItems as Record<string, Record<string, true>>)['schem'] = { common: true, rare: true };
    render();
    expect(summary.closest<HTMLElement>('.rule')!.hidden).toBe(false);
    expect([...summary.querySelectorAll<HTMLElement>('.pill')].filter((pill) => !pill.hidden).map((pill) => pill.textContent)).toEqual([
      'Common',
    ]);
    expect(
      [...summary.querySelectorAll<HTMLElement>('.pill')].filter((pill) => !pill.hidden).map((pill) => pill.textContent),
    ).not.toContain('Rare');
  });
});
