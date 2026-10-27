import { describe, expect, it } from 'vitest';
import { focusStackGame } from '../core/resleeveSkillsKit';
import { buildViewModel } from './viewModel';

/** The Focus cell of action 'a' as the screen is told to draw it. */
const focusCell = (g: ReturnType<typeof focusStackGame>) =>
  buildViewModel(g)
    .actions.find((a) => a.id === 'a')!
    .square.cells.find((c) => c.id === 'focus')!;

describe('the Focus cell of an action card', () => {
  it('is one toggle without the Overdrive Cap skill', () => {
    const g = focusStackGame(1, false);
    expect(focusCell(g).split).toBeUndefined();
  });

  it('is split into add and remove halves with the skill, which follow the slots', () => {
    const g = focusStackGame(2, true);
    expect(focusCell(g).split).toMatchObject({ count: 0, canAdd: true, canRemove: false });
    g.addFocus('a');
    g.addFocus('a');
    const cell = focusCell(g);
    expect(cell.split).toMatchObject({ count: 2, canAdd: true, canRemove: true });
    expect(cell.split!.addTip).toContain('2 slots on this action');
    expect(cell.split!.removeTip).toContain('Right half');
    g.addFocus('a');
    expect(focusCell(g).split).toMatchObject({ count: 3, canAdd: false, canRemove: true });
  });
});
