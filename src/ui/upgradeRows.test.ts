/** Currency row and stable partition tests using the shared test configuration. */
import { describe, expect, it, vi } from 'vitest';
import { createGame } from '../app/createGame';
import { createConfig, type BuyableDefinition } from '../core';
import { testConfig } from '../testing/testConfig';
import { sectionLayout } from './view/buyableViews';
import { buildViewModel } from './viewModel';

describe('upgrade currency rows', () => {
  it('splits exclusively by currency, labels rows, and caches the same layout array', () => {
    const node: BuyableDefinition = { ...testConfig.buyables[3]!, id: 'node', currency: 'networkNodes' };
    const config = createConfig(testConfig, { buyables: [...testConfig.buyables, node] });
    const layout = sectionLayout(config);
    expect(sectionLayout(config)).toBe(layout);
    expect(layout.map((s) => s.id)).toEqual(['sleeve', 'network']);
    for (const row of layout) {
      for (const id of row.ids) {
        expect(config.buyables.find((b) => b.id === id)!.currency === 'networkNodes').toBe(row.id === 'network');
      }
    }
    expect(buildViewModel(createGame({ config })).sleeve.sections.map((s) => s.title)).toEqual(['SLEEVE', 'NETWORK']);
  });

  it('omits empty rows', () => {
    expect(sectionLayout(testConfig).map((s) => s.id)).toEqual(['sleeve']);
    expect(sectionLayout(createConfig(testConfig, { buyables: [] }))).toEqual([]);
  });
});

it.each([
  [0, '0'],
  [1, '1'],
  [1e21, '1Sx'],
] as const)('formats owned count %s for tiles', (count, expected) => {
  const game = createGame({ config: testConfig });
  vi.spyOn(game, 'ownedCount').mockReturnValue(count);
  const view = buildViewModel(game).sleeve.buyables[0]!;
  expect(view.ownedText).toBe(expected);
  expect(view.ownedText).not.toContain('e+');
});
