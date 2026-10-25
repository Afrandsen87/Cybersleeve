// @vitest-environment happy-dom
import { hoverText } from '../testing/hover';
import { beforeEach, describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { createConfig } from '../core';
import { num } from '../numbers';
import { setCredits, testConfig } from '../testing/testConfig';
import { mountUi, type SpeedControl } from './dom';
import { buildViewModel } from './viewModel';

const speed: SpeedControl = { enabled: false, factor: 1, toggle: () => false };
const config = createConfig(testConfig, { items: { ...testConfig.items, augment: { itemId: 'file', xpBonusPerItem: 0.01 } } });

type Loose = { inventory: unknown };
const stock = (g: { getState(): unknown }, held: Record<string, number>): void => {
  (g.getState() as unknown as Loose).inventory = { file: held };
};

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('the Augment button in the view model', () => {
  it('every action has one, disabled while no schematic is held', () => {
    const g = createGame({ config });
    for (const a of buildViewModel(g).actions) {
      expect(a.augment).toMatchObject({ label: 'Augment', enabled: false, applied: 0 });
    }
    stock(g, { rare: 1 });
    expect(buildViewModel(g).actions[0]!.augment!.enabled).toBe(true);
  });

  it('is left out when the game has no schematic', () => {
    expect(buildViewModel(createGame({ config: testConfig })).actions[0]!.augment).toBeNull();
  });

  it('the tip shows the calculation with the numbers and what the click does', () => {
    const g = createGame({ config });
    stock(g, { common: 2, rare: 1 });
    g.augmentAction('a');
    g.augmentAction('a');
    const tip = buildViewModel(g).actions[0]!.augment!.tip;
    expect(tip.split('\n')[0]).toBe('XP per Run = Base XP x Boost of each Rarity');
    expect(tip).toContain('\n\nBonus per Augment = 1%\nCommon Augments = 2\n\nXP per Run = 1 x (1 + 0.01 x 2) = 1.02\n');
    expect(tip).toContain('Files held = 1');
    expect(tip).toContain('Next to apply = Rare'); // the commons are all used up
    expect(tip).toContain('sleeve levels are unaffected');
  });

  it('says what things do and never what they do not (no "not", "never" or "no")', () => {
    const tip = buildViewModel(createGame({ config })).actions[0]!.augment!.tip;
    expect(tip).not.toMatch(/\b(not|never|no)\b/i);
  });
});

describe('the Augment button on the screen', () => {
  const mount = () => {
    const root = document.createElement('div');
    document.body.append(root);
    const game = createGame({ config });
    const render = mountUi(root, game, speed, () => {});
    // The Augment button is a cell of the square, which shows its four cells once Auto-run is owned.
    setCredits(game, num(100));
    game.buy('auto');
    render();
    const buttons = () => [...root.querySelectorAll<HTMLButtonElement>('.action .augment')];
    return { root, game, render, buttons };
  };

  it('is a cell of the square in every action card, outside the button that starts the action', () => {
    const { root, buttons } = mount();
    expect(buttons()).toHaveLength(1);
    const card = root.querySelector('.action')!;
    expect(buttons()[0]!.parentElement!.classList.contains('square-grid')).toBe(true);
    expect(card.querySelector('.action-main .augment')).toBeNull();
    expect(buttons()[0]!.getAttribute('aria-label')).toBe('Augment');
  });

  it('is disabled until a schematic is held, and then applies one and updates the card', () => {
    const { game, render, buttons } = mount();
    expect(buttons()[0]!.disabled).toBe(true);
    stock(game, { common: 2 });
    render();
    expect(buttons()[0]!.disabled).toBe(false);
    buttons()[0]!.click();
    expect(game.getState().actions['a']!.augments).toEqual({ common: 1 });
    expect(game.getState().inventory['file']!['common']).toBe(1);
    expect(hoverText(buttons()[0]!)).toContain('XP per Run = 1 x (1 + 0.01 x 1) = 1.01');
    expect(buttons()[0]!.classList.contains('applied')).toBe(true);
    buttons()[0]!.click();
    expect(buttons()[0]!.disabled).toBe(true);
  });

  it('clicking it does not start the action', () => {
    const { game, render, buttons } = mount();
    stock(game, { common: 1 });
    render();
    buttons()[0]!.click();
    expect(game.getState().actions['a']!.running).toBe(false);
  });

  it('is an empty placeholder in a game without a schematic', () => {
    const root = document.createElement('div');
    document.body.append(root);
    const game = createGame({ config: testConfig });
    const render = mountUi(root, game, speed, () => {});
    setCredits(game, num(100));
    game.buy('auto');
    render();
    const cell = root.querySelector<HTMLButtonElement>('.augment')!;
    expect(cell.classList.contains('empty')).toBe(true);
    expect(cell.disabled).toBe(true);
  });

  it('the XP of the next run is the raised amount', () => {
    const { game, render, buttons } = mount();
    stock(game, { common: 100 });
    render();
    for (let i = 0; i < 100; i++) buttons()[0]!.click();
    game.startAction('a');
    game.tick(10_000);
    expect(game.getState().actions['a']!.xp.eq(num(2))).toBe(true);
  });
});

describe('items that cannot be paid out, in the Inventory', () => {
  const kept = createConfig(config, { items: { ...config.items, definitions: [{ id: 'file', name: 'File', sellable: false }] } });

  it('the row has no sell buttons and says how the item is used', () => {
    const g = createGame({ config: kept });
    stock(g, { common: 2 });
    const row = buildViewModel(g).inventory.rows[0]!;
    expect(row.sellable).toBe(false);
    expect(row.tip).toBe(
      'Common File\nApplied to an action with its Augment button\nThe most common one is used first\n\nDrop Chance = 0%\nOwned = 2',
    );
    expect(row.tip).not.toMatch(/\b(not|never|no)\b/i);
  });

  it('the item has no sell section and its tiles cannot be selected, while other items get a sell section', () => {
    for (const [cfg, sellable] of [
      [kept, false],
      [config, true],
    ] as const) {
      document.body.innerHTML = '';
      const root = document.createElement('div');
      document.body.append(root);
      const game = createGame({ config: cfg });
      stock(game, { common: 2 });
      mountUi(root, game, speed, () => {});
      const sections = [...root.querySelectorAll<HTMLElement>('.inventory-section')];
      expect(sections[1]!.hidden).toBe(!sellable); // the section for sale
      expect(sections[0]!.hidden).toBe(sellable); // the section of kept items
      const tile = root.querySelector<HTMLButtonElement>('.item-tile')!;
      tile.click();
      expect(tile.classList.contains('selected')).toBe(sellable);
    }
  });
});

describe('the XP per Run line writes out the whole calculation with the numbers in', () => {
  const line = (g: ReturnType<typeof createGame>): string =>
    buildViewModel(g)
      .actions[0]!.augment!.tip.split('\n')
      .find((l) => l.startsWith('XP per Run = ') && l.includes(' = ', 14))!;

  it('with no augment it is the base XP and the result', () => {
    const g = createGame({ config });
    expect(buildViewModel(g).actions[0]!.augment!.tip).toContain('\nXP per Run = 1 = 1\n');
  });

  it('shows the boost of every rarity that has augments, multiplied, then the result', () => {
    const g = createGame({ config });
    stock(g, { common: 3, rare: 2 });
    for (let i = 0; i < 5; i++) g.augmentAction('a');
    expect(line(g)).toBe('XP per Run = 1 x (1 + 0.01 x 3) x (1 + 0.01 x 2) = 1.0506');
  });

  it('starts from the base XP of the action with the XP lever applied, not from the augmented amount', () => {
    const g = createGame({ config: createConfig(config, { global: { xpMultiplier: 2 } }) });
    stock(g, { common: 1 });
    g.augmentAction('a');
    expect(line(g)).toBe('XP per Run = 2 x (1 + 0.01 x 1) = 2.02');
  });
});
