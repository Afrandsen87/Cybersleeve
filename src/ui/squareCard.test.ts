// @vitest-environment happy-dom
/**
 * The square on an action card, in the view model and on the screen.
 */
import { describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import type { GameConfig } from '../core';
import { num } from '../numbers';
import { hoverText } from '../testing/hover';
import { setCredits } from '../testing/testConfig';
import { mountUi } from './dom';
import { buildViewModel } from './viewModel';
import { speed, config, augmentConfig, own, state, NOT } from './modesKit';

describe('the square on an action card (view model)', () => {
  const squareOf = (g: ReturnType<typeof createGame>, id = 'a', augmentRarityId: string | null = null) =>
    buildViewModel(g, undefined, undefined, { augmentRarityId }).actions.find((a) => a.id === id)!.square;

  it('while Auto-run is not owned the whole square is the button that buys it', () => {
    const g = createGame({ config });
    const square = squareOf(g);
    expect(square.locked).toBe(true);
    expect(square.cells[0]).toMatchObject({ id: 'autoRun', mode: 'buy', buyableId: 'auto', clickable: false, ready: false });
    setCredits(g, num(100));
    expect(squareOf(g).cells[0]).toMatchObject({ mode: 'buy', clickable: true, ready: true });
    expect(squareOf(g).cells[0]!.tip).toContain('Cost = 10 credits');
  });

  it('once Auto-run is owned there are always four cells: Auto-run, Overclock, Focus, Augment', () => {
    const g = createGame({ config: augmentConfig });
    own(g, 'auto');
    const square = squareOf(g);
    expect(square.locked).toBe(false);
    expect(square.cells.map((c) => c.id)).toEqual(['autoRun', 'overclock', 'focus', 'augment']);
  });

  it('the Auto-run cell is a toggle once bought, lit when on', () => {
    const g = createGame({ config });
    own(g, 'auto');
    expect(squareOf(g).cells[0]).toMatchObject({ mode: 'toggle', on: true, clickable: true });
    g.activateBuyable('auto');
    expect(squareOf(g).cells[0]).toMatchObject({ mode: 'toggle', on: false });
  });

  it('an Overclock cell not bought yet is a purchase; bought, it is a toggle; without an effect it is empty', () => {
    const g = createGame({ config });
    own(g, 'auto');
    setCredits(g, num(0));
    expect(squareOf(g).cells[1]).toMatchObject({ id: 'overclock', mode: 'buy', buyableId: 'oc-a', clickable: false });
    setCredits(g, num(100));
    expect(squareOf(g).cells[1]).toMatchObject({ mode: 'buy', clickable: true, ready: true });
    expect(squareOf(g).cells[1]!.tip).toContain('Cost = 1 credits');
    g.buy('oc-a');
    expect(squareOf(g).cells[1]).toMatchObject({ mode: 'toggle', on: false, clickable: true, buyableId: 'oc-a' });
    g.toggleOverclock('a');
    expect(squareOf(g).cells[1]).toMatchObject({ mode: 'toggle', on: true });
    expect(squareOf(g, 'net').cells[1]).toMatchObject({ id: 'overclock', mode: 'empty', clickable: false, buyableId: null });
  });

  it('a Focus cell is a purchase, then a toggle', () => {
    const g = createGame({ config });
    own(g, 'auto');
    expect(squareOf(g).cells[2]).toMatchObject({ id: 'focus', mode: 'buy', buyableId: 'fo-a' });
    g.buy('fo-a');
    expect(squareOf(g).cells[2]).toMatchObject({ mode: 'toggle', on: false });
  });

  it('the Augment cell presses when a schematic is held, and is empty in a game with none', () => {
    const none = createGame({ config });
    own(none, 'auto');
    expect(squareOf(none).cells[3]).toMatchObject({ id: 'augment', mode: 'empty' });
    const g = createGame({ config: augmentConfig });
    own(g, 'auto');
    expect(squareOf(g).cells[3]).toMatchObject({ mode: 'press', clickable: false });
    state(g).inventory['file'] = { common: 1 };
    expect(squareOf(g).cells[3]).toMatchObject({ mode: 'press', clickable: false }); // held, but no rarity is selected
    expect(squareOf(g, 'a', 'common').cells[3]).toMatchObject({ mode: 'press', clickable: true, on: false });
  });

  it('an action with no Auto-run buyable has no locked square, and its Auto-run cell is empty', () => {
    const g = createGame({ config });
    const square = squareOf(g, 'net');
    expect(square.locked).toBe(false);
    expect(square.cells[0]).toMatchObject({ id: 'autoRun', mode: 'empty' });
  });

  it('flags the buyables of the square, so that the card leaves them out of its row of purchases', () => {
    const g = createGame({ config });
    const flagged = (b: { inSquare: boolean }) => b.inSquare;
    const card = buildViewModel(g).actions[0]!;
    expect(card.buyables.filter(flagged).map((b) => b.id)).toEqual(['oc-a', 'fo-a', 'auto']); // by base price
    expect(card.buyables.filter((b) => !b.inSquare).map((b) => b.id)).toEqual(['dual', 'dup']);
  });

  it('the tips of the cells say what things do and never what they do not', () => {
    const g = createGame({ config: augmentConfig });
    own(g, 'auto');
    own(g, 'oc-a');
    for (const c of squareOf(g).cells) expect(c.tip, c.id).not.toMatch(NOT);
  });
});

describe('the square on the screen', () => {
  const mount = (cfg: GameConfig = config) => {
    const root = document.createElement('div');
    document.body.append(root);
    const game = createGame({ config: cfg });
    const render = mountUi(root, game, speed, () => {});
    const card = (i: number) => root.querySelectorAll('.action')[i] as HTMLElement;
    const unlock = (i: number) => card(i).querySelector<HTMLButtonElement>('.square-unlock')!;
    const grid = (i: number) => card(i).querySelector<HTMLElement>('.square-grid')!;
    const cell = (i: number, id: string) => card(i).querySelector<HTMLButtonElement>(`.cell-${id}`)!;
    return { root, game, render, card, unlock, grid, cell };
  };

  it('sits in the card after the reward line and the two level bars, and is the last thing before the row of purchases', () => {
    const { card } = mount();
    const children = [...card(0).children].map((c) => c.className.split(' ')[0]);
    // The start-run button floats in the corner (absolutely positioned), so it is last and takes no grid cell.
    expect(children).toEqual([
      'action-main',
      'action-reward',
      'xp',
      'xp',
      'square',
      'upgrades',
      'start-run',
      'action-poster',
      'crit-badge',
    ]);
  });

  it('shows a poster naming the access level instead of a locked card, and the poster is empty of the lock once revealed', () => {
    const { card } = mount();
    const poster = card(0).querySelector<HTMLElement>('.action-poster')!;
    expect(poster.textContent).toMatch(/^Increase Access level to \d+ to unlock$/);
  });

  it('the start-run corner button starts the action and is disabled with it', () => {
    const { card, game, render } = mount();
    const btn = card(0).querySelector<HTMLButtonElement>('.start-run')!;
    expect(btn.getAttribute('aria-label')).toBe('Start run');
    expect(btn.disabled).toBe(false);
    btn.click();
    render();
    expect(game.getState().actions[Object.keys(game.getState().actions)[0]!]!.running).toBe(true);
    expect(btn.disabled).toBe(true); // greyed out until the run is over
  });

  it('the run bar is in the start button, which holds neither the reward line nor the square', () => {
    const { card } = mount();
    const main = card(0).querySelector('.action-main')!;
    expect(main.querySelector('.bar')).not.toBeNull();
    expect(main.querySelector('.action-reward')).toBeNull();
    expect(main.querySelector('.square')).toBeNull();
  });

  it('while Auto-run is locked the whole square is one button that buys it, and the grid is hidden', () => {
    const { game, render, unlock, grid } = mount();
    expect(unlock(0).hidden).toBe(false);
    expect(grid(0).hidden).toBe(true);
    expect(unlock(0).disabled).toBe(true); // nothing to pay with yet
    expect(unlock(0).getAttribute('aria-label')).toBe('Auto-run');
    setCredits(game, num(100));
    render();
    expect(unlock(0).disabled).toBe(false);
    expect(unlock(0).classList.contains('ready')).toBe(true);
    expect(hoverText(unlock(0))).toContain('Cost = 10 credits');
    unlock(0).click();
    expect(game.ownedCount('auto')).toBe(1);
    expect(unlock(0).hidden).toBe(true);
    expect(grid(0).hidden).toBe(false);
  });

  it('once bought, the square is a grid of four buttons', () => {
    const { game, render, grid } = mount(augmentConfig);
    own(game, 'auto');
    render();
    const cells = [...grid(0).querySelectorAll('button')];
    expect(cells).toHaveLength(4);
    expect(cells.map((c) => c.getAttribute('aria-label'))).toEqual(['Auto-run', 'Overclock', 'Focus', 'Augment']);
  });

  it('an unbought Overclock cell is a purchase button; pressing it buys, and then it is a toggle', () => {
    const { game, render, cell } = mount();
    own(game, 'auto');
    render();
    const overclock = cell(0, 'overclock');
    expect(overclock.classList.contains('owned')).toBe(false);
    expect(overclock.classList.contains('ready')).toBe(true);
    expect(hoverText(overclock)).toContain('Cost = 1 credits');
    overclock.click();
    expect(game.ownedCount('oc-a')).toBe(1);
    expect(game.overclockStatus('a')!.on).toBe(false);
    expect(overclock.classList.contains('owned')).toBe(true);
    expect(overclock.classList.contains('off')).toBe(true);
    overclock.click();
    expect(game.overclockStatus('a')!.on).toBe(true);
    expect(overclock.classList.contains('off')).toBe(false);
    expect(hoverText(overclock)).toContain('Overclock (on)');
    overclock.click();
    expect(game.overclockStatus('a')!.on).toBe(false);
  });

  it('a Focus cell buys, then switches; with the slot taken the other action cannot be switched on', () => {
    const { game, render, cell } = mount();
    own(game, 'auto');
    own(game, 'fo-a');
    own(game, 'fo-net');
    render();
    cell(0, 'focus').click();
    expect(game.focusStatus('a')!.on).toBe(true);
    expect(cell(1, 'focus').disabled).toBe(true);
    cell(0, 'focus').click();
    expect(cell(1, 'focus').disabled).toBe(false);
  });

  it('a cell for a feature the action does not have is an empty, disabled placeholder with no tip', () => {
    const { game, render, cell } = mount();
    own(game, 'auto');
    render();
    const empty = cell(1, 'overclock'); // 'net' has no Overclock effect
    expect(empty.classList.contains('empty')).toBe(true);
    expect(empty.disabled).toBe(true);
    expect(hoverText(empty)).toBe('');
  });

  it('the Auto-run cell switches auto-run on and off once bought', () => {
    const { game, render, cell } = mount();
    own(game, 'auto');
    render();
    expect(game.isAutoRunEnabled('auto')).toBe(true);
    cell(0, 'autoRun').click();
    expect(game.isAutoRunEnabled('auto')).toBe(false);
    expect(cell(0, 'autoRun').classList.contains('off')).toBe(true);
    expect(game.ownedCount('auto')).toBe(1); // switching never buys another copy
  });

  it('the Augment cell applies a schematic', () => {
    const { root, game, render, cell } = mount(augmentConfig);
    own(game, 'auto');
    state(game).inventory['file'] = { common: 1 };
    render();
    expect(cell(0, 'augment').disabled).toBe(true); // nothing selected in the Inventory yet
    root.querySelector<HTMLButtonElement>('.item-tile[aria-label="Common File"]')!.click(); // select the common rarity
    cell(0, 'augment').click();
    expect(game.getState().actions['a']!.augments).toEqual({ common: 1 });
    expect(cell(0, 'augment').disabled).toBe(true); // none left
  });

  it('the cells show the Overclock and Focus pictures, and fall back to letters for the others', () => {
    const root = document.createElement('div');
    document.body.append(root);
    const game = createGame({ config: augmentConfig });
    own(game, 'auto');
    const icons = { urlFor: (id: string) => (id === 'overclock' || id === 'focus' ? `url("icon-${id}")` : null) };
    mountUi(root, game, speed, () => {}, { icons });
    const cell = (id: string) => root.querySelector<HTMLElement>(`.action .cell-${id}`)!;
    expect(cell('overclock').style.getPropertyValue('--icon')).toBe('url("icon-overclock")');
    expect(cell('focus').style.getPropertyValue('--icon')).toBe('url("icon-focus")');
    expect(cell('augment').classList.contains('has-icon')).toBe(false);
    expect(cell('augment').textContent).toBe('AU');
  });
});
