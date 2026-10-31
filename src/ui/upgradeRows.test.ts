/** Currency row and stable partition tests using the shared test configuration. */
import { describe, expect, it, vi } from 'vitest';
import { createGame } from '../app/createGame';
import { createConfig, type BuyableDefinition } from '../core';
import { testConfig } from '../testing/testConfig';
import { sectionLayout } from './view/buyableViews';
import { boughtOneTimeFirst } from './view/upgradeRows';
import { buildViewModel, type BuyableView } from './viewModel';

/** Creates deterministic base-price views. Called by: tests. Calls: createGame, buildViewModel. */
function views(): BuyableView[] {
  return buildViewModel(createGame({ config: testConfig })).sleeve.sections[0]!.buyables.slice();
}

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

describe('boughtOneTimeFirst', () => {
  it('moves a dearer bought one-time ahead of cheaper unbought views without mutating input', () => {
    const input = views();
    input[1] = { ...input[1]!, owned: 1, maxed: true };
    const before = input.slice();
    expect(boughtOneTimeFirst(input)).toEqual([input[1], input[0]]);
    expect(input).toEqual(before);
  });

  it('keeps two bought one-time purchases in incoming base-price order', () => {
    const input = views().map((b) => ({ ...b, owned: 1, maxed: true }));
    expect(boughtOneTimeFirst(input)).toEqual(input);
  });

  it('keeps a maxed repeatable in its incoming position among the rest', () => {
    const input = views();
    input[1] = { ...input[1]!, owned: 3, repeatable: true, maxed: true };
    expect(boughtOneTimeFirst(input)).toEqual(input);
  });

  it('accepts empty input', () => {
    expect(boughtOneTimeFirst([])).toEqual([]);
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
