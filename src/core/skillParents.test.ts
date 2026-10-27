import { describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { num, numberFactory } from '../numbers';
import { findInvariantViolations } from '../testing/invariants';
import { testConfig } from '../testing/testConfig';
import { type BuyableDefinition, createConfig, deserializeState, serializeState, validateConfig } from './index';

/** A skill paid in re-sleeve points (a re-sleeve gives one), so a test can have as many points as it needs without playing. */
const skill = (id: string, extra: Partial<BuyableDefinition> = {}): BuyableDefinition => ({
  id,
  name: id,
  description: '',
  currency: 'resleevePoints',
  cost: num(1),
  effect: { kind: 'placeholder' },
  ...extra,
});

const config = createConfig(testConfig, {
  buyables: [
    ...testConfig.buyables,
    skill('root'),
    skill('child', { parents: ['root'] }),
    skill('grandchild', { parents: ['child'] }),
    skill('gated', { requires: ['child'], parents: ['root'] }),
  ],
});

/** A game with `points` re-sleeve points to spend. */
const gameWithPoints = (points: number): ReturnType<typeof createGame> => {
  const g = createGame({ config });
  for (let i = 0; i < points; i++) g.resleeve();
  return g;
};

describe('skill parents: what must be owned first', () => {
  it('a skill cannot be bought before its parent, and can be once the parent is owned', () => {
    const g = gameWithPoints(3);
    expect(g.isBuyableAvailable('child')).toBe(false);
    expect(g.canBuy('child')).toBe(false);
    expect(g.buy('child')).toBe('locked');
    expect(g.buy('root')).toBe('purchased');
    expect(g.isBuyableAvailable('child')).toBe(true);
    expect(g.buy('child')).toBe('purchased');
  });

  it('only the direct parent is needed, and a chain is bought from the top', () => {
    const g = gameWithPoints(3);
    expect(g.buy('grandchild')).toBe('locked');
    g.buy('root');
    expect(g.buy('grandchild')).toBe('locked'); // the root is not its parent: the child is
    g.buy('child');
    expect(g.buy('grandchild')).toBe('purchased');
  });

  it('a skill with both a gate (requires) and a parent needs both', () => {
    const g = gameWithPoints(4);
    g.buy('root');
    expect(g.canBuy('gated')).toBe(false); // parent owned, gate not
    g.buy('child');
    expect(g.canBuy('gated')).toBe(true);
  });

  it('a skill without parents needs nothing, and the invariant holds along the way', () => {
    const g = gameWithPoints(2);
    expect(g.canBuy('root')).toBe(true);
    g.buy('root');
    g.buy('child');
    expect(findInvariantViolations(g.getState(), config)).toEqual([]);
  });
});

describe('skill parents: saves and configuration', () => {
  it('a save that owns a skill without its parent is repaired: the skill is dropped, and so is what hangs below it', () => {
    const g = gameWithPoints(3);
    g.buy('root');
    g.buy('child');
    g.buy('grandchild');
    const data = JSON.parse(serializeState(g.getState())) as { purchased: Record<string, number> };
    delete data.purchased['child'];
    const loaded = deserializeState(JSON.stringify(data), config, numberFactory)!;
    expect(loaded.purchased['root']).toBe(1);
    expect(loaded.purchased['child']).toBeUndefined();
    expect(loaded.purchased['grandchild']).toBeUndefined();
  });

  it('a save in order loads unchanged', () => {
    const g = gameWithPoints(2);
    g.buy('root');
    g.buy('child');
    const loaded = deserializeState(serializeState(g.getState()), config, numberFactory)!;
    expect(loaded.purchased['child']).toBe(1);
  });

  const problems = (...extra: BuyableDefinition[]): string =>
    validateConfig(createConfig(testConfig, { buyables: [...testConfig.buyables, ...extra] })).join('\n');

  it('configuration is valid with parents, and reports an unknown parent, a self parent and a loop', () => {
    expect(problems(skill('r'), skill('c', { parents: ['r'] }))).toBe('');
    expect(problems(skill('c', { parents: ['ghost'] }))).toContain('unknown parent "ghost"');
    expect(problems(skill('c', { parents: ['c'] }))).toContain('cannot be its own parent');
    expect(problems(skill('x', { parents: ['y'] }), skill('y', { parents: ['x'] }))).toContain('form a cycle');
  });

  it('a loop that runs through both a gate and a parent is found too', () => {
    expect(problems(skill('x', { parents: ['y'] }), skill('y', { requires: ['x'] }))).toContain('form a cycle');
  });

  it('only skills (paid in points) can have parents', () => {
    const credits: BuyableDefinition = {
      id: 'plain',
      name: 'p',
      description: '',
      cost: num(1),
      effect: { kind: 'placeholder' },
      parents: ['root'],
    };
    expect(problems(skill('root'), credits)).toContain('only skills (paid in points) have parents');
  });
});
