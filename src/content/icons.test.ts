import { describe, expect, it } from 'vitest';
import { CREDITS_ICON_ID, createIconSource } from '../ui/pixelIcon';
import { gameConfig } from './gameConfig';
import { ENTITY_ICONS, ICON_GRIDS, ICON_PALETTE, ICON_SIZE } from './icons';

describe('the real icons', () => {
  it('are all valid grids of the icon size that only use palette colours (building the source checks this)', () => {
    expect(() => createIconSource({ size: ICON_SIZE, palette: ICON_PALETTE, grids: ICON_GRIDS, assignment: ENTITY_ICONS })).not.toThrow();
  });

  it('exist for every action, every item and the credits', () => {
    const wanted = [...gameConfig.actions.map((a) => a.id), ...gameConfig.items.definitions.map((d) => d.id), CREDITS_ICON_ID];
    for (const id of wanted) expect(ENTITY_ICONS[id], `icon for ${id}`).toBeDefined();
  });

  it('exist for every purchase and skill, so no button is left showing letters or a stand-in glyph', () => {
    for (const b of gameConfig.buyables) expect(ENTITY_ICONS[b.id], `icon for ${b.id}`).toBeDefined();
  });

  it('cover every cell of the square on an action card (dom.ts looks them up by cell id)', () => {
    expect(ENTITY_ICONS['augment']).toBeDefined();
    expect(ENTITY_ICONS['autoRun']).toBeDefined();
    expect(ENTITY_ICONS['overclock']).toBeDefined();
    expect(ENTITY_ICONS['focus']).toBeDefined();
  });

  it('are each used by some entity', () => {
    const used = new Set(Object.values(ENTITY_ICONS));
    for (const name of Object.keys(ICON_GRIDS)) expect(used.has(name), name).toBe(true);
  });
});
