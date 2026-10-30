// @vitest-environment happy-dom
/**
 * Inside the Skills tab every sleeve skill tree is always visible, title and nodes, including the anonymity branch before any heat exists.
 * (The tab itself still waits for a skill point; the text of single skills is masked by `skillTree.ts`, tested in `skillTree.test.ts`.)
 * Outcomes only: no tuning numbers.
 */
import { describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { BRANCH_ANONYMITY } from '../content/ids';
import { type BuyableDefinition, createConfig } from '../core';
import { num } from '../numbers';
import { mountTestUi } from '../testing/domMountKit';
import { testConfig } from '../testing/testConfig';
import { buildViewModel } from './viewModel';

const skill = (id: string, branch: string): BuyableDefinition => ({
  id,
  name: id,
  description: '',
  symbol: id.toUpperCase(),
  currency: 'skillPoints',
  branch,
  cost: num(1),
  effect: { kind: 'placeholder' },
});
const config = createConfig(testConfig, {
  buyables: [...testConfig.buyables, skill('s1', BRANCH_ANONYMITY), skill('s2', BRANCH_ANONYMITY), skill('p1', 'plain')],
});

describe('the Skills tab shows every branch', () => {
  it('has a lane with its nodes for every branch in a new game, with no heat anywhere', () => {
    const lanes = buildViewModel(createGame({ config })).skills.lanes;
    expect(lanes.map((l) => l.id).sort()).toEqual([BRANCH_ANONYMITY, 'plain']);
    expect(lanes.find((l) => l.id === BRANCH_ANONYMITY)!.nodes).toHaveLength(2);
  });

  it('puts the lane of every branch on the screen, none of them hidden', () => {
    document.body.innerHTML = '';
    const root = document.createElement('div');
    document.body.append(root);
    mountTestUi(root, createGame({ config }));
    for (const id of [BRANCH_ANONYMITY, 'plain']) {
      const laneEl = root.querySelector<HTMLElement>(`.skill-lane[data-branch="${id}"]`)!;
      expect(laneEl, id).not.toBeNull();
      expect(laneEl.hidden, id).toBe(false);
    }
  });

  it('keeps the Skills tab itself hidden until a skill point exists', () => {
    expect(buildViewModel(createGame({ config })).tabs.find((t) => t.id === 'skills')!.visible).toBe(false);
  });
});
