// @vitest-environment happy-dom
/**
 * Regression: a masked skill (its text reads ???) must never look or act purchasable, even when its price is covered. The re-sleeve
 * tree before the first re-sleeve is the case: its roots have no gate, so the engine can afford them while the tree is still masked.
 */
import { describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { type BuyableDefinition, createConfig } from '../core';
import { num } from '../numbers';
import { testConfig } from '../testing/testConfig';
import { buildViewModel } from './viewModel';
import { mountTestUi } from '../testing/domMountKit';

/** A free re-sleeve skill: affordable from the start, but masked because no sleeve-run has finished. */
const free: BuyableDefinition = {
  id: 'free',
  name: 'Free',
  description: 'Does a thing.',
  symbol: 'FR',
  currency: 'resleevePoints',
  cost: num(0),
  effect: { kind: 'placeholder' },
};
const config = createConfig(testConfig, { buyables: [...testConfig.buyables, free] });

describe('a masked skill is never purchasable', () => {
  it('its view is neither clickable nor affordable, though the engine could afford it', () => {
    const g = createGame({ config });
    expect(g.canBuy('free')).toBe(true);
    const node = buildViewModel(g)
      .skills.resleeve.lanes.flatMap((l) => l.nodes)
      .find((n) => n.view.id === 'free')!;
    expect(node.masked).toBe(true);
    expect(node.view.clickable).toBe(false);
    expect(node.view.affordable).toBe(false);
  });

  it('its button is disabled and does not carry the purchasable highlight', () => {
    document.body.innerHTML = '';
    const root = document.createElement('div');
    document.body.append(root);
    mountTestUi(root, createGame({ config }));
    const button = [...root.querySelectorAll<HTMLButtonElement>('.skill-node')].find((b) => b.classList.contains('masked'))!;
    expect(button.disabled).toBe(true);
    expect(button.classList.contains('purchasable')).toBe(false);
  });
});
