/**
 * Saving and loading re-sleeve state, and validation of the re-sleeve skills.
 */
import { describe, expect, it } from 'vitest';
import type { createGame } from '../../app/createGame';
import { numberFactory } from '../../numbers';
import { testConfig } from '../../testing/testConfig';
import { findInvariantViolations } from '../../testing/invariants';
import { createConfig, deserializeState, serializeState, validateConfig, type BuyableDefinition, type GameConfig } from '..';
import { asSave, flatSave } from '../../testing/saveKit';
import { atLevel, config, newGame, resleeveSkill, withNodes } from '../../testing/resleeveTreeKit';

describe('saving', () => {
  const roundTrip = (g: ReturnType<typeof createGame>, c: GameConfig = config) =>
    deserializeState(serializeState(g.getState()), c, numberFactory);

  it('keeps the runs, the synthetic sleeves and the re-sleeve skills', () => {
    const g = newGame();
    withNodes(g, 1000);
    atLevel(g, 3);
    g.resleeve();
    g.buy('eu');
    g.resleeve();
    g.buy('syn');
    g.resleeve();
    const loaded = roundTrip(g)!;
    expect(loaded.wallet.runs.map((r) => [r.creditsPerSecond.toNumber(), r.actionLevelsTotal])).toEqual([
      [50, 3],
      [0, 0],
      [0, 0],
    ]);
    expect(loaded.wallet.synths).toEqual(g.getState().wallet.synths);
    expect(loaded.sleeve.purchased['eu']).toBe(1);
    expect(loaded.sleeve.purchased['syn']).toBe(1);
    expect(serializeState(loaded)).toBe(serializeState(g.getState())); // saving, loading and saving again gives the same text
  });

  it('loads an older save without these parts as a game with no runs', () => {
    const g = newGame();
    const data = flatSave(serializeState(g.getState())) as Record<string, unknown>;
    delete data['runs'];
    delete data['synths'];
    const loaded = deserializeState(asSave(data), config, numberFactory)!;
    expect(loaded.wallet.runs).toEqual([]);
    expect(loaded.wallet.synths).toEqual([]);
  });

  it('repairs what it cannot read: a bad run becomes an empty one (so the others keep their place) and a stray sleeve is dropped', () => {
    const g = newGame();
    g.resleeve();
    g.buy('eu');
    g.resleeve();
    g.buy('syn'); // one sleeve on run 1
    const data = flatSave(serializeState(g.getState())) as Record<string, unknown>;
    data['runs'] = [{ creditsPerSecond: 'oops', actionLevelsTotal: -4 }, { creditsPerSecond: '12', actionLevelsTotal: 3 }, 'junk'];
    data['synths'] = [{ runIndex: 1 }, { runIndex: 7 }, { runIndex: -1 }, { runIndex: 0.5 }, 'junk', { runIndex: 2 }];
    const loaded = deserializeState(asSave(data), config, numberFactory)!;
    expect(loaded.wallet.runs.map((r) => [r.creditsPerSecond.toNumber(), r.actionLevelsTotal])).toEqual([
      [0, 0],
      [12, 3],
      [0, 0],
    ]);
    expect(loaded.wallet.synths).toEqual([{ runIndex: 1 }, { runIndex: 2 }]);
  });

  it('hands out no synthetic sleeves to a save that does not own the skill', () => {
    const g = newGame();
    g.resleeve();
    const data = flatSave(serializeState(g.getState())) as Record<string, unknown>;
    data['synths'] = [{ runIndex: 0 }];
    expect(deserializeState(asSave(data), config, numberFactory)!.wallet.synths).toEqual([]);
  });

  it('the state of a played game passes every invariant', () => {
    const g = newGame();
    withNodes(g, 500);
    atLevel(g, 2);
    g.resleeve();
    g.buy('eu');
    g.resleeve();
    g.buy('syn');
    g.resleeve();
    g.tick(5_000);
    expect(findInvariantViolations(g.getState(), config)).toEqual([]);
  });
});

describe('validation', () => {
  const problems = (effect: BuyableDefinition['effect']): string =>
    validateConfig(createConfig(testConfig, { buyables: [...testConfig.buyables, resleeveSkill('x', effect)] })).join('|');

  it.each([
    [{ kind: 'actionXpReductionFromSleeveLevel', remainingPerOrder: 0, maxReduction: 0.9 }, 'remainingPerOrder must be in (0, 1)'],
    [{ kind: 'actionXpReductionFromSleeveLevel', remainingPerOrder: 1, maxReduction: 0.9 }, 'remainingPerOrder must be in (0, 1)'],
    [{ kind: 'actionXpReductionFromSleeveLevel', remainingPerOrder: 0.5, maxReduction: 1 }, 'maxReduction must be in [0, 1)'],
    [{ kind: 'actionXpReductionFromSleeveLevel', remainingPerOrder: 0.5, maxReduction: -0.1 }, 'maxReduction must be in [0, 1)'],
  ] as const)('%j is rejected', (effect, message) => {
    expect(problems(effect as BuyableDefinition['effect'])).toContain(message);
  });

  it('accepts the effects of the tree, and checks the new settings', () => {
    expect(problems({ kind: 'synthSleeves' })).toBe('');
    expect(problems({ kind: 'placeholder' })).toBe('');
    expect(validateConfig(createConfig(config, { resleeve: { pointsPerResleeve: 0 } })).join('|')).toContain('resleeve.pointsPerResleeve');
    expect(validateConfig(createConfig(config, { resleeve: { runsShown: 0 } })).join('|')).toContain('resleeve.runsShown');
  });
});
