// @vitest-environment happy-dom
import { hoverText } from '../testing/hover';
import { beforeEach, describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { createConfig } from '../core';
import { num } from '../numbers';
import { setCredits, testConfig } from '../testing/testConfig';
import { mountUi } from './dom';
import { idleSpeed, mountTestUi } from '../testing/domMountKit';

function mount(onReset: () => void = () => {}) {
  const root = document.createElement('div');
  document.body.append(root);
  const game = createGame({ config: testConfig });
  const render = mountUi(root, game, idleSpeed, onReset);
  const click = (selector: string, index = 0) => (root.querySelectorAll(selector)[index] as HTMLElement).click();
  return { root, game, render, click };
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('mountUi (smoke test against the real engine)', () => {
  it('paints immediately, before the first tick', () => {
    const { root } = mount();
    expect(root.querySelector('.credits')?.textContent).toBe('Credits: 0');
    expect(root.querySelector('.action-title')?.textContent).toBe('A');
  });

  it('clicking an action starts it; ticking and rendering shows progress and the payout', () => {
    const { root, game, render, click } = mount();
    click('.action-main');
    expect(game.getState().sleeve.actions['a']?.running).toBe(true);
    game.tick(5_000);
    render();
    expect((root.querySelector('.bar-fill') as HTMLElement).style.transform).toBe('scaleX(0.5)');
    game.tick(5_000);
    render();
    expect(root.querySelector('.credits')?.textContent).toBe('Credits: 0.5');
  });

  it('a purchase button buys; once owned, the auto-run cell of the square switches on and off', () => {
    const { game, render, click } = mount();
    setCredits(game, num(100));
    render();
    click('.square-unlock'); // before Auto-run is bought the whole square buys it
    expect(game.ownedCount('auto')).toBe(1);
    expect(game.isAutoRunEnabled('auto')).toBe(true);
    click('.cell-autoRun');
    expect(game.isAutoRunEnabled('auto')).toBe(false);
    expect(game.ownedCount('auto')).toBe(1); // switching never buys another copy
  });

  it('a purchase in the row of an action buys', () => {
    const { root, game, render, click } = mount();
    setCredits(game, num(100));
    render();
    const dualIndex = [...root.querySelectorAll('.upgrade')].findIndex((b) => b.getAttribute('aria-label') === 'Dual');
    expect(dualIndex).toBeGreaterThanOrEqual(0);
    click('.upgrade', dualIndex);
    expect(game.ownedCount('dual')).toBe(1);
  });

  it('every purchase button is named for assistive technology and carries a hover tip', () => {
    const { root } = mount();
    for (const button of root.querySelectorAll<HTMLElement>('.upgrade')) {
      expect(button.getAttribute('aria-label')).toBeTruthy();
      // A button inside something hidden (the grid while Auto-run is locked) and an empty placeholder have no tip to show.
      if (button.closest('[hidden]') || button.classList.contains('empty')) continue;
      expect(hoverText(button)).toBeTruthy();
    }
  });

  it('re-sleeving needs a second click, and Cancel disarms it', () => {
    const { root, game, render, click } = mount();
    setCredits(game, num(50));
    render();
    click('.resleeve');
    expect(game.getState().wallet.credits.toNumber()).toBe(50);
    expect(root.querySelector('.resleeve')?.classList.contains('armed')).toBe(true);
    click('.resleeve-cancel');
    expect(root.querySelector('.resleeve')?.classList.contains('armed')).toBe(false);
    click('.resleeve');
    click('.resleeve');
    expect(game.getState().wallet.credits.toNumber()).toBe(0);
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

describe('mountUi - the speed line of an action card', () => {
  it('carries a hover tip while the action is open', () => {
    const { root } = mount();
    const info = root.querySelector<HTMLElement>('.action-info')!;
    expect(hoverText(info)).toContain('Action Speed = Action Level x Sleeve Level x Interface Speed');
  });
});

describe('screen layout', () => {
  it('puts the Sleeve and the right-hand widgets above a dividing line, and the actions below it', () => {
    const root = document.createElement('div');
    document.body.append(root);
    mountTestUi(root, createGame({ config: testConfig }));
    const layout = root.querySelector('.layout')!;
    expect([...layout.children].map((e) => e.className.split(' ')[0])).toEqual(['dashboard', 'divider', 'actions']);
    const dashboard = layout.querySelector('.dashboard')!;
    expect([...dashboard.children].map((e) => e.className.split(' ')[0])).toEqual(['sleeve-widget', 'dashboard-right']);
  });
});

describe('sleeve purchases', () => {
  const nodeBuyable = {
    id: 'uplink',
    name: 'Uplink',
    description: '',
    currency: 'networkNodes' as const,
    cost: num(100),
    effect: { kind: 'interfaceSpeed' as const, amount: 0.1 },
  };
  const mount = () => {
    const root = document.createElement('div');
    document.body.append(root);
    const config = createConfig(testConfig, { buyables: [...testConfig.buyables, nodeBuyable] });
    mountTestUi(root, createGame({ config }));
    return root;
  };

  it('sit in widgets beside Network, not inside the Sleeve widget', () => {
    const root = mount();
    expect(root.querySelector('.sleeve-widget .upgrade')).toBeNull();
    expect(root.querySelector('.sleeve-widget .section-title')).toBeNull();
    const right = [...root.querySelector('.dashboard-right')!.children];
    expect(right[1]).toBe(root.querySelector('.upgrades-widget'));
    expect(right[2]).toBe(root.querySelector('.exploitation-widget'));
  });

  it('the ones paid in credits go to Sleeve Improvements, the ones paid in nodes to Network Exploitation', () => {
    const root = mount();
    expect(root.querySelector('.upgrades-widget h2')!.textContent).toBe('Sleeve Improvements');
    expect(root.querySelector('.exploitation-widget h2')!.textContent).toBe('Network Exploitation');
    expect(root.querySelectorAll('.upgrades-widget .upgrade').length).toBeGreaterThan(0);
    const exploitation = [...root.querySelectorAll('.exploitation-widget .upgrade')];
    expect(exploitation.map((b) => b.getAttribute('aria-label'))).toEqual(['Uplink']);
    expect(root.querySelector('.exploitation-widget .section-title')).toBeNull();
  });

  it('Sleeve Improvements has no "Rebuyable" heading, but its buttons are there', () => {
    const root = mount();
    const titles = [...root.querySelectorAll('.upgrades-widget .section-title')].map((e) => e.textContent);
    expect(titles).not.toContain('Rebuyable');
    expect(root.querySelectorAll('.upgrades-widget .upgrade').length).toBeGreaterThan(0);
  });
});

describe('icons', () => {
  it('are shown before the action title, the credits and the item rows, without changing their text', () => {
    const root = document.createElement('div');
    document.body.append(root);
    const game = createGame({ config: testConfig });
    const icons = { urlFor: (id: string) => (id === 'a' || id === 'credits' ? `url("icon-${id}")` : null) };
    mountTestUi(root, game, { icons });
    const title = root.querySelector('.action-title') as HTMLElement;
    expect(title.classList.contains('has-icon')).toBe(true);
    expect(title.style.getPropertyValue('--icon')).toBe('url("icon-a")');
    expect(title.textContent).toBe('A');
    const credits = root.querySelector('.credits') as HTMLElement;
    expect(credits.style.getPropertyValue('--icon')).toBe('url("icon-credits")');
    expect(credits.textContent).toBe('Credits: 0');
  });

  it('are left out entirely when none are given', () => {
    const { root } = mount();
    expect(root.querySelector('.has-icon')).toBeNull();
  });

  it('are shown on purchase buttons, keeping the letters as the fallback text', () => {
    const root = document.createElement('div');
    document.body.append(root);
    const game = createGame({ config: testConfig });
    const icons = { urlFor: (id: string) => `url("icon-${id}")` };
    mountTestUi(root, game, { icons });
    const button = root.querySelector('.upgrade') as HTMLElement;
    expect(button.classList.contains('has-icon')).toBe(true);
    expect(button.style.getPropertyValue('--icon')).toMatch(/^url\("icon-/);
    expect(button.textContent).not.toBe('');
  });
});

describe('mountUi - the changelog modal', () => {
  function mountWith(changelog?: { version: string; changes: string[] }[]) {
    document.body.innerHTML = '<div id="app"></div>';
    const root = document.getElementById('app') as HTMLElement;
    mountTestUi(root, createGame({ config: testConfig }), {
      changelog,
    });
    return root;
  }

  it('is hidden until the button is clicked, says so when empty, and closes again', () => {
    const root = mountWith();
    const modal = root.querySelector('.modal-backdrop') as HTMLElement;
    expect(modal.hidden).toBe(true);
    (root.querySelector('.changelog-open') as HTMLButtonElement).click();
    expect(modal.hidden).toBe(false);
    expect(modal.querySelector('.modal-empty')).not.toBeNull();
    (modal.querySelector('.modal-close') as HTMLButtonElement).click();
    expect(modal.hidden).toBe(true);
  });

  it('lists the entries it is given', () => {
    const root = mountWith([{ version: '0.1', changes: ['First change'] }]);
    expect(root.querySelector('.modal h3')?.textContent).toBe('0.1');
    expect(root.querySelector('.modal li')?.textContent).toBe('First change');
  });
});
