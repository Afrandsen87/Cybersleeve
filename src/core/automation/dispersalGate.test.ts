import { describe, expect, it } from 'vitest';
import { createGame } from '../../app/createGame';
import { num } from '../../numbers';
import { flat } from '../../testing/flatState';
import { automationLaneBuyables } from '../../testing/automationKit';
import { setCredits, testConfig } from '../../testing/testConfig';
import { createConfig, type GameConfig } from '..';

/**
 * Augment dispersal skips actions whose Auto-run is not owned: the schematics of their share stay in the inventory.
 * Test content: actions `a` and `b`, each with its own Auto-run buyable (`auto`, `auto-b`); `schem` is the schematic.
 */
const config: GameConfig = createConfig(testConfig, {
  actions: [...testConfig.actions, { id: 'b', name: 'B', baseDurationMs: 10_000, reward: num(0), xpPerRun: num(1) }],
  items: {
    rarities: testConfig.items.rarities,
    definitions: [{ id: 'schem', name: 'Schematic', sellable: false }],
    augment: { itemId: 'schem', xpBonusPerItem: 0.01 },
  },
  buyables: [
    ...testConfig.buyables,
    { id: 'auto-b', name: 'Auto B', description: '', actionId: 'b', cost: num(10), effect: { kind: 'autoRun' } },
    { id: 'core', name: 'Core', description: '', cost: num(1), costGrowth: 10, maxPurchases: Infinity, effect: { kind: 'automationPoints', perCopy: 1 } },
    ...automationLaneBuyables(),
  ],
  automation: { autoBurnCeiling: 10 },
});

type Loose = { inventory: Record<string, Record<string, number>>; actions: Record<string, { augments: Record<string, number> }> };
const loose = (g: { getState(): unknown }): Loose => flat<Loose>(g);
const applied = (g: ReturnType<typeof createGame>, id: string): number =>
  Object.values(loose(g).actions[id]!.augments).reduce((n, c) => n + c, 0);

/** A game with dispersal unlocked, 50/50 shares and `held` common schematics; only the Auto-runs in `owned` are bought. */
function dispersalGame(held: number, owned: string[]) {
  const g = createGame({ config });
  setCredits(g, num(1_000));
  g.buy('core');
  g.automation().unlock('dispersal');
  loose(g).inventory['schem'] = { common: held };
  for (const id of owned) (g.getState().sleeve.purchased as Record<string, number>)[id] = 1;
  g.automation().setDispersal('a', 50);
  g.automation().setDispersal('b', 50);
  return g;
}

describe('Augment dispersal and the Auto-run gate', () => {
  it('an action without Auto-run gets nothing: its part stays in the inventory, none consumed or lost', () => {
    const g = dispersalGame(8, ['auto']);
    g.tick(1);
    expect(applied(g, 'a')).toBe(4);
    expect(applied(g, 'b')).toBe(0);
    expect(loose(g).inventory['schem']!['common']).toBe(4);
  });

  it('with no Auto-run owned nothing is applied and nothing is used up', () => {
    const g = dispersalGame(6, []);
    g.tick(1);
    expect(applied(g, 'a') + applied(g, 'b')).toBe(0);
    expect(loose(g).inventory['schem']!['common']).toBe(6);
  });

  it('a switched-off Auto-run still counts as owned', () => {
    const g = dispersalGame(8, ['auto', 'auto-b']);
    g.toggleAutoRun('auto-b');
    g.tick(1);
    expect(applied(g, 'a') + applied(g, 'b')).toBe(8);
  });

  it('one long tick and many short ones leave the same schematics held', () => {
    const long = dispersalGame(8, ['auto']);
    const short = dispersalGame(8, ['auto']);
    long.tick(5_000);
    for (let i = 0; i < 50; i++) short.tick(100);
    expect(applied(short, 'a') + applied(short, 'b')).toBe(applied(long, 'a') + applied(long, 'b'));
    expect(applied(short, 'b')).toBe(0);
    expect(applied(short, 'a') + (loose(short).inventory['schem']!['common'] ?? 0)).toBe(8);
  });
});
