// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { rarityGame, rarityState } from '../testing/rarityAutomationKit';
import { createGame } from '../app/createGame';
import { createConfig } from '../core';
import { num } from '../numbers';
import { automationLaneBuyables, laneSkillId } from '../testing/automationKit';
import { setCredits, testConfig } from '../testing/testConfig';
import { buildViewModel } from './viewModel';
import { mountTestUi } from '../testing/domMountKit';

/** Test content: the automation point buyable `core` and a lane of three skills per feature. */
const config = createConfig(testConfig, {
  buyables: [
    ...testConfig.buyables,
    {
      id: 'core',
      name: 'Core',
      description: '',
      cost: num(1),
      costGrowth: 2,
      maxPurchases: Infinity,
      effect: { kind: 'automationPoints', perCopy: 1 },
    },
    ...automationLaneBuyables(),
  ],
  automation: { autoBurnCeiling: 10 },
});

const mount = (points: number) => {
  const root = document.createElement('div');
  document.body.append(root);
  const game = createGame({ config });
  setCredits(game, num(1_000_000));
  for (let i = 0; i < points; i++) game.buy('core');
  const render = mountTestUi(root, game);
  return { root, game, render };
};

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('the skill lane inside each automation box', () => {
  it('every feature carries its whole lane in the view, not hidden, and the lanes are not in the Skills tab', () => {
    const g = createGame({ config });
    const vm = buildViewModel(g);
    for (const f of vm.automation.features) {
      expect(f.lanes, f.id).toHaveLength(1);
      expect(f.lanes[0]!.nodes.map((n) => n.view.id)).toEqual(
        Array.from({ length: f.id === 'autoBurn' ? 9 : 3 }, (_, i) => laneSkillId(f.id, i + 1)),
      );
      expect(f.lanes[0]!.nodes.some((n) => n.masked)).toBe(false);
    }
    expect(vm.skills.lanes.flatMap((l) => l.nodes)).toHaveLength(0); // the test content has no skills in the Skills tab
  });

  it('the box shows the lane from the start, with no separate unlock button; pressing the first skill unlocks the feature, the next one needs it', () => {
    const { root, game, render } = mount(2);
    [...root.querySelectorAll<HTMLButtonElement>('.tab')].find((button) => /Automation/.test(button.textContent ?? ''))?.click();
    const box = root.querySelector<HTMLElement>('.automation-autoBurn')!;
    const nodes = () => [...box.querySelectorAll<HTMLButtonElement>('.skill-node')];
    expect(nodes()).toHaveLength(9); // the Auto Burn lane is the full nine skills
    expect(box.querySelector('.automation-unlock')).toBeNull();
    expect(game.automation().isUnlocked('autoBurn')).toBe(false);
    nodes()[1]!.click(); // the second skill cannot be bought before the first
    expect(game.ownedCount(laneSkillId('autoBurn', 2))).toBe(0);
    nodes()[0]!.click();
    root.querySelector<HTMLButtonElement>('.automation-slot .firmware-install')!.click();
    render();
    expect(game.automation().isUnlocked('autoBurn')).toBe(true);
    expect(box.classList.contains('unlocked')).toBe(true);
    nodes()[1]!.click();
    root.querySelector<HTMLButtonElement>('.automation-slot .firmware-install')!.click();
    expect(game.ownedCount(laneSkillId('autoBurn', 2))).toBe(1);
    expect(game.automation().pointsAvailable()).toBe(0);
  });

  it('a lane can be started with the first point whichever feature it is', () => {
    const { root, game, render } = mount(1);
    root.querySelector<HTMLButtonElement>('.automation-dispersal .skill-node')!.click();
    root.querySelector<HTMLButtonElement>('.automation-slot .firmware-install')!.click();
    render();
    expect(game.ownedCount(laneSkillId('dispersal', 1))).toBe(1);
    expect(game.automation().isUnlocked('dispersal')).toBe(true);
    expect(game.automation().isUnlocked('autoBurn')).toBe(false);
  });
});

/** Automation context: one existing branch lays out as a trunk with two first-parent lanes. */
describe('Kompromat fork and permission controls', () => {
  it('disables owned Back Channel switches while the manual channel is missing', () => {
    const g = rarityGame([1, 2, 3, 4, 5, 6], false);
    expect(
      buildViewModel(g)
        .automation.kompromat.rows[0]!.chips.filter((r) => r.visible)
        .every((r) => r.disabled),
    ).toBe(true);
    rarityState(g).sleeve.purchased['channel'] = 1;
    const visible = buildViewModel(g).automation.backchannelRarities.filter((r) => r.visible);
    expect(visible.map((r) => r.id)).toEqual(['common', 'uncommon', 'rare']);
    expect(buildViewModel(g).automation.kompromat.rows[0]!.chips.find((r) => r.id === 'common')!.disabled).toBe(false);
  });
  it('places the two children of slot 3 on separate rows with the trunk between them', () => {
    const g = rarityGame();
    const lane = buildViewModel(g).automation.features.find((f) => f.id === 'autosale')!.lanes[0]!;
    const node = (slot: number) => lane.nodes.find((n) => n.view.id === `skill-autosale-${slot}`)!;
    expect(lane.rows).toBe(2);
    expect(node(4).row).toBeLessThan(node(7).row);
    expect(node(3).row).toBe((node(4).row + node(7).row) / 2);
    expect(node(4).col).toBe(node(7).col);
    expect(node(4).parents).toEqual([node(3).view.id]);
    expect(node(7).parents).toEqual([node(3).view.id]);
  });
  it('hides each switch until its own skill is owned, and updates existing buttons', () => {
    const g = rarityGame();
    const root = document.createElement('div');
    document.body.append(root);
    const render = mountTestUi(root, g);
    const buttons = () => [...root.querySelectorAll<HTMLButtonElement>('.automation-autosale .automation-switch')];
    expect(buttons().every((b) => b.hidden)).toBe(true);
    const purchased = rarityState(g).sleeve.purchased;
    purchased['skill-autosale-1'] = 1;
    render();
    expect(
      buttons()
        .filter((b) => !b.hidden)
        .map((b) => b.querySelector('.nm')!.textContent),
    ).toEqual(['common']);
    purchased['skill-autosale-4'] = 1;
    render();
    expect(
      buttons()
        .filter((b) => !b.hidden)
        .map((b) => b.querySelector('.nm')!.textContent),
    ).toEqual(['common', 'common']);
  });
});
