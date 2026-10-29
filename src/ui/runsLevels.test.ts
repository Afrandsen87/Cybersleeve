import { describe, expect, it } from 'vitest';
import { loose, newGame, withBuyables } from '../testing/resleeveSkillsKit';
import { num } from '../numbers';
import { buildViewModel } from './viewModel';

describe('the Stats tab lists the level of every action in each run', () => {
  it('shows the level each action had when the run ended, newest run first', () => {
    const g = newGame(withBuyables([]));
    loose(g).actions['a']!.xp = num(110); // level 2 in the test configuration
    g.resleeve();
    loose(g).actions['a']!.xp = num(1_110); // level 3
    g.resleeve();
    const rows = buildViewModel(g).runs.rows;
    expect(rows.map((r) => r.actionLevelTexts)).toEqual([['A 3'], ['A 2']]);
  });

  it('shows no per-action line for a run written down before levels were kept', () => {
    const g = newGame(withBuyables([]));
    g.resleeve();
    const record = g.getState().wallet.runs[0] as { actionLevels?: unknown };
    delete record.actionLevels;
    expect(buildViewModel(g).runs.rows[0]?.actionLevelTexts).toEqual([]);
  });
});
