/**
 * The text of a skill branch with a reveal stat (the anonymity branch waits for heat) reads `???` until the stat is revealed; its lane and
 * nodes stay visible. Outcomes only: no tuning numbers.
 */
import { describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { BRANCH_ANONYMITY } from '../content/ids';
import { type BuyableDefinition, createConfig } from '../core';
import { num } from '../numbers';
import { skillViews } from '../testing/skillViews';
import { legendAction, setCredits, testConfig } from '../testing/testConfig';
import { buildViewModel } from './viewModel';

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
/** Heat only exists once `unlock` opens the Legend action (it makes heat per second). */
const config = createConfig(testConfig, {
  actions: [testConfig.actions[0]!, legendAction],
  buyables: [...testConfig.buyables, unlock, skill('s1', BRANCH_ANONYMITY), skill('p1', 'plain')],
});
const names = (g: ReturnType<typeof createGame>, revealAll = false) =>
  skillViews(buildViewModel(g, undefined, undefined, { augmentRarityId: null, revealAll }).skills.lanes);

describe('the text of the anonymity branch', () => {
  it('is masked before heat exists, while its lane and node stay, and other branches stay readable', () => {
    const g = createGame({ config });
    expect(names(g).find((v) => v.id === 's1')!.name).toBe('???');
    expect(names(g).find((v) => v.id === 'p1')!.name).toBe('p1');
    expect(buildViewModel(g).skills.lanes.find((l) => l.id === BRANCH_ANONYMITY)!.nodes).toHaveLength(1);
  });

  it('reads once something makes heat', () => {
    const g = createGame({ config });
    setCredits(g, num(1));
    g.buy('unlock');
    expect(names(g).find((v) => v.id === 's1')!.name).toBe('s1');
  });

  it('is read in full by the Show all test aid', () => {
    expect(names(createGame({ config }), true).find((v) => v.id === 's1')!.name).toBe('s1');
  });
});
