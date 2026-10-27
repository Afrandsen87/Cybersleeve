// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { createConfig } from '../core';
import { num } from '../numbers';
import { automationLaneBuyables, laneSkillId } from '../testing/automationKit';
import { setCredits, testConfig } from '../testing/testConfig';
import { type SpeedControl, mountUi } from './dom';
import { buildViewModel } from './viewModel';

const speed: SpeedControl = { enabled: false, factor: 1, toggle: () => false };

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
  const render = mountUi(root, game, speed, () => {});
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
      expect(f.lanes[0]!.nodes.map((n) => n.view.id)).toEqual([1, 2, 3].map((n) => laneSkillId(f.id, n)));
      expect(f.lanes[0]!.nodes.some((n) => n.masked)).toBe(false);
    }
    expect(vm.skills.lanes.flatMap((l) => l.nodes)).toHaveLength(0); // the test content has no skills in the Skills tab
  });

  it('the box shows the lane from the start, with no separate unlock button; pressing the first skill unlocks the feature, the next one needs it', () => {
    const { root, game, render } = mount(2);
    const box = root.querySelector<HTMLElement>('.automation-autoBurn')!;
    const nodes = () => [...box.querySelectorAll<HTMLButtonElement>('.skill-node')];
    expect(nodes()).toHaveLength(3);
    expect(box.querySelector('.automation-unlock')).toBeNull();
    expect(game.automation().isUnlocked('autoBurn')).toBe(false);
    nodes()[1]!.click(); // the second skill cannot be bought before the first
    expect(game.ownedCount(laneSkillId('autoBurn', 2))).toBe(0);
    nodes()[0]!.click();
    render();
    expect(game.automation().isUnlocked('autoBurn')).toBe(true);
    expect(box.classList.contains('unlocked')).toBe(true);
    nodes()[1]!.click();
    expect(game.ownedCount(laneSkillId('autoBurn', 2))).toBe(1);
    expect(game.automation().pointsAvailable()).toBe(0);
  });

  it('a lane can be started with the first point whichever feature it is', () => {
    const { root, game, render } = mount(1);
    root.querySelector<HTMLButtonElement>('.automation-dispersal .skill-node')!.click();
    render();
    expect(game.ownedCount(laneSkillId('dispersal', 1))).toBe(1);
    expect(game.automation().isUnlocked('dispersal')).toBe(true);
    expect(game.automation().isUnlocked('autoBurn')).toBe(false);
  });
});
