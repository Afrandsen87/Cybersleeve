// @vitest-environment happy-dom
/**
 * A skill branch with a reveal rule (the anonymity branch waits for heat) is absent from the Skills tab, title and nodes, until its
 * stat is revealed. Outcomes only: no tuning numbers.
 */
import { describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { BRANCH_ANONYMITY } from '../content/ids';
import { type BuyableDefinition, createConfig } from '../core';
import { num } from '../numbers';
import { legendAction, setCredits, testConfig } from '../testing/testConfig';
import { buildViewModel } from './viewModel';
import { mountTestUi } from '../testing/domMountKit';

const unlock: BuyableDefinition = {
  id: 'unlock',
  name: 'Unlock',
  description: '',
  cost: num(1),
  effect: { kind: 'accessLevel', amount: 1 },
};
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
/** Heat only exists once `unlock` opens the Legend action (it makes heat per second). Two branches: the gated anonymity one and a plain one. */
const config = createConfig(testConfig, {
  actions: [testConfig.actions[0]!, legendAction],
  buyables: [...testConfig.buyables, unlock, skill('s1', BRANCH_ANONYMITY), skill('s2', BRANCH_ANONYMITY), skill('p1', 'plain')],
});
const lane = (g: ReturnType<typeof createGame>, id: string) => buildViewModel(g).skills.lanes.find((l) => l.id === id)!;

describe('a branch gated by heat', () => {
  it('is hidden while heat is not revealed, and the other branches are not', () => {
    const g = createGame({ config });
    expect(lane(g, BRANCH_ANONYMITY).hidden).toBe(true);
    expect(lane(g, 'plain').hidden).toBe(false);
  });

  it('shows once something makes heat', () => {
    const g = createGame({ config });
    setCredits(g, num(1));
    g.buy('unlock');
    expect(lane(g, BRANCH_ANONYMITY).hidden).toBe(false);
  });

  it('is shown by the Show all test aid', () => {
    const g = createGame({ config });
    expect(buildViewModel(g, undefined, undefined, { augmentRarityId: null, revealAll: true }).skills.lanes.every((l) => !l.hidden)).toBe(
      true,
    );
  });

  it('is gone from the screen (title and nodes) until revealed, then appears', () => {
    document.body.innerHTML = '';
    const root = document.createElement('div');
    document.body.append(root);
    const g = createGame({ config });
    const render = mountTestUi(root, g);
    const laneEl = () => root.querySelector<HTMLElement>(`.skill-lane[data-branch="${BRANCH_ANONYMITY}"]`)!;
    expect(laneEl().hidden).toBe(true);
    setCredits(g, num(1));
    g.buy('unlock');
    render();
    expect(laneEl().hidden).toBe(false);
  });
});
