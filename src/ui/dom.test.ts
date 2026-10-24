// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { num } from '../numbers';
import { setCredits, testConfig } from '../testing/testConfig';
import { mountUi, type SpeedControl } from './dom';

const speed: SpeedControl = { enabled: false, factor: 1, toggle: () => false };

function mount(onReset: () => void = () => {}) {
  const root = document.createElement('div');
  document.body.append(root);
  const game = createGame({ config: testConfig });
  const render = mountUi(root, game, speed, onReset);
  const click = (selector: string, index = 0) => (root.querySelectorAll(selector)[index] as HTMLElement).click();
  return { root, game, render, click };
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('mountUi (smoke test against the real engine)', () => {
  it('paints immediately, before the first tick', () => {
    const { root } = mount();
    expect(root.querySelector('.credits')?.textContent).toBe('0 credits');
    expect(root.querySelector('.action-title')?.textContent).toBe('A');
  });

  it('clicking an action starts it; ticking and rendering shows progress and the payout', () => {
    const { root, game, render, click } = mount();
    click('.action-main');
    expect(game.getState().actions['a']?.running).toBe(true);
    game.tick(5_000);
    render();
    expect((root.querySelector('.bar-fill') as HTMLElement).style.width).toBe('50%');
    game.tick(5_000);
    render();
    expect(root.querySelector('.credits')?.textContent).toBe('0.5 credits');
  });

  it('a purchase button buys; once owned, an auto-run button switches on and off', () => {
    const { root, game, render, click } = mount();
    setCredits(game, num(100));
    render();
    const autoIndex = [...root.querySelectorAll('.upgrade')].findIndex((b) => b.getAttribute('aria-label') === 'Auto');
    expect(autoIndex).toBeGreaterThanOrEqual(0);
    click('.upgrade', autoIndex);
    expect(game.ownedCount('auto')).toBe(1);
    expect(game.isAutoRunEnabled('auto')).toBe(true);
    click('.upgrade', autoIndex);
    expect(game.isAutoRunEnabled('auto')).toBe(false);
    expect(game.ownedCount('auto')).toBe(1); // switching never buys another copy
  });

  it('every purchase button is named for assistive technology and carries a hover tip', () => {
    const { root } = mount();
    for (const button of root.querySelectorAll<HTMLElement>('.upgrade')) {
      expect(button.getAttribute('aria-label')).toBeTruthy();
      expect(button.dataset['tip']).toBeTruthy();
    }
  });

  it('re-sleeving needs a second click, and Cancel disarms it', () => {
    const { root, game, render, click } = mount();
    setCredits(game, num(50));
    render();
    click('.resleeve');
    expect(game.getState().credits.toNumber()).toBe(50);
    expect(root.querySelector('.resleeve')?.classList.contains('armed')).toBe(true);
    click('.resleeve-cancel');
    expect(root.querySelector('.resleeve')?.classList.contains('armed')).toBe(false);
    click('.resleeve');
    click('.resleeve');
    expect(game.getState().credits.toNumber()).toBe(0);
  });

  it('the Reset save button calls the reset handler and repaints', () => {
    let calls = 0;
    const { click } = mount(() => calls++);
    click('.reset-save');
    expect(calls).toBe(1);
  });

  it('an unchanged frame does not touch the DOM (no text or tip is rewritten)', () => {
    const { root, render } = mount();
    const mutations: MutationRecord[] = [];
    const observer = new MutationObserver((records) => mutations.push(...records));
    observer.observe(root, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['data-tip', 'style'],
    });
    render();
    render();
    expect(observer.takeRecords()).toEqual([]);
    expect(mutations).toEqual([]);
  });
});
