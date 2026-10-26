// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { type BuyableDefinition, createConfig, type GameConfig } from '../core';
import { num } from '../numbers';
import { hoverText } from '../testing/hover';
import { networkAction, setCredits, testConfig } from '../testing/testConfig';
import { mountUi, type SpeedControl } from './dom';
import { buildViewModel, statRow } from './viewModel';

const speed: SpeedControl = { enabled: false, factor: 1, toggle: () => false };

const buyable = (b: Pick<BuyableDefinition, 'id' | 'effect'> & Partial<BuyableDefinition>): BuyableDefinition => ({
  name: b.id,
  description: '',
  cost: num(1),
  ...b,
});

/**
 * Test action 'a' has Overclock (+50%, 1 heat/min), an auto-run and unlocks for Overclock and Focus; 'net' has a Focus unlock only.
 * Leads are an item, 5% of the heat each. Levels stay out of reach.
 */
const config: GameConfig = (() => {
  const base = createConfig(testConfig, {
    buyables: [
      ...testConfig.buyables,
      buyable({ id: 'oc-a', actionId: 'a', effect: { kind: 'overclockUnlock' } }),
      buyable({ id: 'fo-a', actionId: 'a', effect: { kind: 'focusUnlock' } }),
      buyable({ id: 'fo-net', actionId: 'net', effect: { kind: 'focusUnlock' } }),
      buyable({ id: 'ocs', maxPurchases: Infinity, costGrowth: 10, effect: { kind: 'overclockStrength', perCopy: 0.1 } }),
      buyable({ id: 'slots', maxPurchases: 2, effect: { kind: 'focusSlots', perCopy: 1 } }),
    ],
    items: {
      ...testConfig.items,
      definitions: [...testConfig.items.definitions, { id: 'lead', name: 'Lead', sellable: false, hasRarity: false }],
      burnLead: { itemId: 'lead', heatFraction: 0.05 },
    },
    progression: { actionLevels: { firstLevelXp: 1e12, growthFactor: 10 }, sleeveLevels: { firstLevelXp: 1e12, growthFactor: 10 } },
  });
  return createConfig(base, { actions: [{ ...base.actions[0]!, overclock: { speedBonus: 0.5, heatPerMinute: 1 } }, networkAction] });
})();

const augmentConfig: GameConfig = createConfig(config, { items: { ...config.items, augment: { itemId: 'file', xpBonusPerItem: 0.01 } } });

const own = (g: ReturnType<typeof createGame>, id: string, times = 1): void => {
  setCredits(g, num(1e9));
  for (let i = 0; i < times; i++) expect(g.buy(id)).toBe('purchased');
};
const state = (g: ReturnType<typeof createGame>) =>
  g.getState() as unknown as { heat: number; inventory: Record<string, Record<string, number>> };
const NOT = /\b(not|never|no)\b/i;

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('the Overclock toggle in the view model', () => {
  it('does not exist before the action unlocks it, and the sleeve upgrade alone does not unlock it', () => {
    const g = createGame({ config });
    for (const a of buildViewModel(g).actions) expect(a.overclock).toBeNull();
    own(g, 'ocs');
    for (const a of buildViewModel(g).actions) expect(a.overclock).toBeNull();
  });

  it('exists on the unlocked action, off at first; an action without an effect never has one', () => {
    const g = createGame({ config });
    own(g, 'oc-a');
    const [a, net] = buildViewModel(g).actions;
    expect(a!.overclock).toMatchObject({ symbol: 'OV', name: 'Overclock', on: false, clickable: true });
    expect(net!.overclock).toBeNull();
  });

  it('the tip shows the calculation: the strength, the scaled bonus and the heat cost', () => {
    const g = createGame({ config });
    own(g, 'oc-a');
    own(g, 'ocs');
    const tip = buildViewModel(g).actions[0]!.overclock!.tip;
    expect(tip.split('\n')[0]).toBe('Overclock (off)');
    expect(tip).toContain('Strength = 1.1');
    expect(tip).toContain('Speed Bonus = 55% (50% x Strength)');
    expect(tip).toContain('Costs 1 heat per minute while this action runs');
    expect(tip).toContain('Click to switch on');
  });

  it('says what it does and never what it does not', () => {
    const g = createGame({ config });
    own(g, 'oc-a');
    expect(buildViewModel(g).actions[0]!.overclock!.tip).not.toMatch(NOT);
  });

  it('while on, the action speed tip lists the Overclock factor', () => {
    const g = createGame({ config });
    own(g, 'oc-a');
    expect(buildViewModel(g).actions[0]!.speedTip).not.toContain('Overclock');
    g.toggleOverclock('a');
    const tip = buildViewModel(g).actions[0]!.speedTip;
    expect(tip.split('\n')[0]).toBe('Action Speed = Action Level x Sleeve Level x Interface Speed x Overclock');
    expect(tip).toContain('Overclock = 1.5');
  });
});

describe('the Overclock tip of an action with its own effect', () => {
  const tipOf = (rule: object) => {
    const base = createConfig(config, { actions: config.actions.map((a) => (a.id === 'a' ? { ...a, overclock: rule } : a)) });
    const g = createGame({ config: base });
    own(g, 'oc-a');
    own(g, 'ocs', 2);
    return buildViewModel(g).actions[0]!.overclock!.tip;
  };

  it('a reward bonus shows its own formula and numbers, scaled by the strength', () => {
    const tip = tipOf({ rewardBonus: 2 });
    expect(tip).toContain('Reward per Run = Reward per Run x (1 + Reward Bonus)');
    expect(tip).toContain('Reward Bonus = 240% (200% x Strength)');
    expect(tip).not.toContain('Speed Bonus');
    expect(tip).not.toContain('heat');
  });

  it('a node cost, an extra payment and a heat factor are each named, and carry no strength', () => {
    const tip = tipOf({ alsoPays: 'net', heatPerRunFactor: 3, completionEffects: [{ kind: 'removeNodes', amount: 5 }] });
    expect(tip).toContain('Each completed run also pays the nodes of one Net run');
    expect(tip).toContain('Each run makes 3x as much heat');
    expect(tip).toContain('Each completed run costs 5 nodes');
    expect(tip).not.toContain('Strength');
  });

  it('say what things do and never what they do not', () => {
    for (const rule of [
      { rewardBonus: 2 },
      { alsoPays: 'net', heatPerRunFactor: 3 },
      { completionEffects: [{ kind: 'removeNodes', amount: 5 }] },
    ]) {
      expect(tipOf(rule)).not.toMatch(NOT);
    }
  });
});

describe('the Focus toggle in the view model', () => {
  it('does not exist before the action unlocks it, and the slot upgrade alone does not unlock it', () => {
    const g = createGame({ config });
    own(g, 'slots');
    for (const a of buildViewModel(g).actions) expect(a.focus).toBeNull();
  });

  it('exists on the unlocked actions only', () => {
    const g = createGame({ config });
    own(g, 'fo-net');
    const [a, net] = buildViewModel(g).actions;
    expect(a!.focus).toBeNull();
    expect(net!.focus).toMatchObject({ symbol: 'FO', name: 'Focus', on: false, clickable: true });
  });

  it('with every slot taken, only the focused action can be clicked, and the tip says why', () => {
    const g = createGame({ config });
    own(g, 'fo-a');
    own(g, 'fo-net');
    g.toggleFocus('a');
    const [a, net] = buildViewModel(g).actions;
    expect(a!.focus).toMatchObject({ on: true, clickable: true });
    expect(net!.focus).toMatchObject({ on: false, clickable: false });
    expect(net!.focus!.tip).toContain('Focus Slots in use = 1 / 1');
    expect(net!.focus!.tip).toContain('Every slot is in use: switch another action off first');
    expect(a!.focus!.tip).toContain('Focus Bonus = 25%');
    expect(a!.focus!.tip).toContain('Click to switch off');
  });

  it('says what it does and never what it does not', () => {
    const g = createGame({ config });
    own(g, 'fo-a');
    own(g, 'fo-net');
    g.toggleFocus('a');
    for (const a of buildViewModel(g).actions) expect(a.focus!.tip).not.toMatch(NOT);
  });
});

describe('the square on an action card (view model)', () => {
  const squareOf = (g: ReturnType<typeof createGame>, id = 'a') => buildViewModel(g).actions.find((a) => a.id === id)!.square;

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
    expect(squareOf(g).cells[3]).toMatchObject({ mode: 'press', clickable: true, on: false });
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
    expect(card.buyables.filter(flagged).map((b) => b.id)).toEqual(['auto', 'oc-a', 'fo-a']);
    expect(card.buyables.filter((b) => !b.inSquare).map((b) => b.id)).toEqual(['dual', 'dup']);
  });

  it('the tips of the cells say what things do and never what they do not', () => {
    const g = createGame({ config: augmentConfig });
    own(g, 'auto');
    own(g, 'oc-a');
    for (const c of squareOf(g).cells) expect(c.tip, c.id).not.toMatch(NOT);
  });
});

describe('the heat bar with fractions of a point', () => {
  const bar = (g: ReturnType<typeof createGame>) => statRow(buildViewModel(g).sleeve.stats, 'heat').bar!;

  it('says it waits while there is less than a whole point of heat', () => {
    const g = createGame({ config });
    state(g).heat = 0.5;
    expect(bar(g)).toMatchObject({ running: false, label: 'Heat cooldown (paused: needs a whole point of heat)' });
    state(g).heat = 1;
    expect(bar(g)).toMatchObject({ running: true, label: 'Heat cooldown' });
  });

  it('shows heat in fractions', () => {
    const g = createGame({ config });
    state(g).heat = 0.5;
    expect(statRow(buildViewModel(g).sleeve.stats, 'heat').text).toBe('0.5');
  });

  it('the heat tip says the cooldown removes whole points only', () => {
    const g = createGame({ config });
    expect(statRow(buildViewModel(g).sleeve.stats, 'heat').tip).toContain('in whole points only');
  });
});

describe('the Burn lead row in the Inventory view model', () => {
  const row = (g: ReturnType<typeof createGame>) =>
    buildViewModel(g).inventory.rows.find((r) => r.itemId === 'lead' && r.rarityId === 'common')!;

  it('is usable and not sellable; it can be used while a lead is held and there is heat', () => {
    const g = createGame({ config });
    state(g).inventory['lead'] = { common: 2 };
    expect(row(g)).toMatchObject({ usable: true, sellable: false, canUse: false });
    state(g).heat = 10;
    expect(row(g).canUse).toBe(true);
  });

  it('has one row named by the item alone, with no rarity in it', () => {
    const g = createGame({ config });
    const rows = buildViewModel(g).inventory.rows.filter((r) => r.itemId === 'lead');
    expect(rows.map((r) => r.label)).toEqual(['Lead']);
    const files = buildViewModel(g).inventory.rows.filter((r) => r.itemId === 'file');
    expect(files.map((r) => r.label)).toEqual(['Common File', 'Rare File']); // items with rarities keep one row each
  });

  it('other items are not usable', () => {
    const g = createGame({ config });
    const file = buildViewModel(g).inventory.rows.find((r) => r.itemId === 'file')!;
    expect(file).toMatchObject({ usable: false, canUse: false });
  });

  it('the tip shows the heat before and after using one lead, and the share removed', () => {
    const g = createGame({ config });
    state(g).inventory['lead'] = { common: 3 };
    state(g).heat = 10;
    const tip = row(g).tip;
    expect(tip.split('\n')[0]).toBe('Lead'); // no rarity in the name
    expect(tip).toContain('Share Removed = 5% of the current heat');
    expect(tip).toContain('Heat now = 10');
    expect(tip).toContain('Heat after Use = 9.5');
    expect(tip).toContain('Owned = 3');
  });

  it('says what it does and never what it does not, with and without heat', () => {
    const g = createGame({ config });
    state(g).inventory['lead'] = { common: 3 };
    expect(row(g).tip).not.toMatch(NOT);
    state(g).heat = 4;
    expect(row(g).tip).not.toMatch(NOT);
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
    const { game, render, cell } = mount(augmentConfig);
    own(game, 'auto');
    state(game).inventory['file'] = { common: 1 };
    render();
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

describe('the Burn lead tile on the screen', () => {
  const mount = () => {
    const root = document.createElement('div');
    document.body.append(root);
    const game = createGame({ config });
    const render = mountUi(root, game, speed, () => {});
    const tile = (label: string) =>
      [...root.querySelectorAll<HTMLButtonElement>('.item-tile')].find((t) => t.getAttribute('aria-label') === label)!;
    return { root, game, render, tile };
  };

  it('is used by clicking it: disabled without heat, then one lead and 5% of the heat are used', () => {
    const { game, render, tile } = mount();
    state(game).inventory['lead'] = { common: 2 };
    render();
    expect(tile('Lead').disabled).toBe(true); // no heat yet
    state(game).heat = 10;
    render();
    expect(tile('Lead').disabled).toBe(false);
    tile('Lead').click();
    expect(state(game).heat).toBeCloseTo(9.5, 12);
    expect(state(game).inventory['lead']!['common']).toBe(1);
    expect(tile('Lead').querySelector('.item-count')!.textContent).toBe('1');
  });

  it('is listed in the section of kept items with no rarity colour, and is never selected', () => {
    const { root, game, render, tile } = mount();
    state(game).inventory['lead'] = { common: 1 };
    state(game).heat = 4;
    render();
    const sections = [...root.querySelectorAll<HTMLElement>('.inventory-section')];
    expect(sections[0]!.contains(tile('Lead'))).toBe(true);
    expect(tile('Lead').className).not.toContain('rarity-');
    tile('Lead').click();
    expect(tile('Lead').classList.contains('selected')).toBe(false);
  });

  it('has no sell buttons of its own: the sell buttons stay disabled', () => {
    const { root, game, render, tile } = mount();
    state(game).inventory['lead'] = { common: 1 };
    state(game).heat = 4;
    render();
    tile('Lead').click();
    const sell = [...root.querySelectorAll<HTMLButtonElement>('.inventory-action')].filter((b) => b.textContent?.startsWith('Sell'));
    expect(sell.every((b) => b.disabled)).toBe(true);
  });

  it('a tile of another item selects instead of being used', () => {
    const { game, render, tile } = mount();
    state(game).inventory['file'] = { common: 1 };
    state(game).heat = 4;
    render();
    tile('Common File').click();
    expect(tile('Common File').classList.contains('selected')).toBe(true);
    expect(state(game).heat).toBe(4);
  });
});

describe('the Admin key and Skill shard tiles', () => {
  const keyConfig: GameConfig = createConfig(config, {
    items: {
      ...config.items,
      definitions: [
        ...config.items.definitions,
        { id: 'ak', name: 'Admin key', sellable: false, hasRarity: false },
        { id: 'sh', name: 'Skill shard', sellable: false, hasRarity: false },
      ],
      adminKey: { itemId: 'ak', actionId: 'a', shard: { itemId: 'sh', chance: 0.02 } },
      skillShard: { itemId: 'sh', levelsDelayed: 1 },
    },
  });

  const mount = () => {
    const root = document.createElement('div');
    document.body.append(root);
    const game = createGame({ config: keyConfig, random: () => 0 });
    const render = mountUi(root, game, speed, () => {});
    const tile = (label: string) =>
      [...root.querySelectorAll<HTMLButtonElement>('.item-tile')].find((t) => t.getAttribute('aria-label') === label)!;
    return { game, render, tile };
  };
  const view = (g: ReturnType<typeof createGame>, label: string) => buildViewModel(g).inventory.rows.find((r) => r.label === label)!;

  it('the Admin key tile is a toggle: disabled with none held, then switched on and off by clicking', () => {
    const { game, render, tile } = mount();
    render();
    expect(tile('Admin key').disabled).toBe(true);
    state(game).inventory['ak'] = { common: 2 };
    render();
    expect(tile('Admin key').disabled).toBe(false);
    tile('Admin key').click();
    expect(game.getState().adminKeysOn).toBe(true);
    expect(game.getState().zeroDaysOn).toBe(false);
    expect(view(game, 'Admin key')).toMatchObject({ toggleable: true, on: true });
    tile('Admin key').click();
    expect(game.getState().adminKeysOn).toBe(false);
  });

  it('the Skill shard tile is used by clicking it: one shard lands on an unlocked action', () => {
    const { game, render, tile } = mount();
    state(game).inventory['sh'] = { common: 2 };
    render();
    expect(tile('Skill shard').disabled).toBe(false);
    tile('Skill shard').click();
    expect(state(game).inventory['sh']!['common']).toBe(1);
    expect(game.getState().actions['a']!.skillShards).toBe(1);
    expect(view(game, 'Skill shard')).toMatchObject({ usable: true, toggleable: false });
  });

  it('the tips say what they do, in the standard wording', () => {
    const { game } = mount();
    state(game).inventory['ak'] = { common: 1 };
    state(game).inventory['sh'] = { common: 1 };
    const key = view(game, 'Admin key').tip;
    expect(key).toContain('every completed A run uses one up and gets +100% critical chance');
    expect(key).toContain('2% chance to drop a Skill shard');
    expect(key).toContain('Click to switch on');
    const shard = view(game, 'Skill shard').tip;
    expect(shard).toContain('Delays the XP scaling of a random unlocked action by 1 level');
    expect(shard).toContain('Click to use one');
    expect(shard).toContain('Drop Chance = 0%'); // no Admin key can be had yet
    for (const text of [key, shard]) expect(text).not.toMatch(NOT);
  });
});
