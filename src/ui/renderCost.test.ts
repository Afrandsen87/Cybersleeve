// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { LevelRule } from '../core';
import { num, numberFactory } from '../numbers';
import { hoverText } from '../testing/hover';
import { testConfig } from '../testing/testConfig';
import { mountUi, type SpeedControl } from './dom';
import { type UiText, uiText } from './uiText';
import { buildViewModel } from './viewModel';

const speed: SpeedControl = { enabled: false, factor: 1, toggle: () => false };

/** The display text with every hover-text builder counted, to see how often tooltips are built. */
function countingText(): { text: UiText; built: () => number } {
  let built = 0;
  const tips = Object.fromEntries(
    Object.entries(uiText.tips).map(([name, build]) => [
      name,
      (...args: unknown[]) => {
        built++;
        return (build as (...a: unknown[]) => string)(...args);
      },
    ]),
  );
  return { text: { ...uiText, tips: tips as unknown as UiText['tips'] }, built: () => built };
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('tooltips are built when they are shown, not when the screen is built', () => {
  it('building the view model builds no tooltip until one is read', () => {
    const { text, built } = countingText();
    const vm = buildViewModel(createGame({ config: testConfig }), numberFactory, text);
    expect(built()).toBe(0);
    expect(vm.sleeve.buyables[0]!.tip).not.toBe('');
    expect(built()).toBe(1);
  });

  it('mounting and refreshing the screen builds none; pointing at an element builds just its tip', () => {
    const { text, built } = countingText();
    const root = document.createElement('div');
    document.body.append(root);
    const game = createGame({ config: testConfig });
    const render = mountUi(root, game, speed, () => {}, { text });
    render();
    render();
    expect(built()).toBe(0);
    const first = root.querySelector<HTMLElement>('.upgrade')!;
    expect(hoverText(first)).not.toBe('');
    expect(built()).toBe(1);
  });

  it('a tooltip that is showing follows the game on the next refresh', () => {
    const root = document.createElement('div');
    document.body.append(root);
    const game = createGame({ config: testConfig });
    const render = mountUi(root, game, speed, () => {});
    const heat = [...root.querySelectorAll<HTMLElement>('.stat')].find(
      (r) => r.querySelector('.stat-label')?.textContent === uiText.statLabels.heat,
    )!;
    heat.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    const box = [...document.querySelectorAll<HTMLElement>('.tooltip')].at(-1)!;
    const before = box.textContent;
    (game.getState() as { heat: number }).heat = 30;
    render();
    expect(box.hidden).toBe(false);
    expect(box.textContent).not.toBe(before);
  });
});

describe('progress bars', () => {
  const fills = (root: HTMLElement) => [...root.querySelectorAll<HTMLElement>('.bar-fill, .xp-fill')];

  it('are scaled from the left (transform), never sized by width', () => {
    const root = document.createElement('div');
    document.body.append(root);
    const game = createGame({ config: testConfig });
    const render = mountUi(root, game, speed, () => {});
    game.startAction('a');
    game.tick(2_500);
    render();
    for (const fill of fills(root)) {
      expect(fill.style.width).toBe('');
      expect(fill.style.transform).toMatch(/^scaleX\(/);
    }
    expect(root.querySelector<HTMLElement>('.bar-fill')!.style.transform).toBe('scaleX(0.25)');
  });

  it('glide towards a higher value, and snap back without sliding when a run starts over', () => {
    const root = document.createElement('div');
    document.body.append(root);
    const game = createGame({ config: testConfig });
    const render = mountUi(root, game, speed, () => {});
    const bar = root.querySelector<HTMLElement>('.bar-fill')!;
    game.startAction('a');
    game.tick(2_500);
    render();
    expect(bar.style.transition).toBe('');
    game.tick(2_500);
    render();
    expect(bar.style.transform).toBe('scaleX(0.5)');
    expect(bar.style.transition).toBe('');
    game.tick(5_100); // the run completes; the action is not on auto, so the bar falls back to empty
    render();
    expect(bar.style.transform).toBe('scaleX(0)');
    expect(bar.style.transition).toBe('none');
    game.startAction('a');
    game.tick(1_000);
    render();
    expect(bar.style.transition).toBe('');
  });
});

describe('LevelRule keeps its last answer without ever returning a stale one', () => {
  const rule = new LevelRule({ firstLevelXp: 10, growthFactor: 10 }, numberFactory);

  it('gives the right level for XP asked in any order, including the same XP again', () => {
    const asked = [0, 9, 10, 109, 110, 110, 1_109, 1_110, 9, 1e6, 10, 10];
    const expected = [0, 0, 1, 1, 2, 2, 2, 3, 0, 5, 1, 1];
    expect(asked.map((xp) => rule.levelForXp(num(xp)))).toEqual(expected);
  });

  it('thresholds are the same on the first and later asks, below and above the exact-sum range', () => {
    for (const level of [1, 5, 20, 64, 65, 120]) {
      const first = rule.xpForNextLevel(level).toString();
      expect(rule.xpForNextLevel(level).toString()).toBe(first);
      expect(rule.levelForXp(rule.xpForNextLevel(level))).toBe(level + 1);
    }
  });
});
