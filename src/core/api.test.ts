import { describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { num } from '../numbers';
import { setCredits, testConfig } from '../testing/testConfig';
import { createConfig, validateConfig } from './index';

describe('GameCommands.activateBuyable', () => {
  it('buys a buyable, reports a refusal, and switches an owned auto-run instead of buying again', () => {
    const g = createGame({ config: testConfig });
    expect(g.activateBuyable('auto')).toBe('cannot-afford');
    setCredits(g, num(100));
    expect(g.activateBuyable('auto')).toBe('purchased');
    expect(g.activateBuyable('auto')).toBe('switched-off');
    expect(g.activateBuyable('auto')).toBe('switched-on');
    expect(g.ownedCount('auto')).toBe(1);
    expect(g.activateBuyable('nope')).toBe('unknown');
  });

  it('a repeatable non-auto buyable keeps being bought', () => {
    const g = createGame({ config: testConfig });
    setCredits(g, num(100000));
    g.activateBuyable('dual');
    expect(g.activateBuyable('dup')).toBe('purchased');
    expect(g.activateBuyable('dup')).toBe('purchased');
    expect(g.ownedCount('dup')).toBe(2);
  });
});

describe('tick slicing configuration', () => {
  it('must be positive', () => {
    const problems = validateConfig(createConfig(testConfig, { engine: { maxSliceMs: 0, maxSlicesPerTick: 0 } })).join('\n');
    expect(problems).toContain('engine.maxSliceMs');
    expect(problems).toContain('engine.maxSlicesPerTick');
  });
});
