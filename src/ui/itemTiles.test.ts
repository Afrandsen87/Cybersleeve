// @vitest-environment happy-dom
/**
 * Burn lead, Admin key and Skill shard tiles of the Inventory, in the view model and on the screen.
 */
import { describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { createConfig, type GameConfig } from '../core';
import { mountTestUi } from '../testing/domMountKit';
import { buildViewModel } from './viewModel';
import { config, state, NOT } from './modesKit';

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

describe('the Burn lead tile on the screen', () => {
  const mount = () => {
    const root = document.createElement('div');
    document.body.append(root);
    const game = createGame({ config });
    const render = mountTestUi(root, game);
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
    const render = mountTestUi(root, game);
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
    expect(game.getState().sleeve.keyToggles['adminKey']).toBe(true);
    expect(game.getState().sleeve.keyToggles['zeroDay']).not.toBe(true);
    expect(view(game, 'Admin key')).toMatchObject({ toggleable: true, on: true });
    tile('Admin key').click();
    expect(game.getState().sleeve.keyToggles['adminKey']).not.toBe(true);
  });

  it('the Skill shard tile is used by clicking it: one shard lands on an unlocked action', () => {
    const { game, render, tile } = mount();
    state(game).inventory['sh'] = { common: 2 };
    render();
    expect(tile('Skill shard').disabled).toBe(false);
    tile('Skill shard').click();
    expect(state(game).inventory['sh']!['common']).toBe(1);
    expect(game.getState().sleeve.actions['a']!.skillShards).toBe(1);
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
